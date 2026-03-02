import { useNavigate } from 'react-router-dom'
import { useHustleData } from '../services/hustleEngine'
import { claimCheck } from '../utils/claimCheck'

const MyHustleScreen = () => {
  const navigate = useNavigate()
  const { hustleList, loading, error } = useHustleData()

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0f172a', color: '#f7f9ff', minHeight: '100vh' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚡</div>
        <h2>Loading Alpha Hustles...</h2>
        <p style={{ color: '#94a3b8' }}>Fetching real-time opportunities</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: '#0f172a', color: '#f7f9ff', minHeight: '100vh' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Hustle Feed Error</h2>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: '0.75rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', background: '#0f172a', color: '#f7f9ff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>My Hustle</h2>
        <button 
          onClick={() => navigate('/')}
          style={{ padding: '0.5rem 1rem', background: '#374151', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          ← Home
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
        {hustleList.length} real-time opportunities from {new Set(hustleList.map(h => h.source)).size} sources • Real-time updates
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {hustleList.map(hustle => {
          if (!claimCheck.validateHustle(hustle)) return null
          
          const alphaLevel = claimCheck.getAlphaLevel(hustle.alphaScore)
          const isHighAlpha = claimCheck.isHighAlpha(hustle.alphaScore)
          
          return (
            <div 
              key={hustle.id}
              style={{ 
                padding: '1.5rem',
                background: isHighAlpha ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.8)',
                border: `1px solid ${isHighAlpha ? '#10b981' : 'rgba(148, 163, 184, 0.3)'}`,
                borderRadius: '12px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span style={{ 
                  background: hustle.source === 'DeFiLlama' ? '#3b82f6' : '#f59e0b',
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem'
                }}>
                  {hustle.source}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ 
                    background: alphaLevel === 'CRITICAL' ? '#ef4444' : alphaLevel === 'HIGH' ? '#f59e0b' : alphaLevel === 'MEDIUM' ? '#3b82f6' : '#6b7280',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    fontWeight: '600'
                  }}>
                    {alphaLevel}
                  </span>
                  <span style={{ 
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.7rem'
                  }}>
                    {hustle.alphaScore}α
                  </span>
                </div>
              </div>
              
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                {hustle.name}
              </h3>
              
              <p style={{ color: '#94a3b8', marginBottom: '1rem', lineHeight: '1.5' }}>
                Type: {hustle.type}
              </p>
              
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {hustle.addedAt.toDate().toLocaleTimeString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MyHustleScreen