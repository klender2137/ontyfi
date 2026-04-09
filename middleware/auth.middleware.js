// auth.middleware.js - Authentication middleware for LinkedIn OIDC sessions
import { admin } from '../services/firebase-admin.js';

/**
 * Middleware to verify Firebase authentication token (LinkedIn OIDC session)
 * Replaces wallet-based authentication with session-based authentication
 * Maps LinkedIn sub as primary user identifier
 */
export async function verifyLinkedInAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Please sign in with LinkedIn to access this resource'
      });
    }

    const token = authHeader.split('Bearer ')[1];

    // Verify Firebase ID token (LinkedIn creates custom tokens in Firebase)
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Attach user info to request
    req.user = decodedToken;
    req.userId = decodedToken.uid;

    // Fetch user document to verify LinkedIn authentication
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Please complete LinkedIn authentication first'
      });
    }

    const userData = userDoc.data();

    // Verify LinkedIn is the primary authentication method
    if (!userData.linkedin_sub && !userData.identities?.includes('linkedin')) {
      return res.status(403).json({
        error: 'LinkedIn authentication required',
        message: 'This resource requires LinkedIn OAuth authentication'
      });
    }

    // Attach LinkedIn sub as primary identifier
    req.linkedinSub = userData.linkedin_sub || null;
    req.userData = userData;

    next();
  } catch (error) {
    console.error('[Auth Middleware] Verification error:', error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please sign in again with LinkedIn'
      });
    }

    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        error: 'Token revoked',
        message: 'Your session has been revoked. Please sign in again'
      });
    }

    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication failed. Please sign in with LinkedIn'
    });
  }
}

/**
 * Middleware to check if user has completed the Finance Questionnaire
 */
export async function requireQuestionnaireComplete(req, res, next) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userDoc = await admin.firestore().collection('users').doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Check if questionnaire is completed
    if (!userData.fi_result || !userData.fi_result.completedAt) {
      return res.status(403).json({
        error: 'Questionnaire required',
        message: 'Please complete the Finance Fit Questionnaire to access this resource',
        redirectTo: '/archetype-diagnostic'
      });
    }

    req.fiResult = userData.fi_result;
    next();
  } catch (error) {
    console.error('[Auth Middleware] Questionnaire check error:', error);
    return res.status(500).json({ error: 'Failed to verify questionnaire status' });
  }
}

/**
 * Optional auth middleware - attaches user if token present, doesn't fail if missing
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.userId = null;
      return next();
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    // Silently fail for optional auth
    req.user = null;
    req.userId = null;
    next();
  }
}
