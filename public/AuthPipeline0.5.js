// AuthPipeline0.5.js - Simple Authentication Pipeline
// Clean, working auth system with username, password, email only

class AuthPipeline0_5 {
  constructor() {
    console.log('[AuthPipeline0.5] Initializing Simple Auth Pipeline...');
    
    this.currentUser = null;
    this.authStateListeners = [];
    this._initializing = true;
    this._hasResolvedAuthState = false;
    this._initError = null;
    
    // Check Firebase availability
    if (typeof window !== 'undefined' && window.firebase) {
      this.firebase = window.firebase;
      console.log('[AuthPipeline0.5] ✅ Firebase available');
    } else {
      console.error('[AuthPipeline0.5] ❌ Firebase not available');
      this.firebase = null;
      this._initError = new Error('Firebase not available');
    }

    // Don't set up auth observer here - let main.js handle it
    // Just check current auth state
    try {
      if (this.firebase?.auth) {
        const auth = this.firebase.auth();
        const currentUser = auth.currentUser;
        this.currentUser = currentUser;
        this._hasResolvedAuthState = true;
        this._initializing = false;
        console.log('[AuthPipeline0.5] Initial auth state:', currentUser ? 'User logged in' : 'User logged out');
      } else {
        this._initializing = false;
        this._hasResolvedAuthState = true;
      }
    } catch (e) {
      this._hasResolvedAuthState = true;
      this._initializing = false;
      this._initError = e;
    }
    
    console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 initialized');
  }

  _mapFirebaseAuthError(error) {
    const rawMessage = error?.message || '';
    // Firebase v8 sometimes embeds Identity Toolkit errors as a JSON string in `error.message`
    // while setting `error.code` to auth/internal-error.
    try {
      if (rawMessage && rawMessage.trim().startsWith('{')) {
        const parsed = JSON.parse(rawMessage);
        const itMessage = parsed?.error?.message;
        if (typeof itMessage === 'string' && itMessage) {
          if (itMessage === 'CONFIGURATION_NOT_FOUND') {
            return 'Firebase Authentication is not configured for this project (CONFIGURATION_NOT_FOUND). Enable Email/Password and Google providers in Firebase Console and ensure your Web API key is valid/unrestricted.';
          }

          // Identity Toolkit variants
          if (itMessage === 'INVALID_LOGIN_CREDENTIALS' || itMessage === 'INVALID_PASSWORD') {
            return 'Invalid email or password. If you do not have an account yet, switch to Sign Up.';
          }
          if (itMessage === 'EMAIL_NOT_FOUND') {
            return 'No account found with this email address. Switch to Sign Up to create one.';
          }
          if (itMessage === 'USER_DISABLED') {
            return 'This account has been disabled.';
          }
          if (itMessage === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
            return 'Too many attempts. Please try again later.';
          }

          // fallback: show raw ITK message
          return itMessage;
        }
      }
    } catch {
      // ignore JSON parse errors
    }

    const configNotFound = /CONFIGURATION_NOT_FOUND/i.test(rawMessage);
    if (configNotFound) {
      return 'Firebase Authentication is not configured for this project (CONFIGURATION_NOT_FOUND). Enable Email/Password and Google providers in Firebase Console and ensure your Web API key is valid/unrestricted.';
    }
    return error?.message || 'Authentication failed';
  }

  async _signInWithCustomToken(token) {
    if (!this.firebase?.auth) {
      throw new Error('Firebase not available');
    }
    if (!token) {
      throw new Error('Missing custom token');
    }
    const auth = this.firebase.auth();
    const credential = await auth.signInWithCustomToken(token);
    this.currentUser = credential?.user || auth.currentUser || null;
    return this.currentUser;
  }

  isInitializing() {
    return !!this._initializing;
  }

  hasResolvedAuthState() {
    return !!this._hasResolvedAuthState;
  }

  getInitError() {
    return this._initError ? (this._initError.message || String(this._initError)) : null;
  }

