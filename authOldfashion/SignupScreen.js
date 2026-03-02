function SignupScreen({ onGoHome, onSignupSuccess }) {
  const [authMode, setAuthMode] = React.useState('manual'); // 'manual' or 'web3'
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [success, setSuccess] = React.useState(false);

  // Helper function to wait for AuthPipeline
  const waitForAuthPipeline = () => {
    return new Promise((resolve, reject) => {
      const checkAuthPipeline = (attempts = 0) => {
        // Check if there was a loading error
        if (window.AuthPipelineLoadError) {
          reject(new Error('Authentication system failed to load. Please refresh the page.'));
          return;
        }
        
        if (window.AuthPipeline) {
          resolve(window.AuthPipeline);
        } else if (attempts > 50) { // 5 seconds max wait
          reject(new Error('Authentication system not loaded. Please refresh the page and try again.'));
        } else {
          setTimeout(() => checkAuthPipeline(attempts + 1), 100);
        }
      };
      checkAuthPipeline();
    });
  };

  // Debug: Check if AuthPipeline is available on mount
  React.useEffect(() => {
    const checkAuthPipeline = () => {
      console.log('[SignupScreen] AuthPipeline available:', !!window.AuthPipeline);
      console.log('[SignupScreen] AuthPipelineLoadError:', !!window.AuthPipelineLoadError);
      
      if (window.AuthPipelineLoadError) {
        console.error('[SignupScreen] ❌ AuthPipeline failed to load');
        return;
      }
      
      if (window.AuthPipeline) {
        console.log('[SignupScreen] AuthPipeline methods:', Object.getOwnPropertyNames(window.AuthPipeline));
      } else {
        console.warn('[SignupScreen] AuthPipeline not yet available, retrying in 100ms...');
        setTimeout(checkAuthPipeline, 100);
      }
    };
    
    checkAuthPipeline();
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      // Wait for AuthPipeline to be available
      const authPipeline = await waitForAuthPipeline();
      console.log('[SignupScreen] AuthPipeline ready, attempting signup...');
      
      const result = await authPipeline.signupRegular(email, password, username);
      
      if (result.success) {
        console.log('[SignupScreen] ✅ Signup successful');
        setSuccess(true);
        setTimeout(() => {
          if (onSignupSuccess) onSignupSuccess(result.user);
        }, 1500);
      } else {
        console.error('[SignupScreen] ❌ Signup failed:', result.error);
        setError(result.error || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('[SignupScreen] ❌ Signup error:', error);
      setError(error.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWeb3Auth = async (method) => {
    setIsLoading(true);
    setError(null);

    try {
      // Wait for AuthPipeline to be available
      const authPipeline = await waitForAuthPipeline();

      let result;
      
      switch (method) {
        case 'metamask':
          result = await authPipeline.authenticateMetaMask();
          break;
        case 'phantom':
          result = await authPipeline.authenticatePhantom();
          break;
        case 'trust':
          result = await authPipeline.authenticateTrustWallet();
          break;
        default:
          throw new Error('Unknown auth method');
      }

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onSignupSuccess) onSignupSuccess(result.user);
        }, 2000);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Authentication error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="screen">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2>Welcome to CryptoExplorer!</h2>
          <p>Your account has been created successfully.</p>
          <p>You will be redirected shortly...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Join CryptoExplorer</h2>
        <button className="secondary-button" onClick={onGoHome}>
          ← Home
        </button>
      </div>

      {/* Auth Mode Selector */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          className={`auth-mode-button ${authMode === 'manual' ? 'active' : ''}`}
          onClick={() => setAuthMode('manual')}
        >
          Manual Signup
        </button>
        <button
          className={`auth-mode-button ${authMode === 'web3' ? 'active' : ''}`}
          onClick={() => setAuthMode('web3')}
        >
          Web3 Wallet
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#f87171'
        }}>
          {error}
        </div>
      )}

      {authMode === 'manual' ? (
        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#f7f9ff'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#f7f9ff'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#f7f9ff'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.5)',
                color: '#f7f9ff'
              }}
            />
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={isLoading}
            style={{ width: '100%', opacity: isLoading ? 0.6 : 1 }}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
      ) : (
        <div>
          <h3>Connect Your Wallet</h3>
          <p>Choose your preferred wallet to sign in securely.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
            <button className="wallet-button" onClick={() => handleWeb3Auth('metamask')}>
              🦊 Connect MetaMask
            </button>
            <button className="wallet-button" onClick={() => handleWeb3Auth('phantom')}>
              👻 Connect Phantom (Solana)
            </button>
            <button className="wallet-button" onClick={() => handleWeb3Auth('trust')}>
              🔒 Connect Trust Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

window.SignupScreen = SignupScreen;
console.log('✅ SignupScreen registered');
