// auth-simple.routes.js - Simple authentication routes for AuthPipeline0.5
import express from 'express';
import { admin } from '../services/firebase-admin.js';
import { existsSync, readFileSync } from 'fs';
import crypto from 'crypto';
import path from 'path';

const router = express.Router();

function getRoleFiles() {
  const root = process.cwd();
  const adminsDefault = path.join(root, 'data', 'roles', 'admins.txt');
  const membersDefault = path.join(root, 'data', 'roles', 'members.txt');
  const adminsFallback = path.join(root, 'data', 'roles', 'admins');
  const membersFallback = path.join(root, 'data', 'roles', 'members');

  const adminsPath =
    process.env.CRYPTOEXPLORER_ADMINS_FILE ||
    (existsSync(adminsDefault) ? adminsDefault : (existsSync(adminsFallback) ? adminsFallback : adminsDefault));

  const membersPath =
    process.env.CRYPTOEXPLORER_MEMBERS_FILE ||
    (existsSync(membersDefault) ? membersDefault : (existsSync(membersFallback) ? membersFallback : membersDefault));
  return { adminsPath, membersPath };
}

function decryptIfNeeded(raw) {
  const text = String(raw || '').trim();
  if (!text.startsWith('ENC:v1:')) return text;

  const secret = process.env.CRYPTOEXPLORER_ROLE_FILE_SECRET;
  if (!secret) {
    throw new Error('CRYPTOEXPLORER_ROLE_FILE_SECRET is required to read encrypted role lists');
  }

  // Format: ENC:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
  const parts = text.split(':');
  if (parts.length < 5) {
    throw new Error('Invalid encrypted role list format');
  }
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ciphertext = Buffer.from(parts.slice(4).join(':'), 'base64');

  const key = crypto.createHash('sha256').update(String(secret)).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function parseUsernameList(fileContent) {
  const lines = String(fileContent || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const out = [];
  for (const line of lines) {
    const clean = line.replace(/[()\[\]<>]/g, ' ');
    const parts = clean.split(/[\s,;/\\|]+/g).map((p) => p.trim()).filter(Boolean);
    for (const p of parts) {
      if (!p) continue;
      const token = p.toLowerCase();
      out.push(token);
      if (token.includes('@')) {
        out.push(token.split('@')[0]);
      }
    }
  }
  return Array.from(new Set(out));
}

function loadUsernameList(filePath) {
  try {
    if (!filePath || !existsSync(filePath)) return [];
    const raw = readFileSync(filePath, 'utf8');
    const decrypted = decryptIfNeeded(raw);
    return parseUsernameList(decrypted);
  } catch (e) {
    console.error('[AUTH-SIMPLE] Failed to load role list:', filePath, e?.message || e);
    return [];
  }
}

function resolveRoleFromIdentity({ username, email }) {
  const safeUsername = String(username || '').trim().toLowerCase();
  const safeEmail = String(email || '').trim().toLowerCase();
  const safeEmailPrefix = safeEmail.includes('@') ? safeEmail.split('@')[0] : '';

  const { adminsPath, membersPath } = getRoleFiles();
  const admins = loadUsernameList(adminsPath);
  const members = loadUsernameList(membersPath);

  const isAdmin =
    (safeUsername && admins.includes(safeUsername)) ||
    (safeEmail && admins.includes(safeEmail)) ||
    (safeEmailPrefix && admins.includes(safeEmailPrefix));

  const isMember =
    (safeUsername && members.includes(safeUsername)) ||
    (safeEmail && members.includes(safeEmail)) ||
    (safeEmailPrefix && members.includes(safeEmailPrefix));

  if (isAdmin) return 'admin';
  if (isMember) return 'member';
  return 'user';
}

async function requireFirebaseUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (!token) {
    const err = new Error('Missing Authorization Bearer token');
    err.status = 401;
    throw err;
  }
  return admin.auth().verifyIdToken(token);
}

/**
 * Simple user creation for email signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const usernameNorm = String(username).trim();
    const passwordNorm = String(password);

    if (!emailNorm.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    const passwordRulesOk =
      passwordNorm.length >= 6 &&
      passwordNorm.length <= 12 &&
      !/\s/.test(passwordNorm) &&
      /[a-z]/.test(passwordNorm) &&
      /[A-Z]/.test(passwordNorm) &&
      /\d/.test(passwordNorm) &&
      /[^A-Za-z0-9]/.test(passwordNorm);

    if (!passwordRulesOk) {
      return res.status(400).json({ error: 'Password must be 6-12 characters and include uppercase, lowercase, number, symbol, and no spaces.' });
    }

    if (usernameNorm.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    console.log('[AUTH-SIMPLE] Email signup attempt:', { email: emailNorm, username: usernameNorm });
    
    // Check if Firebase Admin is properly initialized
    if (!admin.apps.length) {
      console.error('[AUTH-SIMPLE] Firebase Admin not initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    
    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email: emailNorm,
      password: passwordNorm,
      displayName: usernameNorm
    });
    
    console.log('[AUTH-SIMPLE] Firebase user created:', userRecord.uid);
    
    // Create user document in Firestore
    const role = resolveRoleFromIdentity({ username: usernameNorm, email: emailNorm });

    const userData = {
      uid: userRecord.uid,
      email: emailNorm,
      username: usernameNorm,
      display_name: usernameNorm,
      role,
      created_at: new Date(),
      last_active: new Date(),
      auth_method: 'email'
    };
    
    await admin.firestore()
      .collection('users')
      .doc(userRecord.uid)
      .set(userData, { merge: true });
    
    console.log('[AUTH-SIMPLE] User document created:', userRecord.uid);
    
    res.json({
      success: true,
      uid: userRecord.uid,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
    
  } catch (error) {
    console.error('[AUTH-SIMPLE] Email signup error:', error);
    console.error('[AUTH-SIMPLE] Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Signup failed' });
  }
});

router.post('/role-sync', async (req, res) => {
  try {
    const decoded = await requireFirebaseUser(req);
    const uid = decoded.uid;

    const userRecord = await admin.auth().getUser(uid);
    const displayName = userRecord.displayName || null;
    const email = userRecord.email || null;
    const username = displayName || (email ? email.split('@')[0] : null);

    const role = resolveRoleFromIdentity({ username, email });

    await admin.auth().setCustomUserClaims(uid, {
      role,
    });

    const userPatch = {
      uid,
      email,
      username,
      display_name: displayName,
      role,
      last_active: new Date(),
    };

    await admin
      .firestore()
      .collection('users')
      .doc(uid)
      .set(userPatch, { merge: true });

    return res.json({
      success: true,
      role,
      profile: userPatch,
    });
  } catch (error) {
    const status = error?.status || 500;
    console.error('[AUTH-SIMPLE] role-sync error:', error);
    return res.status(status).json({ error: error?.message || 'Role sync failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const decoded = await requireFirebaseUser(req);
    const userRecord = await admin.auth().getUser(decoded.uid);
    return res.json({
      success: true,
      uid: decoded.uid,
      claims: decoded,
      user: {
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        customClaims: userRecord.customClaims || null,
      },
    });
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error?.message || 'Failed to fetch user info' });
  }
});

/**
 * Simple user verification for signin
 */
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('[AUTH-SIMPLE] Email signin attempt:', { email });
    
    // For simple auth, we just verify the user exists and return success
    // The actual Firebase auth happens client-side
    
    // Find user by email in Firestore
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('email', '==', email)
      .get();
    
    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Update last active
    await admin.firestore()
      .collection('users')
      .doc(userDoc.id)
      .update({
        last_active: new Date()
      });
    
    console.log('[AUTH-SIMPLE] Signin successful:', userDoc.id);
    
    res.json({
      success: true,
      uid: userDoc.id,
      userData: {
        uid: userData.uid,
        email: userData.email,
        username: userData.username
      }
    });
    
  } catch (error) {
    console.error('[AUTH-SIMPLE] Email signin error:', error);
    res.status(500).json({ error: error.message || 'Signin failed' });
  }
});

/**
 * Get user profile
 */
router.get('/profile/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(uid)
      .get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    
    res.json({
      success: true,
      userData: {
        uid: userData.uid,
        email: userData.email,
        username: userData.username,
        created_at: userData.created_at,
        last_active: userData.last_active
      }
    });
    
  } catch (error) {
    console.error('[AUTH-SIMPLE] Get profile error:', error);
    res.status(500).json({ error: error.message || 'Failed to get profile' });
  }
});

export default router;
