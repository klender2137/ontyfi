// auth-simple.routes.js - Simple authentication routes for AuthPipeline0.5
import express from 'express';
import { admin } from '../services/firebase-admin.js';

const router = express.Router();

/**
 * Simple user creation for email signup
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    console.log('[AUTH-SIMPLE] Email signup attempt:', { email, username });
    
    // Check if Firebase Admin is properly initialized
    if (!admin.apps.length) {
      console.error('[AUTH-SIMPLE] Firebase Admin not initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    
    // Create Firebase user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username
    });
    
    console.log('[AUTH-SIMPLE] Firebase user created:', userRecord.uid);
    
    // Create user document in Firestore
    const userData = {
      uid: userRecord.uid,
      email: email,
      username: username,
      created_at: new Date(),
      last_active: new Date(),
      auth_method: 'email'
    };
    
    await admin.firestore()
      .collection('users')
      .doc(userRecord.uid)
      .set(userData);
    
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
