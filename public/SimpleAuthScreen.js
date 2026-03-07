// SimpleAuthScreen.js - Clean, simple authentication UI with multiple sign-in methods
function SimpleAuthScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    username: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resetSent, setResetSent] = React.useState(false);
  const [authMethod, setAuthMethod] = React.useState('email'); // 'email', 'google', 'guest', 'phantom', 'ethereum'

  const passwordInfo = React.useMemo(() => {
    const pwd = String(formData.password || '');
    const lengthOk = pwd.length >= 6 && pwd.length <= 12;
    const noSpaces = !/\s/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const valid = lengthOk && noSpaces && hasLower && hasUpper && hasNumber && hasSymbol;
    const score = [hasLower, hasUpper, hasNumber, hasSymbol, lengthOk, noSpaces].filter(Boolean).length;
    const strength = score >= 6 ? 3 : score >= 4 ? 2 : 1;
    return { valid, strength, lengthOk, noSpaces, hasLower, hasUpper, hasNumber, hasSymbol };
  }, [formData.password]);

  const emailLooksValid = React.useMemo(() => {
    const e = String(formData.email || '').trim();
    return e.includes('@') && e.length >= 3;
  }, [formData.email]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error on input
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }

      if (!emailLooksValid) {
        throw new Error('Please enter a valid email address');
      }

      if (!formData.password) {
        throw new Error('Password is required');
      }

      if (isSignUp && !passwordInfo.valid) {
        throw new Error('Password must be 6-12 characters and include uppercase, lowercase, number, symbol, and no spaces.');
      }

      if (isSignUp && (!formData.username || String(formData.username).trim().length < 3)) {
        throw new Error('Username must be at least 3 characters');
      }

      let result;
      if (isSignUp) {
        result = await window.AuthPipeline0_5.signUp(
          formData.email,
          formData.password,
          formData.username
        );
      } else {
        result = await window.AuthPipeline0_5.signIn(
          formData.email,
          formData.password
        );
      }

      if (result.success) {
        console.log('[SimpleAuthScreen] Email authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Email auth error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');
    setResetSent(false);
    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }
      if (typeof window.AuthPipeline0_5.sendPasswordReset !== 'function') {
        throw new Error('Password reset not available');
      }
      await window.AuthPipeline0_5.sendPasswordReset(formData.email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handlePhantomAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }

      if (typeof window.AuthPipeline0_5.signInWithPhantom !== 'function') {
        throw new Error('Phantom authentication not available');
      }

      const result = await window.AuthPipeline0_5.signInWithPhantom();

      if (result.success) {
        console.log('[SimpleAuthScreen] Phantom authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Phantom authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Phantom auth error:', err);
      setError(err.message || 'Phantom authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEthereumAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }

      if (typeof window.AuthPipeline0_5.signInWithEthereum !== 'function') {
        throw new Error('Ethereum authentication not available');
      }

      const result = await window.AuthPipeline0_5.signInWithEthereum();

      if (result.success) {
        console.log('[SimpleAuthScreen] Ethereum authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Ethereum authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Ethereum auth error:', err);
      setError(err.message || 'Ethereum authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }

      const result = await window.AuthPipeline0_5.signInWithGoogle();

      if (result.success) {
        console.log('[SimpleAuthScreen] Google authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Google authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Google auth error:', err);
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAuth = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
      }

      const result = await window.AuthPipeline0_5.signInAsGuest();

      if (result.success) {
        console.log('[SimpleAuthScreen] Guest authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Guest authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Guest auth error:', err);
      setError(err.message || 'Guest authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setFormData({ email: '', password: '', username: '' });
    setShowForgotPassword(false);
    setResetSent(false);
    setShowPassword(false);
  };

  const switchAuthMethod = (method) => {
    setAuthMethod(method);
    setError('');
    setFormData({ email: '', password: '', username: '' });
    setShowForgotPassword(false);
    setResetSent(false);
    setShowPassword(false);
  };

  const phantomAvailable = !!(window.solana && window.solana.isPhantom);
  const ethereumAvailable = !!window.ethereum;

  return (
    <div className="screen" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        borderRadius: '16px',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '2rem',
          color: '#f7f9ff',
          fontSize: '1.5rem',
          fontWeight: '600'
        }}>
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        {/* Authentication Method Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: '1.5rem',
          background: 'rgba(30, 41, 59, 0.8)',
          borderRadius: '8px',
          padding: '4px'
        }}>
          <button
            type="button"
            onClick={() => switchAuthMethod('email')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: authMethod === 'email' ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: authMethod === 'email' ? 'white' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => switchAuthMethod('google')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: authMethod === 'google' ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: authMethod === 'google' ? 'white' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Google
          </button>
          <button
            type="button"
            onClick={() => switchAuthMethod('guest')}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: authMethod === 'guest' ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: authMethod === 'guest' ? 'white' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Guest
          </button>

          <button
            type="button"
            onClick={() => switchAuthMethod('phantom')}
            disabled={!phantomAvailable}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: authMethod === 'phantom' ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: authMethod === 'phantom' ? 'white' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: !phantomAvailable ? 'not-allowed' : 'pointer',
              opacity: !phantomAvailable ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            Phantom
          </button>

          <button
            type="button"
            onClick={() => switchAuthMethod('ethereum')}
            disabled={!ethereumAvailable}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: authMethod === 'ethereum' ? '#3b82f6' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: authMethod === 'ethereum' ? 'white' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: !ethereumAvailable ? 'not-allowed' : 'pointer',
              opacity: !ethereumAvailable ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            Wallet
          </button>
        </div>

        {authMethod === 'email' && showForgotPassword && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Enter your email and we’ll send a reset link. If you don’t see it, check spam.
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="your@email.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '8px',
                  color: '#f7f9ff',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              style={{
                padding: '0.875rem',
                background: loading ? 'rgba(148, 163, 184, 0.3)' : '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Please wait...' : 'Send reset email'}
            </button>

            {resetSent && (
              <div style={{ color: '#22c55e', fontSize: '0.875rem' }}>
                Reset email sent.
              </div>
            )}

            <button
              type="button"
              onClick={() => { setShowForgotPassword(false); setResetSent(false); setError(''); }}
              disabled={loading}
              style={{
                padding: '0.75rem',
                background: 'transparent',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Back
            </button>
          </div>
        )}

        {authMethod === 'email' && !showForgotPassword && (
          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isSignUp && (
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  color: '#94a3b8',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required={isSignUp}
                  placeholder="Choose a username"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f7f9ff',
                    fontSize: '0.875rem'
                  }}
                />
              </div>
            )}

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="your@email.com"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '8px',
                  color: '#f7f9ff',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                color: '#94a3b8',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  placeholder="•••••••••"
                  minLength="6"
                  maxLength="12"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    paddingRight: '3rem',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f7f9ff',
                    fontSize: '0.875rem'
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: '2rem',
                    width: '2rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    background: 'rgba(148, 163, 184, 0.08)',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '10px',
                padding: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>Password strength</div>
                  <div style={{ color: passwordInfo.strength === 3 ? '#22c55e' : passwordInfo.strength === 2 ? '#f59e0b' : '#ef4444', fontSize: '0.8rem', fontWeight: 700 }}>
                    {passwordInfo.strength}/3
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <div style={{ height: '6px', borderRadius: '999px', background: passwordInfo.strength >= 1 ? '#ef4444' : 'rgba(148, 163, 184, 0.25)' }} />
                  <div style={{ height: '6px', borderRadius: '999px', background: passwordInfo.strength >= 2 ? '#f59e0b' : 'rgba(148, 163, 184, 0.25)' }} />
                  <div style={{ height: '6px', borderRadius: '999px', background: passwordInfo.strength >= 3 ? '#22c55e' : 'rgba(148, 163, 184, 0.25)' }} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="primary-button"
              style={{
                padding: '0.875rem',
                background: loading ? 'rgba(148, 163, 184, 0.3)' : '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setError(''); setResetSent(false); }}
                disabled={loading}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'center'
                }}
              >
                Forgot password?
              </button>
            )}
          </form>
        )}

        {/* Google Authentication */}
        {authMethod === 'google' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#94a3b8',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              Sign in with your Google account to access CryptoExplorer
            </p>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: loading ? 'rgba(148, 163, 184, 0.3)' : '#4285f4',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>🔗</span>
              {loading ? 'Connecting...' : 'Sign in with Google'}
            </button>
          </div>
        )}

        {/* Phantom Authentication */}
        {authMethod === 'phantom' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#94a3b8',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              Sign in with Phantom (Solana) using a secure signature
            </p>
            <button
              type="button"
              onClick={handlePhantomAuth}
              disabled={loading || !phantomAvailable}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: (loading || !phantomAvailable) ? 'rgba(148, 163, 184, 0.3)' : '#8b5cf6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: (loading || !phantomAvailable) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>👻</span>
              {loading ? 'Connecting...' : (phantomAvailable ? 'Sign in with Phantom' : 'Phantom not detected')}
            </button>
          </div>
        )}

        {/* Ethereum SIWE Authentication */}
        {authMethod === 'ethereum' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#94a3b8',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              Sign in with an EVM wallet (SIWE). You will be asked to sign a message.
            </p>
            <button
              type="button"
              onClick={handleEthereumAuth}
              disabled={loading || !ethereumAvailable}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: (loading || !ethereumAvailable) ? 'rgba(148, 163, 184, 0.3)' : '#f59e0b',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: (loading || !ethereumAvailable) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>🦊</span>
              {loading ? 'Connecting...' : (ethereumAvailable ? 'Sign in with Wallet' : 'Wallet not detected')}
            </button>
          </div>
        )}

        {/* Guest Authentication */}
        {authMethod === 'guest' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#94a3b8',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              Continue as a guest to explore CryptoExplorer without creating an account
            </p>
            <button
              type="button"
              onClick={handleGuestAuth}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: loading ? 'rgba(148, 163, 184, 0.3)' : '#10b981',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>👤</span>
              {loading ? 'Preparing...' : 'Continue as Guest'}
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Email Auth Toggle */}
        {authMethod === 'email' && (
          <div style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <button
              type="button"
              onClick={toggleMode}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '0.875rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          CryptoExplorer v0.5 - Multi-Method Auth
        </div>
      </div>
    </div>
  );
}

// Export for global use
if (typeof window !== 'undefined') {
  window.SimpleAuthScreen = SimpleAuthScreen;
  console.log('[SimpleAuthScreen] ✅ SimpleAuthScreen attached to window object');
}
