// Wait for all dependencies to load
(function() {
  function checkDependencies() {
    return window.cryptoHustleTree && 
           window.UserAccount && 
           window.React && 
           window.ReactDOM;
  }

  function initApp() {
    if (!checkDependencies()) {
      setTimeout(initApp, 100);
      return;
    }

    const { useState, useEffect } = React;

    function TreeScreen({ tree }) {
      if (!tree?.fields?.length) {
        return React.createElement('div', { className: 'screen' },
          React.createElement('div', { 
            style: { padding: '2rem', textAlign: 'center', color: '#ef4444' }
          }, 
            React.createElement('h3', null, 'No Tree Data'),
            React.createElement('p', null, `Fields: ${tree?.fields?.length || 0}`)
          )
        );
      }

      return React.createElement('div', { className: 'screen' },
        React.createElement('h2', null, 'CryptoMap Tree'),
        React.createElement('p', null, `Loaded ${tree.fields.length} fields`),
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            marginTop: '2rem'
          }
        }, 
          tree.fields.map(field => 
            React.createElement('div', {
              key: field.id,
              style: {
                padding: '1.5rem',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '12px',
                cursor: 'pointer'
              }
            },
              React.createElement('div', {
                style: { fontSize: '1.1rem', fontWeight: '600', color: '#f7f9ff' }
              }, field.name),
              React.createElement('div', {
                style: { fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }
              }, field.description)
            )
          )
        )
      );
    }

    function HomeScreen({ onNavigateToTree }) {
      return React.createElement('div', { className: 'screen' },
        React.createElement('h2', null, 'CryptoExplorer'),
        React.createElement('div', { className: 'home-highlights' },
          React.createElement('div', {
            className: 'card',
            onClick: onNavigateToTree,
            style: { cursor: 'pointer' }
          },
            React.createElement('div', { className: 'card-title' }, 'TreeMap'),
            React.createElement('div', { className: 'card-main' }, '🌳 Explore'),
            React.createElement('p', {
              style: { marginTop: '0.35rem', fontSize: '0.85rem', color: '#9ca3af' }
            }, 'Click to view the crypto knowledge tree')
          )
        )
      );
    }

    function App() {
      const [screen, setScreen] = useState('home');
      const [tree, setTree] = useState(window.cryptoHustleTree || { fields: [] });

      return React.createElement('div', { className: 'app-root' },
        screen === 'home' && React.createElement(HomeScreen, {
          onNavigateToTree: () => setScreen('tree')
        }),
        screen === 'tree' && React.createElement('div', null,
          React.createElement('button', {
            onClick: () => setScreen('home'),
            style: {
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
            }
          }, '← Home'),
          React.createElement(TreeScreen, { tree })
        )
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();