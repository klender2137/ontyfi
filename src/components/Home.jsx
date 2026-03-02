import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWeb3Auth } from '../hooks/useWeb3Auth'
import { useEffect } from 'react'

const Home = () => {
  const navigate = useNavigate()
  const { bookmarks, user, syncBookmarksWithFirebase } = useAppStore()
  const { isAuthenticated } = useWeb3Auth()

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
          <ConnectButton />
        </div>
        
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
            onClick={() => navigate('/my-hustle')}
            role="button"
            tabIndex={0}
            aria-label="Navigate to My Hustle real-time feed"
            style={{ 
              padding: '2rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/my-hustle')
              }
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
            <h3 style={{ marginBottom: '0.5rem' }}>My Hustle (Real-time)</h3>
            <p style={{ color: '#94a3b8' }}>Live alpha from DeFiLlama & Bankless</p>
          </div>

          <div 
            onClick={() => navigate('/hustle')}
            role="button"
            tabIndex={0}
            aria-label="Navigate to personalized hustle feed"
            style={{ 
              padding: '2rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/hustle')
              }
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ marginBottom: '0.5rem' }}>Hustle Feed</h3>
            <p style={{ color: '#94a3b8' }}>Personalized opportunities</p>
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