  /**
   * Global Auth State Observer
   */
  onAuthStateChanged(callback) {
    if (!this.firebase) {
      console.error('[AuthPipeline0.5] Firebase not available for auth state changes');
      return;
    }

    // Just set up a simple listener without managing internal state
    this.firebase.auth().onAuthStateChanged(async (user) => {
      console.log('[AuthPipeline0.5] Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      // Update internal state to match
      this.currentUser = user;
      this._hasResolvedAuthState = true;
      this._initializing = false;
      
      if (user) {
        await this.syncUserData(user);
      }
      
      callback(user);
    });
  }

  /**
   * Sync user data from Firestore
   */
  async syncUserData(user) {
    try {
      const userDoc = await this.firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        this.currentUserProfile = {
          uid: user.uid,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          created_at: userData.created_at,
          last_active: userData.last_active
        };
        console.log('[AuthPipeline0.5] ✅ User data synced:', this.currentUserProfile);
      }
    } catch (error) {
      console.error('[AuthPipeline0.5] Failed to sync user data:', error);
    }
  }

  async _initializeUserRole(userId, email, username) {
    try {
      console.log('[AuthPipeline0.5] Initializing user role:', { userId, email, username });
      
      // Check predefined role lists
      const adminList = await this._loadRoleList('admins');
      const memberList = await this._loadRoleList('members');
      
      let assignedRole = 'user'; // Default role
      
      // Check admin list
      if (this._isInRoleList(adminList, username, email)) {
        assignedRole = 'admin';
        console.log('[AuthPipeline0.5] User assigned admin role');
      }
      // Check member list
      else if (this._isInRoleList(memberList, username, email)) {
        assignedRole = 'member';
        console.log('[AuthPipeline0.5] User assigned member role');
      }
      
      // Set role in both users collection and user_roles collection
      const firestore = this.firebase.firestore();
      
      // Update users collection
      await firestore.collection('users').doc(userId).update({
        role: assignedRole,
        role_assigned_at: new Date()
      });
      
      // Set in user_roles collection for role management
      await firestore.collection('user_roles').doc(userId).set({
        role: assignedRole,
        assignedAt: new Date(),
        assignedBy: 'system',
        email: email,
        username: username
      });
      
      console.log(`[AuthPipeline0.5] Role ${assignedRole} assigned to user ${username}`);
      return assignedRole;
      
    } catch (error) {
      console.error('[AuthPipeline0.5] Error initializing user role:', error);
      // Default to user role on error
      try {
        await this.firebase.firestore().collection('user_roles').doc(userId).set({
          role: 'user',
          assignedAt: new Date(),
          assignedBy: 'system'
        });
      } catch (fallbackError) {
        console.error('[AuthPipeline0.5] Fallback role assignment failed:', fallbackError);
      }
      return 'user';
    }
  }

  async _loadRoleList(roleName) {
    try {
      // In a real implementation, this would fetch from the roles files
      // For now, using hardcoded values from the files we created
      if (roleName === 'admins') {
        return ['fokenstart / calliduschalk@gmail.com'];
      } else if (roleName === 'members') {
        return []; // Empty for now
      }
      return [];
    } catch (error) {
      console.error(`[AuthPipeline0.5] Error loading ${roleName} list:`, error);
      return [];
    }
  }

  _isInRoleList(roleList, username, email) {
    return roleList.some(entry => {
      const [listUsername, listEmail] = entry.split(' / ').map(s => s.trim());
      return (listUsername && listUsername === username) || 
             (listEmail && listEmail === email);
    });
  }

  async sendPasswordReset(email) {
    if (!this.firebase?.auth) {
      throw new Error('Firebase not available');
    }
    const emailNorm = String(email || '').trim();
    if (!emailNorm || !emailNorm.includes('@')) {
      throw new Error('Please enter a valid email address');
    }
    await this.firebase.auth().sendPasswordResetEmail(emailNorm);
    return true;
  }

