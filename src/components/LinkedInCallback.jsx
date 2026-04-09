import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../services/firebase';

/**
 * LinkedInCallback Component
 * Handles the OAuth callback from LinkedIn after successful authentication
 * Exchanges the Firebase custom token for a session
 */
export default function LinkedInCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const token = searchParams.get('token');
        const provider = searchParams.get('provider');
        const errorParam = searchParams.get('error');

        // Handle errors from the backend
        if (errorParam) {
          setStatus('error');
          setError(`Authentication failed: ${errorParam}`);
          return;
        }

        // Validate token presence
        if (!token) {
          setStatus('error');
          setError('Missing authentication token');
          return;
        }

        // Verify provider
        if (provider !== 'linkedin') {
          setStatus('error');
          setError('Invalid authentication provider');
          return;
        }

        // Sign in with Firebase using the custom token
        setStatus('signing_in');
        const credential = await signInWithCustomToken(auth, token);

        console.log('[LinkedInCallback] Successfully signed in:', credential.user.uid);

        // Redirect to home or intended destination
        const redirectPath = localStorage.getItem('auth_redirect_after_login') || '/home';
        localStorage.removeItem('auth_redirect_after_login');

        setStatus('success');
        navigate(redirectPath, { replace: true });

      } catch (err) {
        console.error('[LinkedInCallback] Sign in error:', err);
        setStatus('error');
        setError(err.message || 'Failed to complete authentication');
      }
    }

    handleCallback();
  }, [searchParams, navigate]);

  // Render appropriate UI based on status
  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <div style={styles.container}>
            <div style={styles.spinner} />
            <p style={styles.text}>Processing LinkedIn authentication...</p>
          </div>
        );

      case 'signing_in':
        return (
          <div style={styles.container}>
            <div style={styles.spinner} />
            <p style={styles.text}>Signing you in...</p>
          </div>
        );

      case 'success':
        return (
          <div style={styles.container}>
            <div style={styles.successIcon}>✓</div>
            <p style={styles.text}>Authentication successful!</p>
            <p style={styles.subtext}>Redirecting...</p>
          </div>
        );

      case 'error':
        return (
          <div style={styles.container}>
            <div style={styles.errorIcon}>✗</div>
            <p style={styles.errorText}>Authentication failed</p>
            <p style={styles.subtext}>{error}</p>
            <button
              onClick={() => navigate('/auth')}
              style={styles.button}
            >
              Back to Sign In
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.page}>
      {renderContent()}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    color: '#f7f9ff',
  },
  container: {
    textAlign: 'center',
    padding: '2rem',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid rgba(59, 130, 246, 0.3)',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 1rem',
  },
  text: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 0.5rem',
  },
  subtext: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: 0,
  },
  successIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
  },
  errorText: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#ef4444',
    margin: '0 0 0.5rem',
  },
  button: {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
};
