function MyHustleScreen({ onGoHome, onGoToTree }) {
  const [personalizedFeed, setPersonalizedFeed] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [filter, setFilter] = React.useState({ type: '', source: '' });
  const [showModal, setShowModal] = React.useState(false);
  const [selectedHustle, setSelectedHustle] = React.useState(null);

  const abortRef = React.useRef(null);
  const mountedRef = React.useRef(true);

  const normalizeFeedData = (input) => {
    if (Array.isArray(input)) return input;
    if (!input) return [];
    if (Array.isArray(input.data)) return input.data;
    if (Array.isArray(input.items)) return input.items;
    return [];
  };

  // Fetch hustle feed data
  const fetchHustleFeed = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      setError(null);

      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }

      const queryParams = new URLSearchParams();
      if (filter.type) queryParams.append('type', filter.type);
      if (filter.source) queryParams.append('source', filter.source);

      const controller = new AbortController();
      abortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/hustle/feed?${queryParams.toString()}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch hustle data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        const nextData = normalizeFeedData(result.data);
        if (mountedRef.current) setPersonalizedFeed(nextData);
      } else {
        throw new Error(result.error || 'Failed to fetch hustle data');
      }
    } catch (err) {
      console.error('Error fetching hustle feed:', err);
      let errorMessage = err.message;
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out - showing sample data';
      }
      // Show sample data when API fails so UI is visible
      if (mountedRef.current) {
        setPersonalizedFeed(getSampleData());
        setError(`API unavailable - showing sample data (${errorMessage})`);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  // Sample data for when API isn't available
  const getSampleData = () => [
    {
      id: 'sample-yield-1',
      type: 'yield',
      title: 'USDC Stablecoin Yield',
      description: 'High-yield stablecoin farming opportunity with audited protocols',
      source: 'defillama',
      apy: '12.5',
      underlyingTokens: ['USDC'],
      tags: ['stablecoin', 'yield', 'low-risk'],
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      url: 'https://app.uniswap.org'
    },
    {
      id: 'sample-airdrop-1',
      type: 'airdrop',
      title: 'Layer 2 Ecosystem Airdrop',
      description: 'New Layer 2 protocol launching with community airdrop',
      source: 'defillama',
      tags: ['airdrop', 'layer2', 'community'],
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      url: 'https://example.com/airdrop'
    },
    {
      id: 'sample-article-1',
      type: 'article',
      title: 'Optimism Superchain Update',
      description: 'Latest developments in the Optimism ecosystem and Superchain vision',
      source: 'optimism',
      author: 'Optimism Team',
      content: 'The Optimism Superchain represents the next evolution of our rollup-centric roadmap...',
      tags: ['optimism', 'superchain', 'layer2'],
      publishedAt: new Date(Date.now() - 86400000), // 1 day ago
      url: 'https://optimism.mirror.xyz'
    },
    {
      id: 'sample-article-2',
      type: 'article',
      title: 'Arbitrum Stylus: Multi-Language Smart Contracts',
      description: 'Introducing Stylus - bringing familiar languages to Arbitrum',
      source: 'arbitrum',
      author: 'Arbitrum Foundation',
      content: 'Today, we\'re excited to announce Arbitrum Stylus, a groundbreaking new feature...',
      tags: ['arbitrum', 'stylus', 'smart-contracts'],
      publishedAt: new Date(Date.now() - 172800000), // 2 days ago
      url: 'https://blog.arbitrum.foundation'
    }
  ];

  // Update all data sources
  const updateAllData = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/hustle/update', { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Failed to update data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('Data updated successfully:', result.data);
        await fetchHustleFeed(false); // Refresh the feed after update
      } else {
        throw new Error(result.error || 'Failed to update data');
      }
    } catch (err) {
      console.error('Error updating data:', err);
      // Show sample data when API fails so UI is visible
      if (mountedRef.current) {
        setPersonalizedFeed(getSampleData());
        setError(`API unavailable - showing sample data (${err.message})`);
      }
    } finally {
      if (mountedRef.current) setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    mountedRef.current = true;
    fetchHustleFeed();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
  }, [filter]);

  const getSourceBadgeColor = (source) => {
    const colors = {
      'defillama': '#3b82f6', // Blue for DeFi
      'optimism': '#ff0420', // Red for Optimism
      'arbitrum': '#2d3748', // Dark for Arbitrum
      'DeFiPulse': '#3b82f6',
      'CoinGecko': '#10b981',
      'Twitter': '#1da1f2',
      'Reddit': '#ff4500'
    };
    return colors[source] || '#6b7280';
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      'yield': '#10b981', // Green for yields
      'airdrop': '#f59e0b', // Orange for airdrops
      'article': '#8b5cf6' // Purple for articles
    };
    return colors[type] || '#6b7280';
  };

  const getTypeIcon = (type) => {
    const icons = {
      'yield': '💰',
      'airdrop': '🎁',
      'article': '📰'
    };
    return icons[type] || '📊';
  };

  const getAlphaLevelColor = (score) => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
  };

  const handleCardClick = (opportunity) => {
    setSelectedHustle(opportunity);
    setShowModal(true);
  };

  const handleActionClick = () => {
    if (selectedHustle?.url && selectedHustle.url !== '#') {
      window.open(selectedHustle.url, '_blank');
    }
    setShowModal(false);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>My Hustle</h2>
        <div>
          <button className="secondary-button" onClick={onGoHome} style={{ marginRight: '1rem' }}>
            ← Home
          </button>
          <button className="secondary-button" onClick={onGoToTree}>
            🌳 Tree
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`primary-button ${isRefreshing ? 'disabled' : ''}`}
          onClick={updateAllData}
          disabled={isRefreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isRefreshing ? '🔄' : '📡'} {isRefreshing ? 'Updating...' : 'Update Data'}
        </button>

        <button
          className="secondary-button"
          onClick={() => fetchHustleFeed(false)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          🔄 Refresh
        </button>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={filter.type}
            onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '6px',
              color: '#f7f9ff',
              padding: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <option value="">All Types</option>
            <option value="yield">💰 Yields</option>
            <option value="airdrop">🎁 Airdrops</option>
            <option value="article">📰 Articles</option>
          </select>

          <select
            value={filter.source}
            onChange={(e) => setFilter(prev => ({ ...prev, source: e.target.value }))}
            style={{
              background: '#1e293b',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '6px',
              color: '#f7f9ff',
              padding: '0.5rem',
              fontSize: '0.9rem'
            }}
          >
            <option value="">All Sources</option>
            <option value="defillama">DeFiLlama</option>
            <option value="optimism">Optimism</option>
            <option value="arbitrum">Arbitrum</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', borderColor: '#ef4444' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h3 style={{ marginBottom: '1rem', color: '#ef4444' }}>Error Loading Data</h3>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="primary-button" onClick={() => fetchHustleFeed()}>
              Try Again
            </button>
            <button className="secondary-button" onClick={updateAllData}>
              Update Data Sources
            </button>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!error && (!Array.isArray(personalizedFeed) || personalizedFeed.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ marginBottom: '1rem' }}>No Hustle Data Found</h3>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
            No data matches your current filters, or the data sources haven't been updated yet.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="primary-button" onClick={updateAllData}>
              Fetch Latest Data
            </button>
            <button className="secondary-button" onClick={() => setFilter({ type: '', source: '' })}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Data Display */}
      {!error && Array.isArray(personalizedFeed) && personalizedFeed.length > 0 && (
        <>
          <div style={{ marginBottom: '1.5rem', color: '#94a3b8' }}>
            {personalizedFeed.length} items • Last updated: {new Date().toLocaleTimeString()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {(showModal ? [] : personalizedFeed).map(item => (
              <div
                key={item?.id || `${item?.type || 'item'}-${Math.random().toString(16).slice(2)}`}
                className="card hustle-card"
                style={{
                  cursor: 'pointer'
                }}
                onClick={() => handleCardClick(item)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span
                      style={{
                        background: getTypeBadgeColor(item.type),
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      {getTypeIcon(item?.type)} {item?.type || 'unknown'}
                    </span>
                    <span
                      style={{
                        background: getSourceBadgeColor(item?.source),
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}
                    >
                      {item?.source || 'unknown'}
                    </span>
                  </div>
                </div>

                <h3 style={{ marginBottom: '0.75rem', fontSize: '1.1rem' }}>
                  {item?.title || 'Untitled'}
                </h3>

                <p style={{ color: '#94a3b8', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {item?.description || ''}
                </p>

                {Array.isArray(item?.tags) && item.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {item.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        style={{
                          background: 'rgba(148, 163, 184, 0.2)',
                          color: '#94a3b8',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        +{item.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  color: '#94a3b8'
                }}>
                  <span>{item?.timestamp ? new Date(item.timestamp?.toDate ? item.timestamp.toDate() : item.timestamp).toLocaleDateString() : 'Recent'}</span>
                  <span>Click to view →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && selectedHustle && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: getTypeBadgeColor(selectedHustle.type),
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  {getTypeIcon(selectedHustle.type)} {selectedHustle.type}
                </span>
                <span
                  style={{
                    background: getSourceBadgeColor(selectedHustle.source),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}
                >
                  {selectedHustle.source}
                </span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <h3 style={{ marginBottom: '1rem', color: '#f7f9ff' }}>
              {selectedHustle.title}
            </h3>

            <p style={{ color: '#94a3b8', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              {selectedHustle.description}
            </p>

            {/* Additional content for different types */}
            {selectedHustle.type === 'yield' && selectedHustle.underlyingTokens && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#f7f9ff', marginBottom: '0.5rem' }}>Underlying Tokens:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedHustle.underlyingTokens.map((token, index) => (
                    <span key={index} style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedHustle.type === 'yield' && selectedHustle.apy && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#f7f9ff', marginBottom: '0.5rem' }}>APY:</h4>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}>
                  {selectedHustle.apy}%
                </span>
              </div>
            )}

            {selectedHustle.type === 'article' && selectedHustle.content && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#f7f9ff', marginBottom: '0.5rem' }}>Content:</h4>
                <div style={{
                  color: '#94a3b8',
                  lineHeight: '1.6',
                  maxHeight: '200px',
                  overflow: 'auto',
                  padding: '1rem',
                  background: '#1e293b',
                  borderRadius: '6px',
                  fontSize: '0.9rem'
                }}>
                  {selectedHustle.content}
                </div>
              </div>
            )}

            {selectedHustle.author && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#f7f9ff', marginBottom: '0.5rem' }}>Author:</h4>
                <span style={{ color: '#94a3b8' }}>{selectedHustle.author}</span>
              </div>
            )}

            {selectedHustle.tags && selectedHustle.tags.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#f7f9ff', marginBottom: '0.5rem' }}>Tags:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedHustle.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'rgba(148, 163, 184, 0.2)',
                      color: '#94a3b8',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedHustle.publishedAt && (
              <div style={{ marginBottom: '2rem', fontSize: '0.9rem', color: '#94a3b8' }}>
                Published: {new Date(selectedHustle.publishedAt.toDate ? selectedHustle.publishedAt.toDate() : selectedHustle.publishedAt).toLocaleString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="primary-button"
                onClick={() => {
                  if (selectedHustle.url) {
                    window.open(selectedHustle.url, '_blank');
                  }
                  setShowModal(false);
                }}
                disabled={!selectedHustle.url}
              >
                {selectedHustle.type === 'article' ? 'Read Article' :
                 selectedHustle.type === 'yield' ? 'View Pool' :
                 selectedHustle.type === 'airdrop' ? 'View Airdrop' : 'Take Action'}
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hustle-card {
          transition: all 0.2s ease;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }
        .hustle-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent, #3b82f6);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

class MyHustleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.group('🚨 MyHustle FALLBACK SCREEN TRIGGERED');
    console.error('═══════════════════════════════════════════════════════');
    console.error('ERROR DETAILS:');
    console.error('  Name:', error.name);
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════');
    console.error('COMPONENT STACK:', errorInfo.componentStack);
    console.error('═══════════════════════════════════════════════════════');
    console.error('TRIGGER CONTEXT:');
    console.error('  Timestamp:', new Date().toISOString());
    console.error('  URL:', window.location.href);
    console.error('  User Agent:', navigator.userAgent);
    console.error('═══════════════════════════════════════════════════════');
    console.error('POSSIBLE CAUSES:');
    console.error('  1. API fetch failure (network error)');
    console.error('  2. Invalid data structure from API');
    console.error('  3. React rendering error (null/undefined access)');
    console.error('  4. Missing required props');
    console.error('  5. State update on unmounted component');
    console.error('═══════════════════════════════════════════════════════');
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'My Hustle - Error'),
        React.createElement('p', { key: 'desc' }, 'Something went wrong. Please refresh the page.'),
        React.createElement('button', {
          key: 'btn',
          className: 'primary-button',
          onClick: () => window.location.reload()
        }, 'Reload')
      ]);
    }
    return this.props.children;
  }
}

function SafeMyHustleScreen(props) {
  return React.createElement(MyHustleErrorBoundary, null,
    React.createElement(MyHustleScreen, props)
  );
}

window.MyHustleScreen = SafeMyHustleScreen;
window.MyHustleScreenUnsafe = MyHustleScreen;
console.log('✅ MyHustleScreen registered at:', Date.now(), typeof window.MyHustleScreen);

try {
  window.dispatchEvent(new Event('MyHustleScreenReady'));
} catch {}

