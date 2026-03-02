// SimpleAuthScreen.js - Clean, simple authentication UI
function SimpleAuthScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    username: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error on input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!window.AuthPipeline0_5) {
        throw new Error('Authentication system not loaded');
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
        console.log('[SimpleAuthScreen] Authentication successful');
        if (onAuthSuccess) {
          onAuthSuccess(result.user);
        }
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('[SimpleAuthScreen] Auth error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setFormData({ email: '', password: '', username: '' });
  };

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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="••••••••"
              minLength="6"
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
        </form>

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

        <div style={{
          textAlign: 'center',
          marginTop: '1rem',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          CryptoExplorer v0.5 - Simple Auth
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
