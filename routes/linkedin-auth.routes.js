// linkedin-auth.routes.js - LinkedIn OpenID Connect Authentication
import express from 'express';
import { admin } from '../services/firebase-admin.js';

const router = express.Router();

// LinkedIn OAuth 2.0 / OIDC Configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;

// Support both Northflank production and local development
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3001';
const REDIRECT_URI = `${APP_URL}/api/auth/linkedin/callback`;

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Find or create user based on LinkedIn sub (unique ID)
 */
async function findOrCreateLinkedInUser(linkedinData) {
  const { sub, email, name, picture } = linkedinData;
  const usersRef = admin.firestore().collection('users');

  // Try to find existing user by LinkedIn sub
  const existingBySub = await usersRef.where('linkedin_sub', '==', sub).get();

  if (!existingBySub.empty) {
    const existingUser = existingBySub.docs[0];
    const uid = existingUser.id;

    // Update last login
    await usersRef.doc(uid).update({
      'metadata.last_login': new Date(),
      'metadata.last_active': new Date(),
    });

    return { uid, isNew: false, userData: existingUser.data() };
  }

  // If email exists, link LinkedIn to existing account
  if (email) {
    const existingByEmail = await usersRef.where('email', '==', email).get();
    if (!existingByEmail.empty) {
      const existingUser = existingByEmail.docs[0];
      const uid = existingUser.id;

      // Link LinkedIn to existing account
      await usersRef.doc(uid).update({
        linkedin_sub: sub,
        linkedin_id: sub,
        'metadata.last_login': new Date(),
        'metadata.last_active': new Date(),
        identities: admin.firestore.FieldValue.arrayUnion('linkedin'),
      });

      return { uid, isNew: false, userData: existingUser.data() };
    }
  }

  // Create new user with LinkedIn as primary identifier
  const uid = usersRef.doc().id;
  const displayName = name || (email ? email.split('@')[0] : `User_${uid.slice(-8)}`);

  const userData = {
    uid: uid,
    email: email || null,
    linkedin_sub: sub,
    linkedin_id: sub,
    linkedin_profile: {
      name,
      picture,
    },
    identities: ['linkedin'],
    metadata: {
      created_at: new Date(),
      last_login: new Date(),
      last_active: new Date(),
    },
    display_name: displayName,
    auth_type: 'linkedin',
    created_at: new Date(),
    preferences: {
      mev_alerts: true,
      yield_filters: ['stablecoins', 'high_tvl'],
      theme: 'dark',
    },
    account_level: 'free',
  };

  await usersRef.doc(uid).set(userData);

  return { uid, isNew: true, userData };
}

/**
 * GET /api/auth/linkedin - Initiate LinkedIn OAuth flow
 */
router.get('/', (req, res) => {
  try {
    if (!LINKEDIN_CLIENT_ID) {
      return res.status(500).json({ error: 'LinkedIn client ID not configured' });
    }

    const state = generateState();

    // Store state in a temporary cookie or session for validation
    res.cookie('linkedin_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000, // 10 minutes
      sameSite: 'lax',
    });

    const scope = encodeURIComponent('openid profile email');
    const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&scope=${scope}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('[LinkedIn Auth] Initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate LinkedIn authentication' });
  }
});

/**
 * GET /api/auth/linkedin/callback - Handle LinkedIn OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle OAuth errors from LinkedIn
    if (oauthError) {
      console.error('[LinkedIn Auth] OAuth error:', oauthError, error_description);
      return res.redirect(`/auth/error?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      return res.redirect('/auth/error?error=missing_authorization_code');
    }

    // Validate state parameter for CSRF protection
    const storedState = req.cookies?.linkedin_oauth_state;
    if (!storedState || storedState !== state) {
      return res.redirect('/auth/error?error=invalid_state');
    }

    // Clear the state cookie
    res.clearCookie('linkedin_oauth_state');

    // Exchange authorization code for access token
    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('[LinkedIn Auth] Token exchange error:', errorBody);
      return res.redirect('/auth/error?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, id_token } = tokenData;

    // Fetch user info using access token (OIDC userinfo endpoint)
    const userInfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorBody = await userInfoResponse.text();
      console.error('[LinkedIn Auth] User info fetch error:', errorBody);
      return res.redirect('/auth/error?error=user_info_fetch_failed');
    }

    const userInfo = await userInfoResponse.json();

    // Extract user data from OIDC claims
    const linkedinData = {
      sub: userInfo.sub, // LinkedIn's unique identifier for the user
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
    };

    // Find or create user in our database
    const { uid } = await findOrCreateLinkedInUser(linkedinData);

    // Create Firebase custom token for client-side authentication
    const customToken = await admin.auth().createCustomToken(uid);

    // Redirect to frontend with custom token
    // The frontend will use this token to sign in with Firebase
    const redirectUrl = new URL('/auth/callback', REDIRECT_URI.replace('/api/auth/linkedin/callback', ''));
    redirectUrl.searchParams.set('token', customToken);
    redirectUrl.searchParams.set('provider', 'linkedin');

    res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('[LinkedIn Auth] Callback error:', error);
    res.redirect('/auth/error?error=authentication_failed');
  }
});

/**
 * POST /api/auth/linkedin/exchange - Exchange LinkedIn tokens for Firebase custom token
 * Alternative flow for client-side token exchange
 */
router.post('/exchange', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Missing access token' });
    }

    // Fetch user info from LinkedIn
    const userInfoResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    const userInfo = await userInfoResponse.json();

    const linkedinData = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    };

    const { uid, isNew } = await findOrCreateLinkedInUser(linkedinData);
    const customToken = await admin.auth().createCustomToken(uid);

    res.json({
      success: true,
      customToken,
      uid,
      isNew,
      user: {
        uid,
        email: linkedinData.email,
        displayName: linkedinData.name,
        photoURL: linkedinData.picture,
      },
    });

  } catch (error) {
    console.error('[LinkedIn Auth] Exchange error:', error);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

export default router;
