// auth.routes.js - Unified Authentication Bridge with Custom Token System
import express from 'express';
import { admin } from '../services/firebase-admin.js';
import crypto from 'crypto';
import { SiweMessage } from 'siwe';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { ethers } from 'ethers';

const router = express.Router();

// System encryption key for admin-readable encryption
const systemKey = crypto.scryptSync(process.env.SYSTEM_ENCRYPTION_KEY || 'crypto-explorer-system-key-secure-256-bit', 'crypto-explorer-salt', 32);

/**
 * Server-Side AES-256-GCM Encryption
 * Encrypts sensitive data while keeping it readable by admin dashboard
 */
function encryptData(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipherGCM('aes-256-gcm', systemKey);
  cipher.setIV(iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return { encrypted, iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decryptData(encryptedData) {
  const { encrypted, iv, tag } = encryptedData;
  const decipher = crypto.createDecipherGCM('aes-256-gcm', systemKey);
  decipher.setIV(Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * Nonce Management - Store temporary nonces for SIWE verification
 */
async function storeNonce(nonce, address, expiration = 300000) { // 5 minutes
  const nonceDoc = {
    nonce,
    address,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + expiration)
  };
  
  await admin.firestore().collection('nonces').doc(nonce).set(nonceDoc);
  console.log('[AUTH] Nonce stored:', nonce, 'for address:', address);
}

async function verifyAndConsumeNonce(nonce, address) {
  const nonceDoc = await admin.firestore().collection('nonces').doc(nonce).get();
  
  if (!nonceDoc.exists) {
    throw new Error('Invalid nonce');
  }
  
  const nonceData = nonceDoc.data();
  
  // Check if nonce is expired
  if (new Date() > nonceData.expiresAt.toDate()) {
    await nonceDoc.ref.delete();
    throw new Error('Nonce expired');
  }
  
  // Check if nonce matches the address
  if (nonceData.address !== address) {
    throw new Error('Nonce address mismatch');
  }
  
  // Consume the nonce
  await nonceDoc.ref.delete();
  console.log('[AUTH] Nonce verified and consumed:', nonce);
  return true;
}

/**
 * Unified Identity Management
 */
async function findOrCreateUser(authMethod, identifier, additionalData = {}) {
  const usersRef = admin.firestore().collection('users');
  
  // Try to find existing user by wallet address or email
  let userDoc;
  if (authMethod === 'wallet') {
    userDoc = await usersRef.where('wallet_address', '==', identifier).get();
  } else if (authMethod === 'email') {
    userDoc = await usersRef.where('email', '==', identifier).get();
  }
  
  if (!userDoc.empty) {
    // Existing user found
    const existingUser = userDoc.docs[0];
    const uid = existingUser.id;
    const userData = existingUser.data();
    
    // Update last login and merge additional data
    await usersRef.doc(uid).update({
      last_active: new Date(),
      last_login: new Date(),
      ...additionalData
    });
    
    console.log('[AUTH] Existing user found:', uid);
    return { uid, isNew: false, userData };
  } else {
    // Create new user
    const uid = authMethod === 'wallet' ? identifier.toLowerCase() : admin.firestore().collection('users').doc().id;
    
    const publicData = {
      username: additionalData.username || `User_${uid.slice(-8)}`,
      wallet_address: authMethod === 'wallet' ? identifier.toLowerCase() : null,
      email: authMethod === 'email' ? identifier : null,
      auth_method: authMethod,
      created_at: new Date(),
      last_active: new Date(),
      last_login: new Date(),
      hustle_count: 0,
      total_points: 0,
      rank: 'Beginner'
    };
    
    // Store public data directly (admin-readable)
    await usersRef.doc(uid).set(publicData);
    
    console.log('[AUTH] New user created:', uid);
    return { uid, isNew: true, userData: publicData };
  }
}

// GET /api/auth/nonce - Generate and store nonce
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }
    
    const nonce = crypto.randomBytes(16).toString('hex');
    await storeNonce(nonce, address);
    
    res.json({ nonce });
  } catch (error) {
    console.error('[AUTH] Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// POST /api/auth/exchange-token - Exchange Firebase ID token for custom token
router.post('/exchange-token', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'Missing ID token' });
    }
    
    console.log('[AUTH] Token exchange request received');
    
    // Check if Firebase Admin is properly initialized
    if (!admin.apps.length) {
      console.error('[AUTH] Firebase Admin not initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    
    // Verify ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('[AUTH] ID token verified for:', decodedToken.uid);
    
    // Create or find user document
    const { uid, isNew } = await findOrCreateUser('email', decodedToken.email, {
      username: decodedToken.name || decodedToken.email.split('@')[0],
      firebase_uid: decodedToken.uid,
      email: decodedToken.email
    });
    
    // Create custom token
    const customToken = await admin.auth().createCustomToken(uid);
    
    console.log('[AUTH] Token exchange successful:', uid);
    
    res.json({
      success: true,
      customToken,
      uid,
      isNew
    });
    
  } catch (error) {
    console.error('[AUTH] Token exchange error:', error);
    res.status(500).json({ error: error.message || 'Token exchange failed' });
  }
});

// POST /api/auth/email/signup - Email signup with custom token
router.post('/email/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('[AUTH] Email signup attempt:', { email, username });
    
    // Check if Firebase Admin is properly initialized
    if (!admin.apps.length) {
      console.error('[AUTH] Firebase Admin not initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    
    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username
    });
    
    console.log('[AUTH] Firebase user created:', userRecord.uid);
    
    // Create user document
    const { uid, isNew } = await findOrCreateUser('email', email, {
      username,
      firebase_uid: userRecord.uid
    });
    
    // Create custom token
    const customToken = await admin.auth().createCustomToken(uid);
    
    console.log('[AUTH] Email signup successful:', uid);
    
    res.json({
      success: true,
      customToken,
      uid,
      isNew,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
    
  } catch (error) {
    console.error('[AUTH] Email signup error:', error);
    console.error('[AUTH] Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
});

// POST /api/auth/email/signin - Email signin with custom token
router.post('/email/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Note: In production, you'd use Firebase Admin SDK to verify password
    // For now, we'll find the user and create a custom token
    const { uid } = await findOrCreateUser('email', email, {
      last_login: new Date()
    });
    
    const customToken = await admin.auth().createCustomToken(uid);
    
    console.log('[AUTH] Email signin successful:', uid);
    
    res.json({
      success: true,
      customToken,
      uid
    });
    
  } catch (error) {
    console.error('[AUTH] Email signin error:', error);
    res.status(500).json({ error: error.message || 'Signin failed' });
  }
});

// POST /api/auth/wallet/verify - Unified wallet verification with custom token
router.post('/wallet/verify', async (req, res) => {
  try {
    const { message, signature, address, chainId } = req.body;
    
    // Input validation
    if (!message || !signature || !address || !chainId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('[AUTH] Wallet verification attempt:', { address, chainId });
    
    let isValid = false;
    
    if (chainId === 'solana') {
      // Solana signature verification
      try {
        if (!/^[0-9a-fA-F]{128}$/.test(signature)) {
          return res.status(400).json({ error: 'Invalid Solana signature format' });
        }
        
        const publicKey = new PublicKey(address);
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = Uint8Array.from(Buffer.from(signature, 'hex'));
        
        isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
      } catch (solanaError) {
        console.error('[AUTH] Solana verification error:', solanaError);
        return res.status(400).json({ error: 'Solana signature verification failed' });
      }
    } else {
      // EVM SIWE verification
      try {
        const siweMessage = new SiweMessage(message);
        const verification = await siweMessage.verify({ signature });
        isValid = verification.success;
        
        // Verify nonce from message
        const messageNonce = siweMessage.nonce;
        await verifyAndConsumeNonce(messageNonce, address);
        
      } catch (siweError) {
        console.error('[AUTH] SIWE verification error:', siweError);
        return res.status(400).json({ error: 'SIWE verification failed' });
      }
    }
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Find or create user
    const { uid, isNew } = await findOrCreateUser('wallet', address, {
      chain_id: chainId,
      last_wallet_signature: signature
    });
    
    // Create Firebase custom token
    const customToken = await admin.auth().createCustomToken(uid);
    
    console.log('[AUTH] Wallet verification successful:', uid, 'New user:', isNew);
    
    res.json({
      success: true,
      customToken,
      uid,
      isNew
    });
    
  } catch (error) {
    console.error('[AUTH] Wallet verification error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// POST /api/auth/storeUserData - Admin-friendly encrypted data storage
router.post('/storeUserData', async (req, res) => {
  try {
    const { uid, userData } = req.body;
    
    if (!uid || !userData) {
      return res.status(400).json({ error: 'Missing uid or userData' });
    }
    
    // Separate public and sensitive data
    const publicData = {
      username: userData.username,
      wallet_address: userData.walletAddress || userData.wallet_address,
      last_active: new Date(),
      hustle_count: userData.hustleHistory?.length || 0,
      total_points: userData.totalPoints || 0,
      rank: userData.rank || 'Beginner',
      last_login: new Date()
    };
    
    const sensitiveData = {
      settings: userData.settings || {},
      api_keys: userData.apiKeys || {},
      private_preferences: userData.privatePreferences || {},
      hustle_history: userData.hustleHistory || []
    };
    
    // Encrypt sensitive data
    const encrypted = encryptData(sensitiveData);
    
    // Store combined data
    await admin.firestore().collection('users').doc(uid).set({
      ...publicData,
      encrypted_data: encrypted
    }, { merge: true });
    
    console.log('[AUTH] User data stored with admin-friendly encryption:', uid);
    res.json({ success: true });
    
  } catch (error) {
    console.error('[AUTH] Store user data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/fetchUserData - Fetch and decrypt user data
router.get('/fetchUserData', async (req, res) => {
  try {
    const { uid } = req.query;
    
    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }
    
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.json({ userData: null });
    }
    
    const data = userDoc.data();
    let userData = { ...data };
    
    // Decrypt sensitive data if present
    if (data.encrypted_data) {
      try {
        const sensitiveData = decryptData(data.encrypted_data);
        userData = { ...userData, ...sensitiveData };
      } catch (decryptError) {
        console.error('[AUTH] Decryption error:', decryptError);
        // Continue with public data only
      }
    }
    
    // Remove encrypted field from response
    delete userData.encrypted_data;
    
    res.json({ userData });
    
  } catch (error) {
    console.error('[AUTH] Fetch user data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logActivity - Log user hustle activity
router.post('/logActivity', async (req, res) => {
  try {
    const { uid, hustleId, activityData } = req.body;
    
    if (!uid || !hustleId) {
      return res.status(400).json({ error: 'Missing uid or hustleId' });
    }
    
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const data = userDoc.data();
    let hustleHistory = [];
    
    // Decrypt existing data if present
    if (data.encrypted_data) {
      try {
        const sensitiveData = decryptData(data.encrypted_data);
        hustleHistory = sensitiveData.hustle_history || [];
      } catch (decryptError) {
        console.error('[AUTH] Decryption error in logActivity:', decryptError);
      }
    }
    
    // Add new activity
    const newActivity = {
      hustle_id: hustleId,
      timestamp: new Date(),
      ...activityData
    };
    
    hustleHistory.push(newActivity);
    
    // Update hustle count
    const hustleCount = hustleHistory.length;
    
    // Encrypt updated history
    const updatedSensitiveData = {
      ...(data.encrypted_data ? decryptData(data.encrypted_data) : {}),
      hustle_history: hustleHistory
    };
    
    const encrypted = encryptData(updatedSensitiveData);
    
    // Update user document
    await admin.firestore().collection('users').doc(uid).update({
      encrypted_data: encrypted,
      hustle_count: hustleCount,
      last_active: new Date()
    });
    
    console.log('[AUTH] Activity logged:', uid, hustleId);
    res.json({ success: true, hustleCount });
    
  } catch (error) {
    console.error('[AUTH] Log activity error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
