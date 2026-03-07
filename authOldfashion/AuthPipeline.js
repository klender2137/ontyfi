// AuthPipeline.js - Unified Authentication Pipeline with Custom Token Architecture
// "Flawless" Pipeline Flow - All authentication methods converge at a single Backend Auth Bridge

class AuthPipeline {
  constructor() {
    console.log('[AuthPipeline] Initializing Unified Auth Pipeline...');
    
    this.currentUser = null;
    this.currentUserProfile = null;
    this.authStateListeners = [];
    
    // Check Firebase availability
    if (typeof window !== 'undefined' && window.firebase) {
      this.firebase = window.firebase;
      console.log('[AuthPipeline] ✅ Firebase available');
    } else {
      console.error('[AuthPipeline] ❌ Firebase not available');
      this.firebase = null;
    }
    
    console.log('[AuthPipeline] ✅ AuthPipeline initialized');
  }

  /**
   * Global Auth State Observer
   * Single listener for all authentication methods
   */
  onAuthStateChanged(callback) {
    if (!this.firebase) {
      console.error('[AuthPipeline] Firebase not available for auth state changes');
      return;
    }

    this.firebase.auth().onAuthStateChanged(async (user) => {
      console.log('[AuthPipeline] Auth state changed:', user ? 'User logged in' : 'User logged out');
      
      if (user) {
        // Sync user data and activity log
        await this.syncUserData(user);
      }
      
      this.currentUser = user;
      callback(user);
    });
  }