  /**
   * Simple Email Sign Up
   */
  async signUp(email, password, username) {
    try {
      console.log('[AuthPipeline0.5] Starting sign up:', { email, username });

      if (!this.firebase) {
        throw new Error('Firebase not available');
      }

      if (!email || !password || !username) {
        throw new Error('All fields are required');
      }

      const emailNorm = String(email).trim().toLowerCase();
      const usernameNorm = String(username).trim();
      const passwordNorm = String(password);

      if (!emailNorm.includes('@')) {
        throw new Error('Invalid email address format.');
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
        throw new Error('Password must be 6-12 characters and include uppercase, lowercase, number, symbol, and no spaces.');
      }

      if (usernameNorm.length < 3) {
        throw new Error('Username must be at least 3 characters');
      }

      const auth = this.firebase.auth();
      
      // Create user in Firebase Auth
      const userCredential = await auth.createUserWithEmailAndPassword(emailNorm, passwordNorm);
      
      // Update display name
      await userCredential.user.updateProfile({
        displayName: usernameNorm
      });

      // Create user document in Firestore with error handling
      const userData = {
        uid: userCredential.user.uid,
        email: emailNorm,
        username: usernameNorm,
        display_name: usernameNorm,
        role: 'user', // Will be updated by role manager
        created_at: new Date(),
        last_active: new Date(),
        auth_method: 'email'
      };

      try {
        await this.firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .set(userData, { merge: true });
        
        // Initialize user role based on predefined lists
        await this._initializeUserRole(userCredential.user.uid, emailNorm, usernameNorm);
      } catch (firestoreError) {
        console.warn('[AuthPipeline0.5] Could not create user document:', firestoreError);
        // Continue anyway - auth was successful
      }

      console.log('[AuthPipeline0.5] Sign up successful');
      return { success: true, user: userCredential.user };

    } catch (error) {
      console.error('[AuthPipeline0.5] Sign up failed:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = error.message;
      if (error.code === 'auth/internal-error') {
        errorMessage = this._mapFirebaseAuthError(error);
      }
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = 'Authentication service is not properly configured. Please contact support.';
      }
      
      return { success: false, error: errorMessage, code: error.code };
    }
  }

