import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Home = () => {
  const navigate = useNavigate()
  const { bookmarks, user, syncBookmarksWithFirebase } = useAppStore()
  const { isAuthenticated, signOut, deleteAccount, signInWithLinkedIn } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      syncBookmarksWithFirebase()
    }
  }, [isAuthenticated, syncBookmarksWithFirebase])

  return (
    <div style={{ 
      padding: '2rem', 
      background: '#0f172a', 
      color: '#f7f9ff',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem' }}>
            OntyFi
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut()
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f7f9ff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    transition: 'transform 0.1s ease'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.96)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  Logout
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null)
                    setShowDeleteConfirm(true)
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.55)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#fecaca',
                    fontWeight: 800,
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    transition: 'transform 0.1s ease'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.96)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  Delete Account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={signInWithLinkedIn}
                style={{
                  padding: '0.75rem 1rem',
                  minWidth: '44px',
                  minHeight: '44px',
                  borderRadius: '10px',
                  border: '1px solid rgba(10, 102, 194, 0.5)',
                  background: 'rgba(10, 102, 194, 0.15)',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'transform 0.1s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.96)'
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                Sign in with LinkedIn
              </button>
            )}
          </div>
        </div>

        {showDeleteConfirm ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2, 6, 23, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              zIndex: 50,
            }}
            onClick={() => {
              if (!deleting) setShowDeleteConfirm(false)
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 520,
                background: '#0b1220',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                borderRadius: 16,
                padding: '1.25rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.35rem' }}>Delete account?</div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5 }}>
                This will delete your profile document and remove your Firebase sign-in credentials. This action cannot be undone.
              </div>

              {deleteError ? (
                <div style={{ marginTop: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fecaca', borderRadius: 12, padding: '0.75rem', fontSize: '0.85rem' }}>
                  {deleteError}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    padding: '0.75rem 1rem',
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    background: 'transparent',
                    color: '#cbd5e1',
                    fontWeight: 800,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    touchAction: 'manipulation',
                    transition: 'transform 0.1s ease'
                  }}
                  onTouchStart={(e) => {
                    if (!deleting) e.currentTarget.style.transform = 'scale(0.96)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true)
                    setDeleteError(null)
                    try {
                      await deleteAccount()
                      setShowDeleteConfirm(false)
                    } catch (e) {
                      setDeleteError(e?.message || 'Failed to delete account')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.65)',
                    background: deleting ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.22)',
                    color: '#fecaca',
                    fontWeight: 900,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    touchAction: 'manipulation',
                    transition: 'transform 0.1s ease'
                  }}
                  onTouchStart={(e) => {
                    if (!deleting) e.currentTarget.style.transform = 'scale(0.96)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div 
            onClick={() => navigate('/my-insights')}
            role="button"
            tabIndex={0}
            aria-label="Navigate to MyInsights"
            style={{ 
              padding: '2rem',
              background: 'rgba(167, 139, 250, 0.1)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'transform 0.1s ease, box-shadow 0.15s ease',
              minHeight: '44px',
              touchAction: 'manipulation'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(167, 139, 250, 0.2)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/my-insights')
              }
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💎</div>
            <h3 style={{ marginBottom: '0.5rem' }}>MyInsights</h3>
            <p style={{ color: '#94a3b8' }}>Exclusive research and market materials</p>
          </div>

          <div 
            onClick={() => navigate('/tree')}
            role="button"
            tabIndex={0}
            aria-label="Navigate to CryptoMap Tree"
            style={{ 
              padding: '2rem',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'transform 0.1s ease, box-shadow 0.15s ease',
              minHeight: '44px',
              touchAction: 'manipulation'
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'scale(0.98)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)'
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/tree')
              }
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌳</div>
            <h3 style={{ marginBottom: '0.5rem' }}>CryptoMap Tree</h3>
            <p style={{ color: '#94a3b8' }}>Explore the comprehensive crypto knowledge map</p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Welcome back, {user.username}</h3>
          <p style={{ color: '#94a3b8' }}>
            Streak: {user.activities.streakDays} days • Articles read: {user.activities.totalArticlesRead}
          </p>
        </div>

        {/* Intricate Rhombus Button - Finance Archetype Diagnostic */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 0' }}>
          <div
            onClick={() => navigate('/archetype-diagnostic')}
            role="button"
            tabIndex={0}
            aria-label="Take the Finance Archetype Diagnostic"
            style={{
              width: '140px',
              height: '140px',
              position: 'relative',
              cursor: 'pointer',
              transform: 'rotate(45deg)',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(167, 139, 250, 0.2) 100%)',
              border: '2px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'rotate(45deg) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 12px 48px rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'rotate(45deg) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'rotate(45deg) scale(0.95)';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'rotate(45deg) scale(1)';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/archetype-diagnostic');
              }
            }}
          >
            {/* Inner content - counter-rotated */}
            <div style={{
              transform: 'rotate(-45deg)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{ fontSize: '2rem' }}>◈</span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#f7f9ff',
                letterSpacing: '0.05em',
                maxWidth: '80px',
                lineHeight: 1.2,
              }}>
                Discover Your Archetype
              </span>
            </div>

            {/* Decorative corner accents */}
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              width: '12px',
              height: '12px',
              borderTop: '2px solid rgba(167, 139, 250, 0.6)',
              borderLeft: '2px solid rgba(167, 139, 250, 0.6)',
              borderRadius: '2px',
            }} />
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '12px',
              height: '12px',
              borderTop: '2px solid rgba(167, 139, 250, 0.6)',
              borderRight: '2px solid rgba(167, 139, 250, 0.6)',
              borderRadius: '2px',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              width: '12px',
              height: '12px',
              borderBottom: '2px solid rgba(167, 139, 250, 0.6)',
              borderLeft: '2px solid rgba(167, 139, 250, 0.6)',
              borderRadius: '2px',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              width: '12px',
              height: '12px',
              borderBottom: '2px solid rgba(167, 139, 250, 0.6)',
              borderRight: '2px solid rgba(167, 139, 250, 0.6)',
              borderRadius: '2px',
            }} />
          </div>
        </div>

        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
          Take our 7-question diagnostic to find your ideal finance career path
        </p>
      </div>
    </div>
  )
}

export default Home