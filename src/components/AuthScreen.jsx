import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';

function getFirebaseErrorMessage(error) {
  const code = error?.code;
  if (!code) return error?.message || 'Authentication failed';

  if (code === 'auth/invalid-credential') return 'Invalid credentials';
  if (code === 'auth/email-already-in-use') return 'Email already in use';
  if (code === 'auth/popup-closed-by-user') return 'Popup closed before completing sign-in';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return error?.message || 'Authentication failed';
}

export default function AuthScreen() {
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    linkGoogleWithPassword,
    clearPendingGoogleLink,
    pendingGoogleLinkEmail,
    signInWithPhantom,
    continueAsGuest,
    error: authError,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const error = useMemo(() => localError || authError, [localError, authError]);

  async function handleGoogleLink(e) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);

    try {
      await linkGoogleWithPassword({ email, password });
    } catch (err) {
      setLocalError(getFirebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail({ email, password, displayName });
      } else {
        await signInWithEmail({ email, password });
      }
    } catch (err) {
      setLocalError(getFirebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setLocalError(null);
    setSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(getFirebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhantom() {
    setLocalError(null);
    setSubmitting(true);

    try {
      await signInWithPhantom();
    } catch (err) {
      setLocalError(getFirebaseErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f7f9ff', padding: '2rem' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>OntyFi</h1>
        <p style={{ color: '#94a3b8', marginTop: 0, marginBottom: '1.5rem' }}>
          Sign in to sync your profile, or continue as guest.
        </p>

        {pendingGoogleLinkEmail ? (
          <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.35)', borderRadius: 14, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, marginBottom: '0.35rem' }}>Link Google to your existing account</div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>
              Your email <span style={{ fontWeight: 700 }}>{pendingGoogleLinkEmail}</span> already has a password account.
              Sign in with your password to link Google.
            </div>

            <form onSubmit={handleGoogleLink}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder={pendingGoogleLinkEmail}
                  autoComplete="email"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.3)', background: '#0b1220', color: '#f7f9ff' }}
                />
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.3)', background: '#0b1220', color: '#f7f9ff' }}
                />
              </div>

              {error ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fecaca', borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  minHeight: '44px',
                  borderRadius: 12, 
                  border: 'none', 
                  background: '#3b82f6', 
                  color: 'white', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'transform 0.1s ease'
                }}
                onTouchStart={(e) => {
                  if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                {submitting ? 'Please wait…' : 'Sign in & link Google'}
              </button>

              <div style={{ height: 12 }} />

              <button
                type="button"
                onClick={clearPendingGoogleLink}
                disabled={submitting}
                style={{ 
                  width: '100%', 
                  padding: '0.85rem', 
                  minHeight: '44px',
                  borderRadius: 12, 
                  border: '1px solid rgba(148, 163, 184, 0.35)', 
                  background: 'transparent', 
                  color: '#cbd5e1', 
                  fontWeight: 700, 
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'transform 0.1s ease'
                }}
                onTouchStart={(e) => {
                  if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setMode('signin')}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '0.75rem',
              minHeight: '44px',
              borderRadius: 10,
              border: mode === 'signin' ? '1px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.3)',
              background: mode === 'signin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              color: '#f7f9ff',
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform 0.1s ease'
            }}
            onTouchStart={(e) => {
              if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            disabled={submitting}
            style={{
              flex: 1,
              padding: '0.75rem',
              minHeight: '44px',
              borderRadius: 10,
              border: mode === 'signup' ? '1px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.3)',
              background: mode === 'signup' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              color: '#f7f9ff',
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform 0.1s ease'
            }}
            onTouchStart={(e) => {
              if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleEmailSubmit} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: 14, padding: '1rem' }}>
          {mode === 'signup' ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Satoshi"
                style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.3)', background: '#0b1220', color: '#f7f9ff' }}
              />
            </div>
          ) : null}

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.3)', background: '#0b1220', color: '#f7f9ff' }}
            />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 10, border: '1px solid rgba(148, 163, 184, 0.3)', background: '#0b1220', color: '#f7f9ff' }}
            />
            {mode === 'signup' ? (
              <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                Must be 8+ characters and include a letter and a number.
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fecaca', borderRadius: 10, padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              minHeight: '44px',
              borderRadius: 12, 
              border: 'none', 
              background: '#3b82f6', 
              color: 'white', 
              fontWeight: 700, 
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform 0.1s ease'
            }}
            onTouchStart={(e) => {
              if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <div style={{ height: 12 }} />

          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              minHeight: '44px',
              borderRadius: 12, 
              border: '1px solid rgba(148, 163, 184, 0.35)', 
              background: 'rgba(15, 23, 42, 0.8)', 
              color: 'white', 
              fontWeight: 700, 
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform 0.1s ease'
            }}
            onTouchStart={(e) => {
              if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Continue with Google
          </button>

          <div style={{ height: 12 }} />

          <button
            type="button"
            onClick={handlePhantom}
            disabled={submitting}
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              minHeight: '44px',
              borderRadius: 12, 
              border: '1px solid rgba(148, 163, 184, 0.35)', 
              background: 'rgba(15, 23, 42, 0.8)', 
              color: 'white', 
              fontWeight: 700, 
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform 0.1s ease'
            }}
            onTouchStart={(e) => {
              if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Continue with Phantom
          </button>

          <div style={{ height: 12 }} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectButton />
          </div>
        </form>
      </div>
    </div>
  );
}
