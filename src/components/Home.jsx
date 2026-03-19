import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWeb3Auth } from '../hooks/useWeb3Auth'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const Home = () => {
  const navigate = useNavigate()
  const { bookmarks, user, syncBookmarksWithFirebase } = useAppStore()
  const { isAuthenticated } = useWeb3Auth()
  const { signOut, deleteAccount } = useAuth()
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
            CryptoExplorer
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
                    padding: '0.6rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f7f9ff',
                    fontWeight: 700,
                    cursor: 'pointer',
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
                    padding: '0.6rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.55)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#fecaca',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Delete Account
                </button>
              </>
            ) : null}
            <ConnectButton />
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
                    padding: '0.65rem 0.95rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    background: 'transparent',
                    color: '#cbd5e1',
                    fontWeight: 800,
                    cursor: deleting ? 'not-allowed' : 'pointer',
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
                    padding: '0.65rem 0.95rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(239, 68, 68, 0.65)',
                    background: deleting ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.22)',
                    color: '#fecaca',
                    fontWeight: 900,
                    cursor: deleting ? 'not-allowed' : 'pointer',
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
              transition: 'all 0.2s ease'
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

          <div 
            onClick={() => navigate('/my-insights')}
            role="button"
            tabIndex={0}
            aria-label="Navigate to My Insights"
            style={{ 
              padding: '2rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease',
              gridColumn: 'span 2'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/my-insights')
              }
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
            <h3 style={{ marginBottom: '0.5rem' }}>My Insights</h3>
            <p style={{ color: '#94a3b8' }}>Finance resources synced from Drive</p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>Welcome back, {user.username}</h3>
          <p style={{ color: '#94a3b8' }}>
            Streak: {user.activities.streakDays} days • Articles read: {user.activities.totalArticlesRead}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home