  /**
   * Sync user data and activity log from Firestore
   */
  async syncUserData(user) {
    try {
      const userDoc = await this.firebase.firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        
        // Update local state with user metrics
        this.currentUserProfile = {
          uid: user.uid,
          email: userData.email,
          username: userData.username,
          wallet_address: userData.wallet_address,
          hustle_count: userData.hustle_count || 0,
          total_points: userData.total_points || 0,
          rank: userData.rank || 'Beginner',
          last_active: userData.last_active,
          auth_method: userData.auth_method
        };

        console.log('[AuthPipeline] ✅ User data synced:', this.currentUserProfile);
      }
    } catch (error) {
      console.error('[AuthPipeline] Failed to sync user data:', error);
    }
  }

  /**
   * Email/Password Authentication
   * Uses backend custom token system with fixed permissions
   */
  async authenticateEmail(email, password, isSignup = false) {
    try {
      console.log('[AuthPipeline] Starting email authentication:', { email, isSignup });

      const endpoint = isSignup ? '/api/auth/email/signup' : '/api/auth/email/signin';
      const payload = isSignup ? { email, password, username: email.split('@')[0] } : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Email authentication failed');
      }

      // Sign in with Firebase custom token
      const authResult = await this.firebase.auth().signInWithCustomToken(result.customToken);
      
      console.log('[AuthPipeline] Email authentication successful');
      return { success: true, user: authResult.user, isNew: result.isNew };

    } catch (error) {
      console.error('[AuthPipeline] Email authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wallet Authentication - Unified Flow
   * All wallets follow same: Challenge -> Signature -> Backend Verification -> Custom Token
   */
  async authenticateWallet(walletType) {
    try {
      console.log('[AuthPipeline] Starting wallet authentication:', walletType);

      // Step 1: Get wallet provider and address
      const { provider, address } = await this.getWalletProvider(walletType);
      console.log('[AuthPipeline] Wallet connected:', { walletType, address });

      // Step 2: Request nonce from backend
      const nonceResponse = await fetch(`/api/auth/nonce?address=${address}`);
      const { nonce } = await nonceResponse.json();
      console.log('[AuthPipeline] Nonce received:', nonce);

      // Step 3: Create and sign challenge
      const { message, signature } = await this.createAndSignChallenge(provider, address, nonce, walletType);
      console.log('[AuthPipeline] Challenge signed:', { message, signature: signature.substring(0, 20) + '...' });

      // Step 4: Verify with backend and get custom token
      const verifyResponse = await fetch('/api/auth/wallet/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature,
          address,
          chainId: walletType === 'phantom' ? 'solana' : '1'
        })
      });

      const result = await verifyResponse.json();

      if (!verifyResponse.ok || !result.success) {
        throw new Error(result.error || 'Wallet verification failed');
      }

      // Step 5: Sign in with Firebase custom token
      const authResult = await this.firebase.auth().signInWithCustomToken(result.customToken);
      
      console.log('[AuthPipeline] Wallet authentication successful');
      return { success: true, user: authResult.user, isNew: result.isNew };

    } catch (error) {
      console.error('[AuthPipeline] Wallet authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create and sign challenge message
   */
  async createAndSignChallenge(provider, address, nonce, walletType) {
    if (walletType === 'phantom') {
      // Solana SIWS message
      const message = `Sign in to CryptoExplorer with your Solana wallet.\n\nDomain: ${window.location.host}\nAddress: ${address}\nStatement: Sign in with Solana to CryptoExplorer.\nURI: ${window.location.origin}\nVersion: 1\nChain ID: solana\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;
      
      const encodedMessage = new TextEncoder().encode(message);
      const signed = await provider.signMessage(encodedMessage, 'utf8');
      const signature = Array.from(signed.signature).map(b => b.toString(16).padStart(2, '0')).join('');
      
      return { message, signature };
    } else {
      // EVM SIWE message
      if (typeof window.SiweMessage === 'undefined') {
        try {
          const mod = await import('https://esm.sh/siwe@2.1.4');
          if (mod?.SiweMessage) {
            window.SiweMessage = mod.SiweMessage;
          }
        } catch (e) {
          throw new Error('SIWE library not found. Wallet SIWE auth cannot start because the SIWE browser module failed to load.');
        }
      }
      
      const siweMessage = new window.SiweMessage({
        domain: window.location.host,
        address: address,
        statement: 'Sign in to CryptoExplorer',
        uri: window.location.origin,
        version: '1',
        chainId: '1',
        nonce: nonce
      });

      const message = siweMessage.prepareMessage();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, address]
      });

      return { message, signature };
    }
  }

  /**
   * Wallet Provider Management
   */
  async getWalletProvider(walletType) {
    switch (walletType.toLowerCase()) {
      case 'metamask':
        if (!window.ethereum?.isMetaMask) {
          throw new Error('MetaMask not found. Please install MetaMask.');
        }
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { provider: window.ethereum, address: accounts[0] };

      case 'trustwallet':
        console.log('[AuthPipeline] Checking for Trust Wallet...');
        
        // Check multiple ways Trust Wallet can be detected
        let trustProvider = null;
        
        // First check Trust Wallet's own global objects
        if (window.trustwallet && window.trustwallet.isTrust) {
          trustProvider = window.trustwallet;
        } else if (window.trustWallet && window.trustWallet.isTrust) {
          trustProvider = window.trustWallet;
        } else if (window.trust && window.trust.isTrust) {
          trustProvider = window.trust;
        } else if (window.ethereum && window.ethereum.isTrust) {
          trustProvider = window.ethereum;
        } else if (window.ethereum && window.ethereum.providers) {
          const trustProviderInArray = window.ethereum.providers.find(p => p.isTrust);
          if (trustProviderInArray) {
            trustProvider = trustProviderInArray;
          }
        }
        
        if (!trustProvider) {
          throw new Error('Trust Wallet not found. Please install Trust Wallet or ensure it\'s enabled.');
        }
        
        console.log('[AuthPipeline] ✅ Trust Wallet found:', trustProvider.constructor?.name);
        
        // Try Trust Wallet specific connection methods
        let trustAccounts;
        try {
          // Method 1: Try Trust Wallet's specific method
          if (trustProvider.request) {
            trustAccounts = await trustProvider.request({ method: 'eth_requestAccounts' });
          } else if (trustProvider.enable) {
            // Method 2: Try enable() method
            await trustProvider.enable();
            trustAccounts = await trustProvider.request({ method: 'eth_accounts' });
          } else if (trustProvider.send) {
            // Method 3: Try direct send method
            trustAccounts = await new Promise((resolve, reject) => {
              trustProvider.send({ method: 'eth_requestAccounts' }, (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
          } else {
            throw new Error('Trust Wallet provider interface not recognized');
          }
        } catch (error) {
          console.error('[AuthPipeline] Trust Wallet connection failed:', error.message);
          throw new Error('Trust Wallet connection failed. Please ensure Trust Wallet is unlocked and try again.');
        }
        
        if (!trustAccounts || trustAccounts.length === 0) {
          throw new Error('No accounts found in Trust Wallet. Please unlock your wallet and try again.');
        }
        
        return { provider: trustProvider, address: trustAccounts[0] };

      case 'phantom':
        if (!window.solana?.isPhantom) {
          throw new Error('Phantom wallet not found. Please install Phantom.');
        }
        const response = await window.solana.connect();
        return { provider: window.solana, address: response.publicKey.toString() };

      default:
        throw new Error(`Unsupported wallet type: ${walletType}`);
    }
  }

  /**
   * Public Methods for UI Components
   */
  async authenticateMetaMask() {
    return await this.authenticateWallet('metamask');
  }

  async authenticatePhantom() {
    return await this.authenticateWallet('phantom');
  }

  async authenticateTrustWallet() {
    return await this.authenticateWallet('trustwallet');
  }

  async signupRegular(email, password, username) {
    try {
      const result = await this.authenticateEmail(email, password, true);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async signinRegular(email, password) {
    try {
      const result = await this.authenticateEmail(email, password, false);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    if (!this.firebase) {
      console.error('[AuthPipeline] Firebase not available for sign out');
      return;
    }

    try {
      await this.firebase.auth().signOut();
      this.currentUser = null;
      this.currentUserProfile = null;
      console.log('[AuthPipeline] User signed out successfully');
    } catch (error) {
      console.error('[AuthPipeline] Sign out failed:', error);
    }
  }

  /**
   * Get current user profile
   */
  getCurrentUser() {
    return this.currentUserProfile || null;
  }

  /**
   * Get user activity history
   */
  async getActivityHistory() {
    try {
      if (!this.currentUser) {
        return [];
      }

      const activitySnapshot = await this.firebase.firestore()
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('activity_log')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();

      return activitySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('[AuthPipeline] Failed to get activity:', error);
      return [];
    }
  }
}

// Create singleton instance
let authPipeline;
try {
  console.log('[AuthPipeline] Creating AuthPipeline instance...');
  authPipeline = new AuthPipeline();
  console.log('[AuthPipeline] ✅ AuthPipeline instance created successfully');
} catch (error) {
  console.error('[AuthPipeline] ❌ Failed to create AuthPipeline instance:', error);
  // Create a minimal fallback to prevent crashes
  authPipeline = {
    authenticateEmail: async () => { 
      throw new Error(`AuthPipeline initialization failed: ${error.message}. Please refresh page.`); 
    },
    authenticateMetaMask: async () => { 
      throw new Error(`AuthPipeline initialization failed: ${error.message}. Please refresh page.`); 
    },
    authenticatePhantom: async () => { 
      throw new Error(`AuthPipeline initialization failed: ${error.message}. Please refresh page.`); 
    },
    authenticateTrustWallet: async () => { 
      throw new Error(`AuthPipeline initialization failed: ${error.message}. Please refresh page.`); 
    },
    signupRegular: async () => { 
      throw new Error(`AuthPipeline initialization failed: ${error.message}. Please refresh page.`); 
    }
  };
}

// Export for global use
if (typeof window !== 'undefined') {
  window.AuthPipeline = authPipeline;
  console.log('[AuthPipeline] ✅ AuthPipeline attached to window object');
} else {
  console.error('[AuthPipeline] ❌ Window object not available');
}