  /**
   * Simple Email Sign In
   */
  async signIn(email, password) {
    try {
      console.log('[AuthPipeline0.5] Starting sign in:', { email });

      if (!this.firebase) {
        throw new Error('Firebase not available');
      }

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const emailNorm = String(email).trim().toLowerCase();
      const passwordNorm = String(password);

      if (!emailNorm.includes('@')) {
        throw new Error('Invalid email address format.');
      }

      const auth = this.firebase.auth();
      
      // Check if user already exists and is signed in
      if (auth.currentUser) {
        console.log('[AuthPipeline0.5] User already signed in:', auth.currentUser.email);
        return { success: true, user: auth.currentUser };
      }

      const userCredential = await auth.signInWithEmailAndPassword(emailNorm, passwordNorm);
      
      // Update last active in Firestore
      try {
        await this.firebase.firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .update({
            last_active: new Date()
          });
      } catch (firestoreError) {
        console.warn('[AuthPipeline0.5] Could not update last_active:', firestoreError);
        // Continue anyway - auth was successful
      }

      console.log('[AuthPipeline0.5] Sign in successful');
      return { success: true, user: userCredential.user };

    } catch (error) {
      console.error('[AuthPipeline0.5] Sign in failed:', error);
      
      // Handle specific Firebase auth errors
      let errorMessage = error.message;
      if (error.code === 'auth/internal-error') {
        errorMessage = this._mapFirebaseAuthError(error);
      }
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/configuration-not-found') {
        errorMessage = 'Authentication service is not properly configured. Please contact support.';
      }
      
      return { success: false, error: errorMessage, code: error.code };
    }
  }

  /**
   * Google OAuth Sign In
   */
  async signInWithGoogle() {
    try {
      console.log('[AuthPipeline0.5] Starting Google sign in...');

      if (!this.firebase) {
        throw new Error('Firebase not available');
      }

      const auth = this.firebase.auth();
      const provider = new this.firebase.auth.GoogleAuthProvider();
      
      const userCredential = await auth.signInWithPopup(provider);
      
      // Create or update user document in Firestore
      const userData = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        username: userCredential.user.displayName || userCredential.user.email.split('@')[0],
        created_at: new Date(),
        last_active: new Date(),
        auth_method: 'google',
        profile_picture: userCredential.user.photoURL
      };

      await this.firebase.firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .set(userData, { merge: true });

      console.log('[AuthPipeline0.5] Google sign in successful');
      return { success: true, user: userCredential.user };

    } catch (error) {
      console.error('[AuthPipeline0.5] Google sign in failed:', error);
      
      let errorMessage = error.message;
      if (error.code === 'auth/internal-error') {
        errorMessage = this._mapFirebaseAuthError(error);
      }
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign-in popup was closed before completion.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Sign-in popup was blocked by browser. Please allow popups.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = 'Sign-in was cancelled.';
      }
      
      return { success: false, error: errorMessage, code: error.code };
    }
  }

  async signInWithPhantom() {
    try {
      console.log('[AuthPipeline0.5] Starting Phantom sign in...');

      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not detected');
      }
      if (!this.firebase) {
        throw new Error('Firebase not available');
      }
      if (!window.solana.signMessage) {
        throw new Error('Wallet does not support message signing');
      }

      const connectRes = await window.solana.connect();
      const publicKey = connectRes?.publicKey || window.solana.publicKey;
      const walletAddress = publicKey?.toString?.() || publicKey?.toBase58?.();
      if (!walletAddress) {
        throw new Error('Unable to read wallet address');
      }

      const nonceRes = await fetch(`/api/solana-auth/nonce?walletAddress=${encodeURIComponent(walletAddress)}`);
      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to request nonce');
      }
      const { message } = await nonceRes.json();
      if (!message) {
        throw new Error('Nonce message missing');
      }

      const messageBytes = new TextEncoder().encode(message);
      const signed = await window.solana.signMessage(messageBytes, 'utf8');
      const signatureBytes = signed?.signature;
      if (!signatureBytes) {
        throw new Error('Signature missing');
      }

      const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));
      const verifyRes = await fetch('/api/solana-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signatureBase64, message }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to verify signature');
      }
      const { token } = await verifyRes.json();
      const user = await this._signInWithCustomToken(token);

      console.log('[AuthPipeline0.5] Phantom sign in successful');
      return { success: true, user };
    } catch (error) {
      console.error('[AuthPipeline0.5] Phantom sign in failed:', error);
      return { success: false, error: error?.message || 'Phantom authentication failed' };
    }
  }

  async signInWithEthereum() {
    try {
      console.log('[AuthPipeline0.5] Starting Ethereum sign in...');

      if (!window.ethereum) {
        throw new Error('Ethereum wallet not detected');
      }
      if (!window.SiweMessage) {
        throw new Error('SIWE library not loaded');
      }
      if (!window.ethers) {
        throw new Error('ethers library not loaded');
      }

      const nonceRes = await fetch('/api/ethereum-auth/nonce');
      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to request nonce');
      }
      const { nonce } = await nonceRes.json();
      if (!nonce) {
        throw new Error('Nonce missing');
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new window.ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();

      const network = await provider.getNetwork();
      const siweMessage = new window.SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to OntyFi',
        uri: window.location.origin,
        version: '1',
        chainId: String(network?.chainId || 1),
        nonce,
      });

      const message = siweMessage.prepareMessage();
      const signature = await signer.signMessage(message);

      const verifyRes = await fetch('/api/ethereum-auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to verify signature');
      }
      const { token } = await verifyRes.json();
      const user = await this._signInWithCustomToken(token);

      console.log('[AuthPipeline0.5] Ethereum sign in successful');
      return { success: true, user };
    } catch (error) {
      console.error('[AuthPipeline0.5] Ethereum sign in failed:', error);
      return { success: false, error: error?.message || 'Ethereum authentication failed' };
    }
  }

  /**
   * Guest Mode Sign In (no Firebase required)
   */
  async signInAsGuest() {
    try {
      console.log('[AuthPipeline0.5] Starting guest sign in...');

      // Create a guest user object
      const guestUser = {
        uid: 'guest-' + Date.now(),
        email: 'guest@ontyfi.local',
        username: 'Guest User',
        isGuest: true,
        created_at: new Date(),
        auth_method: 'guest'
      };

      // Store guest data in localStorage
      localStorage.setItem('cryptoExplorer.guestData', JSON.stringify(guestUser));
      localStorage.setItem('cryptoExplorer.guestMode', 'true');

      console.log('[AuthPipeline0.5] Guest sign in successful');
      return { success: true, user: guestUser };

    } catch (error) {
      console.error('[AuthPipeline0.5] Guest sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if current user is guest
   */
  isGuestUser() {
    try {
      return localStorage.getItem('cryptoExplorer.guestMode') === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get guest user data
   */
  getGuestUserData() {
    try {
      const guestData = localStorage.getItem('cryptoExplorer.guestData');
      return guestData ? JSON.parse(guestData) : null;
    } catch {
      return null;
    }
  }
  /**
   * Sign out user
   */
  async signOut() {
    try {
      // Handle guest sign out
      if (this.isGuestUser()) {
        localStorage.removeItem('cryptoExplorer.guestData');
        localStorage.removeItem('cryptoExplorer.guestMode');
        this.currentUser = null;
        this.currentUserProfile = null;
        console.log('[AuthPipeline0.5] Guest user signed out successfully');
        return;
      }

      // Handle Firebase sign out
      if (!this.firebase) {
        console.error('[AuthPipeline0.5] Firebase not available for sign out');
        return;
      }

      await this.firebase.auth().signOut();
      this.currentUser = null;
      this.currentUserProfile = null;
      console.log('[AuthPipeline0.5] User signed out successfully');
    } catch (error) {
      console.error('[AuthPipeline0.5] Sign out failed:', error);
    }
  }

  /**
   * Get current user profile
   */
  getCurrentUser() {
    return this.currentUserProfile || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }
}

// Create singleton instance
let authPipeline0_5;
try {
  console.log('[AuthPipeline0.5] Creating AuthPipeline0.5 instance...');
  
  // Validate Firebase is available before creating instance
  if (typeof window !== 'undefined' && window.firebase) {
    authPipeline0_5 = new AuthPipeline0_5();
    console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 instance created successfully');
  } else {
    console.warn('[AuthPipeline0.5] ⚠️ Firebase not available, creating fallback instance');
    // Create a fallback instance that works without Firebase
    authPipeline0_5 = {
      signUp: async (email, password, username) => { 
        throw new Error('Authentication service not available. Please check your internet connection and refresh the page.'); 
      },
      signIn: async (email, password) => { 
        throw new Error('Authentication service not available. Please check your internet connection and refresh the page.'); 
      },
      signInWithGoogle: async () => { 
        throw new Error('Authentication service not available. Please check your internet connection and refresh the page.'); 
      },
      signInAsGuest: async () => {
        const guestUser = {
          uid: 'guest-' + Date.now(),
          email: 'guest@ontyfi.local',
          username: 'Guest User',
          isGuest: true,
          created_at: new Date(),
          auth_method: 'guest'
        };
        localStorage.setItem('cryptoExplorer.guestData', JSON.stringify(guestUser));
        localStorage.setItem('cryptoExplorer.guestMode', 'true');
        return { success: true, user: guestUser };
      },
      signOut: async () => {
        if (localStorage.getItem('cryptoExplorer.guestMode') === 'true') {
          localStorage.removeItem('cryptoExplorer.guestData');
          localStorage.removeItem('cryptoExplorer.guestMode');
        }
      },
      isAuthenticated: () => false,
      getCurrentUser: () => null,
      isGuestUser: () => localStorage.getItem('cryptoExplorer.guestMode') === 'true',
      getGuestUserData: () => {
        try {
          const guestData = localStorage.getItem('cryptoExplorer.guestData');
          return guestData ? JSON.parse(guestData) : null;
        } catch {
          return null;
        }
      },
      isInitializing: () => false,
      hasResolvedAuthState: () => true,
      getInitError: () => 'Firebase not available'
    };
  }
} catch (error) {
  console.error('[AuthPipeline0.5] ❌ Failed to create AuthPipeline0.5 instance:', error);
  // Create a minimal fallback to prevent crashes
  authPipeline0_5 = {
    signUp: async () => { 
      throw new Error(`AuthPipeline0.5 initialization failed: ${error.message}. Please refresh page.`); 
    },
    signIn: async () => { 
      throw new Error(`AuthPipeline0.5 initialization failed: ${error.message}. Please refresh page.`); 
    },
    signInWithGoogle: async () => { 
      throw new Error(`AuthPipeline0.5 initialization failed: ${error.message}. Please refresh page.`); 
    },
    signInAsGuest: async () => {
      const guestUser = {
        uid: 'guest-' + Date.now(),
        email: 'guest@ontyfi.local',
        username: 'Guest User',
        isGuest: true,
        created_at: new Date(),
        auth_method: 'guest'
      };
      localStorage.setItem('cryptoExplorer.guestData', JSON.stringify(guestUser));
      localStorage.setItem('cryptoExplorer.guestMode', 'true');
      return { success: true, user: guestUser };
    },
    signOut: async () => {},
    isAuthenticated: () => false,
    getCurrentUser: () => null,
    isGuestUser: () => false,
    getGuestUserData: () => null,
    isInitializing: () => false,
    hasResolvedAuthState: () => true,
    getInitError: () => error.message
  };
}

// Export for global use
if (typeof window !== 'undefined') {
  window.AuthPipeline0_5 = authPipeline0_5;
  console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 attached to window object');
} else {
  console.error('[AuthPipeline0.5] ❌ Window object not available');
}
