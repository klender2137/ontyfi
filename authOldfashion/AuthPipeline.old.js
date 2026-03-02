// AuthPipeline.js - Unified authentication pipeline with Custom Token Architecture
// Handles user authentication, data processing with server-side encryption, and Firebase integration

class AuthPipeline {
  constructor() {
    this.firebase = window.firebase;

    this.signupRegular = async (email, password, username) => {
      try {
        console.log('[AuthPipeline] Starting regular signup');

        // First, create user via API
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Signup failed');
        }

        console.log('[AuthPipeline] User created, now signing in');

        // Now sign in
        return await this.authenticateRegular(email, password);
      } catch (error) {
        console.error('[AuthPipeline] Regular signup failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.authenticateRegular = async (email, password) => {
      try {
        console.log('[AuthPipeline] Starting regular authentication');

        // Firebase auth
        const result = await this.firebase.auth().signInWithEmailAndPassword(email, password);

        const userId = result.user.uid;
        const userData = {
          authMethod: 'regular',
          email: email,
          displayName: result.user.displayName || '',
          uid: userId,
          lastLogin: new Date().toISOString(),
          linkedAccounts: ['regular']
        };

        // Process and store user data
        await this.processUserData(userId, userData);

        console.log('[AuthPipeline] Regular authentication successful');
        return { success: true, user: result.user, userData };
      } catch (error) {
        console.error('[AuthPipeline] Regular authentication failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.authenticateMetaMask = async () => {
      try {
        console.log('[AuthPipeline] Starting MetaMask authentication');

        if (!window.ethereum) {
          throw new Error('MetaMask extension not found. Please install MetaMask from https://metamask.io/');
        }

        // Check if it's MetaMask specifically
        if (!window.ethereum.isMetaMask) {
          throw new Error('Please use MetaMask. Other wallets may not be compatible.');
        }

        // Get server-side nonce
        const nonceResponse = await fetch('/api/auth/nonce');
        const { nonce } = await nonceResponse.json();

        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // Generate SIWE message with nonce
        const siweMessage = new SiweMessage({
          domain: window.location.host,
          address: address,
          statement: 'Sign in to CryptoExplorer',
          uri: window.location.origin,
          version: '1',
          chainId: 1,
          nonce: nonce
        });

        const message = siweMessage.prepareMessage();

        // Sign message
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });

        // Verify and authenticate
        const result = await this.verifyWeb3Auth(message, signature, address, 'evm');
        if (result.success) {
          // Update user data with wallet
          const userData = {
            authMethod: 'metamask',
            walletAddress: address,
            uid: result.user.uid,
            lastLogin: new Date().toISOString(),
            linkedAccounts: ['metamask']
          };
          await this.processUserData(result.user.uid, userData);

          console.log('[AuthPipeline] MetaMask authentication successful');
          return result;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('[AuthPipeline] MetaMask authentication failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.authenticatePhantom = async () => {
      try {
        console.log('[AuthPipeline] Starting Phantom authentication');

        if (!window.solana || !window.solana.isPhantom) {
          throw new Error('Phantom wallet not found. Please install Phantom from https://phantom.app/');
        }

        // Get server-side nonce
        const nonceResponse = await fetch('/api/auth/nonce');
        const { nonce } = await nonceResponse.json();

        const response = await window.solana.connect();
        const address = response.publicKey.toString();

        // Generate custom message with nonce
        const message = `CryptoExplorer Authentication. Address: ${address}. Nonce: ${nonce}. Timestamp: ${Date.now()}`;

        // Sign message
        const encodedMessage = new TextEncoder().encode(message);
        const signed = await window.solana.signMessage(encodedMessage, 'utf8');
        const signature = Array.from(signed.signature).map(b => b.toString(16).padStart(2, '0')).join('');

        // Verify and authenticate
        const result = await this.verifyWeb3Auth(message, signature, address, 'solana');
        if (result.success) {
          // Update user data with wallet
          const userData = {
            authMethod: 'phantom',
            walletAddress: address,
            uid: result.user.uid,
            lastLogin: new Date().toISOString(),
            linkedAccounts: ['phantom']
          };
          await this.processUserData(result.user.uid, userData);

          console.log('[AuthPipeline] Phantom authentication successful');
          return result;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('[AuthPipeline] Phantom authentication failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.authenticateTrustWallet = async () => {
      try {
        console.log('[AuthPipeline] Starting Trust Wallet authentication');

        if (!window.ethereum || !window.ethereum.isTrust) {
          throw new Error('Trust Wallet not found. Please install Trust Wallet from https://trustwallet.com/');
        }

        // Get server-side nonce
        const nonceResponse = await fetch('/api/auth/nonce');
        const { nonce } = await nonceResponse.json();

        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // Generate SIWE message with nonce
        const siweMessage = new SiweMessage({
          domain: window.location.host,
          address: address,
          statement: 'Sign in to CryptoExplorer',
          uri: window.location.origin,
          version: '1',
          chainId: 1,
          nonce: nonce
        });

        const message = siweMessage.prepareMessage();

        // Sign message
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });

        // Verify and authenticate
        const result = await this.verifyWeb3Auth(message, signature, address, 'evm');
        if (result.success) {
          // Update user data with wallet
          const userData = {
            authMethod: 'trust',
            walletAddress: address,
            uid: result.user.uid,
            lastLogin: new Date().toISOString(),
            linkedAccounts: ['trust']
          };
          await this.processUserData(result.user.uid, userData);

          console.log('[AuthPipeline] Trust Wallet authentication successful');
          return result;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error('[AuthPipeline] Trust Wallet authentication failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.verifyWeb3Auth = async (message, signature, address, chainType) => {
      try {
        console.log('[AuthPipeline] Verifying Web3 auth');

        // Send to backend
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            signature,
            address,
            chainId: chainType === 'solana' ? 'solana' : '1'
          })
        });

        const result = await response.json();

        if (!response.ok || !result.customToken) {
          throw new Error(result.error || 'Verification failed');
        }

        // Sign in with Firebase
        const authResult = await this.firebase.auth().signInWithCustomToken(result.customToken);

        console.log('[AuthPipeline] Web3 verification successful');
        return { success: true, user: authResult.user };
      } catch (error) {
        console.error('[AuthPipeline] Web3 verification failed:', error);
        return { success: false, error: error.message };
      }
    };

    this.logActivity = async (hustleId) => {
      try {
        const user = this.firebase.auth().currentUser;
        if (!user) return;

        await fetch('/api/auth/logActivity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, hustleId })
        });

        console.log('[AuthPipeline] Activity logged');
      } catch (error) {
        console.error('[AuthPipeline] Failed to log activity:', error);
      }
    };

    this.getActivity = async () => {
      try {
        const user = this.firebase.auth().currentUser;
        if (!user) return [];

        const data = await this.fetchUserData(user.uid);
        return data ? data.hustleHistory || [] : [];
      } catch (error) {
        console.error('[AuthPipeline] Failed to get activity:', error);
        return [];
      }
    };

    this.signOut = async () => {
      try {
        await this.firebase.auth().signOut();
        console.log('[AuthPipeline] Signed out');
      } catch (error) {
        console.error('[AuthPipeline] Sign out failed:', error);
      }
    };

    this.init = (onUserData) => {
      this.firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          const data = await this.fetchUserData(user.uid);
          if (onUserData) onUserData(data);
        } else {
          if (onUserData) onUserData(null);
        }
      });
    };
  }

  // Server-side data processing
  async processUserData(userId, userData) {
    try {
      await fetch('/api/auth/storeUserData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: userId, userData })
      });

      console.log('[AuthPipeline] User data processed and stored');
    } catch (error) {
      console.error('[AuthPipeline] Error processing user data:', error);
      throw error;
    }
  }

  // Fetch user data from server
  async fetchUserData(userId) {
    try {
      const response = await fetch(`/api/auth/fetchUserData?uid=${userId}`);
      const result = await response.json();
      return result.userData;
    } catch (error) {
      console.error('[AuthPipeline] Error fetching user data:', error);
      return null;
    }
  }
}

// Create singleton instance
const authPipeline = new AuthPipeline();

// Export for global use
if (typeof window !== 'undefined') {
  window.AuthPipeline = authPipeline;
}
