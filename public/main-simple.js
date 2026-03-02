const { useState, useEffect } = React;

// Simple TreeScreen that displays tree data
function TreeScreen({ tree, onOpenArticle }) {
  console.log('TreeScreen rendering with tree:', tree);
  
  if (!tree || !tree.fields || tree.fields.length === 0) {
    return (
      <div className="screen">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <h3>Tree Data Error</h3>
          <p>Tree data is not available. Fields: {tree?.fields?.length || 0}</p>
        </div>
      </div>
    );
  }

  const [search, setSearch] = useState('');

  return (
    <div className="screen">
      <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.5)', marginBottom: '1rem', borderRadius: '8px' }}>
        <input
          type="text"
          placeholder="Search inside the CryptoMap tree..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '8px',
            color: '#f7f9ff',
            fontSize: '1rem'
          }}
        />
      </div>

      <div style={{ padding: '1rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#f7f9ff' }}>CryptoMap Tree</h3>
        <p style={{ marginBottom: '2rem', color: '#94a3b8' }}>Tree loaded with {tree.fields.length} fields</p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1rem'
        }}>
          {tree.fields.map(field => (
            <div 
              key={field.id} 
              onClick={() => onOpenArticle && onOpenArticle(field)}
              style={{
                padding: '1.5rem',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(56, 189, 248, 0.2)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(30, 41, 59, 0.8)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ 
                fontSize: '1.1rem', 
                fontWeight: '600', 
                marginBottom: '0.5rem',
                color: '#f7f9ff'
              }}>
                {field.name}
              </div>
              <div style={{ 
                fontSize: '0.9rem', 
                color: '#94a3b8', 
                marginBottom: '1rem',
                lineHeight: '1.4'
              }}>
                {field.description}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(field.tags || []).slice(0, 3).map(tag => (
                  <span 
                    key={tag} 
                    style={{
                      background: 'rgba(148, 163, 184, 0.2)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: '#e2e8f0'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simple Home Screen
function HomeScreen({ onNavigateToTree }) {
  return (
    <div className="screen">
      <h2>CryptoExplorer</h2>
      <p>Welcome to the crypto knowledge explorer!</p>
      
      <div className="home-highlights">
        <div className="card" onClick={onNavigateToTree} style={{ cursor: 'pointer' }}>
          <div className="card-title">TreeMap</div>
          <div className="card-main">🌳 Explore</div>
          <p style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }}>
            Click to view the interactive crypto knowledge tree
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple App Root
function AppRoot() {
  const [tree, setTree] = useState(null);
  const [screen, setScreen] = useState('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AppRoot: Checking for tree data...');
    
    const checkTreeData = () => {
      if (window.cryptoHustleTree && window.cryptoHustleTree.fields) {
        console.log('AppRoot: Tree data found with', window.cryptoHustleTree.fields.length, 'fields');
        setTree(window.cryptoHustleTree);
        setLoading(false);
      } else {
        console.log('AppRoot: Tree data not found, retrying...');
      }
    };

    checkTreeData();
    
    const timeout = setTimeout(() => {
      checkTreeData();
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  function openArticle(node) {
    console.log('Opening article:', node);
    alert(`Opening article: ${node.name}`);
  }

  if (loading) {
    return (
      <div className="screen">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          <h3>Loading CryptoExplorer...</h3>
          <p>Please wait while we initialize the application.</p>
        </div>
      </div>
    );
  }

  console.log('AppRoot rendering, screen:', screen, 'tree:', tree?.fields?.length || 0);

  return (
    <div className="app-root">
      {screen === 'home' && (
        <HomeScreen onNavigateToTree={() => setScreen('tree')} />
      )}
      {screen === 'tree' && (
        <>
          <button 
            onClick={() => setScreen('home')}
            style={{
              position: 'fixed',
              top: '1rem',
              left: '1rem',
              padding: '0.5rem 1rem',
              background: '#374151',
              border: '1px solid #6b7280',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              zIndex: 100
            }}
          >
            ← Home
          </button>
          <TreeScreen tree={tree} onOpenArticle={openArticle} />
        </>
      )}
    </div>
  );
}

console.log('Starting simple app render...');
ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);