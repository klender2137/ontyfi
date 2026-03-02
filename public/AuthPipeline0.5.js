// AuthPipeline0.5.js - Simple Authentication Pipeline
// Clean, working auth system with username, password, email only

class AuthPipeline0_5 {
  constructor() {
    console.log('[AuthPipeline0.5] Initializing Simple Auth Pipeline...');
    
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Check Firebase availability
    if (typeof window !== 'undefined' && window.firebase) {
      this.firebase = window.firebase;
      console.log('[AuthPipeline0.5] ✅ Firebase available');
    } else {
      console.error('[AuthPipeline0.5] ❌ Firebase not available');
      this.firebase = null;
    }
    
    console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 initialized');
  }

  /**
   * Global Auth State Observer
   */
  onAuthStateChanged(callback) {
    if (!this.firebase) {
      console.error('[AuthPipeline0.5] Firebase not available for auth state changes');
      return;
    }

    this.firebase.auth().onAuthStateChanged(async (user) => {
      console.log('[AuthPipeline0.5] Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      if (user) {
        await this.syncUserData(user);
      }
      
      this.currentUser = user;
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
          created_at: userData.created_at,
          last_active: userData.last_active
        };
        console.log('[AuthPipeline0.5] ✅ User data synced:', this.currentUserProfile);
      }
    } catch (error) {
      console.error('[AuthPipeline0.5] Failed to sync user data:', error);
    }
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

      // Create user in Firebase Auth
      const userCredential = await this.firebase.auth().createUserWithEmailAndPassword(email, password);
      
      // Update display name
      await userCredential.user.updateProfile({
        displayName: username
      });

      // Create user document in Firestore
      const userData = {
        uid: userCredential.user.uid,
        email: email,
        username: username,
        created_at: new Date(),
        last_active: new Date(),
        auth_method: 'email'
      };

      await this.firebase.firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .set(userData);

      console.log('[AuthPipeline0.5] Sign up successful');
      return { success: true, user: userCredential.user };

    } catch (error) {
      console.error('[AuthPipeline0.5] Sign up failed:', error);
      return { success: false, error: error.message };
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

      const userCredential = await this.firebase.auth().signInWithEmailAndPassword(email, password);
      
      // Update last active
      await this.firebase.firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .update({
          last_active: new Date()
        });

      console.log('[AuthPipeline0.5] Sign in successful');
      return { success: true, user: userCredential.user };

    } catch (error) {
      console.error('[AuthPipeline0.5] Sign in failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    if (!this.firebase) {
      console.error('[AuthPipeline0.5] Firebase not available for sign out');
      return;
    }

    try {
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
  authPipeline0_5 = new AuthPipeline0_5();
  console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 instance created successfully');
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
    signOut: async () => { 
      throw new Error(`AuthPipeline0.5 initialization failed: ${error.message}. Please refresh page.`); 
    },
    isAuthenticated: () => false,
    getCurrentUser: () => null
  };
}

// Export for global use
if (typeof window !== 'undefined') {
  window.AuthPipeline0_5 = authPipeline0_5;
  console.log('[AuthPipeline0.5] ✅ AuthPipeline0.5 attached to window object');
} else {
  console.error('[AuthPipeline0.5] ❌ Window object not available');
}
