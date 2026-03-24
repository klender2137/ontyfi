const LoadingSkeleton = () => (
  <div style={{ 
    padding: '2rem', 
    background: '#0f172a', 
    color: '#f7f9ff',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <div style={{
      width: '60px',
      height: '60px',
      border: '3px solid rgba(59, 130, 246, 0.3)',
      borderTop: '3px solid #3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginBottom: '1rem'
    }} />
    <h2 style={{ marginBottom: '0.5rem' }}>Loading OntyFi</h2>
    <p style={{ color: '#94a3b8' }}>Preparing your personalized experience...</p>
    
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

export default LoadingSkeleton