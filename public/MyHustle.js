function MyHustleScreen({ onGoHome = () => {}, onGoToTree = () => {} }) {
  const [activeSectionId, setActiveSectionId] = React.useState(null);
  const [hustleItems, setHustleItems] = React.useState([]);
  const [mevHealth, setMevHealth] = React.useState(null);
  const [eigenphiEmbedHtml, setEigenphiEmbedHtml] = React.useState('');
  const [eigenphiEmbedError, setEigenphiEmbedError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [gridReady, setGridReady] = React.useState(false);

  const unsubRefs = React.useRef({ items: null, mevHealth: null });

  React.useEffect(() => {
    // Check if CrystalGrid is available
    const checkGrid = () => {
      if (window.CrystalGrid) {
        setGridReady(true);
        console.log('[MyHustle] CrystalGrid ready');
      } else {
        console.log('[MyHustle] CrystalGrid not ready yet, retrying...');
        setTimeout(checkGrid, 100);
      }
    };
    checkGrid();
  }, []);

  const sections = React.useMemo(() => [
    { id: 'mev', name: 'MEV', categories: ['mev', 'flashbots', 'jito'], accent: 'rgba(168, 85, 247, 1)' },
    { id: 'airdrops', name: 'Airdrops', categories: ['airdrop', 'retroactive'], accent: 'rgba(34, 211, 238, 1)' },
    { id: 'defi_yields', name: 'DeFi(Yields)', categories: ['yield_llama', 'yield_coindix', 'defi_yield'], accent: 'rgba(16, 185, 129, 1)' },
    { id: 'socifi', name: 'SociFi', comingSoon: true, accent: 'rgba(96, 165, 250, 1)' },
    { id: 'rwa', name: 'RWA', comingSoon: true, accent: 'rgba(251, 191, 36, 1)' },
    { id: 'node_operating', name: 'Node Operating', comingSoon: true, accent: 'rgba(244, 63, 94, 1)' },
    { id: 'gamify', name: 'GamiFY', comingSoon: true, accent: 'rgba(14, 165, 233, 1)' },
    { id: 'lrt', name: 'LRT', comingSoon: true, accent: 'rgba(139, 92, 246, 1)' },
    { id: 'depin', name: 'DePIN', comingSoon: true, accent: 'rgba(45, 212, 191, 1)' },
    { id: 'memes', name: 'Memes', comingSoon: true, accent: 'rgba(248, 113, 113, 1)' }
  ], []);

  const activeSection = React.useMemo(
    () => sections.find((s) => s.id === activeSectionId) || null,
    [activeSectionId, sections]
  );

  const safeCall = (fn) => {
    try { fn && fn(); } catch (e) { console.error('MyHustle safeCall error:', e); }
  };

  const openUrl = (url) => {
    try {
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('MyHustle openUrl error:', e);
    }
  };

  const formatTimeAgo = (dateLike) => {
    if (!dateLike) return '';
    let ts = null;
    try {
      if (typeof dateLike === 'number') ts = dateLike;
      else if (typeof dateLike.toDate === 'function') ts = dateLike.toDate().getTime();
      else if (dateLike instanceof Date) ts = dateLike.getTime();
      else ts = new Date(dateLike).getTime();
    } catch { return ''; }
    if (!Number.isFinite(ts)) return '';
    const diffMs = Math.max(0, Date.now() - ts);
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  const shortText = (text, max = 160) => {
    const t = (text || '').toString().replace(/\s+/g, ' ').trim();
    if (!t) return '';
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  };

  const systemLight = (health) => {
    const status = (health?.status || '').toString();
    if (status === 'Open Market') return { color: '#10b981', label: 'Open Market' };
    if (status === 'Elevated') return { color: '#f59e0b', label: 'Elevated' };
    if (status === 'High Censorship') return { color: '#ef4444', label: 'High Censorship' };
    if (status === 'Error') return { color: '#ef4444', label: 'Error' };
    return { color: '#64748b', label: status || 'Unknown' };
  };

  React.useEffect(() => {
    if (!activeSection || activeSection.comingSoon) return;

    setLoading(true);
    setError(null);

    const db = window.firebase.firestore();
    const categories = activeSection.categories;

    // Determine target collections
    const collections = activeSectionId === 'mev' ? ['mev_hustles'] : ['hustles_v2'];
    
    // For simplicity and matching user request of "sort distribute accordingly", 
    // we use a single query but filter by category.
    // In MyHustle0.5, mev was separate, but we can unify or keep separate.
    // Given the request, let's keep the logic but adapt to sections.

    const setupSubscription = () => {
      let query;
      if (activeSectionId === 'mev') {
        query = db.collection('mev_hustles').orderBy('timestamp', 'desc').limit(30);
      } else {
        query = db.collection('hustles_v2').orderBy('date_added', 'desc').limit(50);
      }

      unsubRefs.current.items = query.onSnapshot(
        (snap) => {
          const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            .filter(item => {
              const cat = (item.category || item.type || '').toLowerCase();
              return categories.some(c => cat.includes(c.toLowerCase()));
            });
          setHustleItems(next);
          setLoading(false);
        },
        (e) => {
          console.error('MyHustle onSnapshot error:', e);
          setError(e.message);
          setLoading(false);
        }
      );
    };

    setupSubscription();

    return () => {
      if (unsubRefs.current.items) unsubRefs.current.items();
    };
  }, [activeSectionId]);

  React.useEffect(() => {
    // Shared listeners (MEV Health, EigenPhi)
    const db = window.firebase.firestore();
    
    unsubRefs.current.mevHealth = db.collection('mev_health').doc('latest').onSnapshot(doc => {
      setMevHealth(doc.exists ? doc.data() : null);
    });

    (async () => {
      try {
        const res = await fetch('/api/embed/eigenphi', { cache: 'no-store' });
        if (res.ok) setEigenphiEmbedHtml(await res.text());
      } catch (e) { setEigenphiEmbedError('Failed to load EigenPhi'); }
    })();

    return () => {
      if (unsubRefs.current.mevHealth) unsubRefs.current.mevHealth();
    };
  }, []);

  return (
    React.createElement('div', { style: { background: '#050816', color: '#f7f9ff', minHeight: '100vh', position: 'relative', overflow: 'hidden' } },
      React.createElement('style', null, `
        .mhRoot { min-height: 100vh; display: flex; flex-direction: column; }
        .mhTopbar { position: relative; z-index: 10; display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; background: rgba(2, 6, 23, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(148, 163, 184, 0.2); }
        .mhTopbar h2 { margin: 0; font-size: 20px; }
        .mhBtn { padding: 10px 12px; background: rgba(148, 163, 184, 0.15); color: #f7f9ff; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 10px; cursor: pointer; font-size: 14px; }
        .mhBtn:hover { background: rgba(148, 163, 184, 0.22); }
        .mhStage { position: relative; flex: 1; overflow: hidden; }
        .mhGridView, .mhSubView { position: absolute; top: 0; left: 0; right: 0; bottom: 0; transition: opacity 260ms ease, transform 260ms ease; z-index: 2; overflow-y: auto; padding: 20px; }
        .mhGridView.hidden { opacity: 0; transform: scale(0.98); pointer-events: none; }
        .mhSubView.hidden { opacity: 0; transform: translateY(10px); pointer-events: none; }
        .mhCards { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-top: 20px; }
        .mhCard { padding: 18px; background: rgba(2, 6, 23, 0.6); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 16px; cursor: pointer; position: relative; transition: all 180ms ease; backdrop-filter: blur(10px); }
        .mhCard:hover { transform: translateY(-2px); border-color: rgba(148, 163, 184, 0.4); }
        .mhChip { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); }
        .mhTime { position: absolute; top: 14px; right: 14px; background: rgba(2, 6, 23, 0.7); border: 1px solid rgba(148, 163, 184, 0.25); color: #cbd5e1; padding: 3px 8px; border-radius: 999px; font-size: 11px; }
        .mhCardTitle { margin: 0 0 10px; font-size: 17px; }
        .mhCardBody { margin: 0 0 12px; color: #94a3b8; font-size: 14px; line-height: 1.5; }
        .mhHealth { display: flex; align-items: center; gap: 0.6rem; background: rgba(15, 23, 42, 0.4); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(148, 163, 184, 0.1); }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `),
      
      React.createElement('div', { className: 'mhRoot' },
        React.createElement('div', { className: 'mhTopbar' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } },
            React.createElement('h2', null, 'My Hustle'),
            activeSectionId === 'mev' ? (
              React.createElement('div', { className: 'mhHealth' },
                React.createElement('div', { style: { width: 10, height: 10, borderRadius: '999px', background: systemLight(mevHealth).color } }),
                React.createElement('span', { style: { fontSize: '13px', fontWeight: 700 } }, systemLight(mevHealth).label)
              )
            ) : null
          ),
          React.createElement('div', { style: { display: 'flex', gap: '10px' } },
            React.createElement('button', { className: 'mhBtn', onClick: () => safeCall(onGoHome) }, '← Home'),
            React.createElement('button', { className: 'mhBtn', onClick: () => safeCall(onGoToTree) }, '🌳 Tree')
          )
        ),

        React.createElement('div', { className: 'mhStage' },
          React.createElement('div', { className: `mhGridView ${activeSectionId ? 'hidden' : ''}` },
             React.createElement('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, background: 'radial-gradient(ellipse at 20% 20%, rgba(96,165,250,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.15) 0%, transparent 50%)' } }),
             !gridReady ? (
               React.createElement('div', { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, color: '#94a3b8', fontSize: '16px', textAlign: 'center' } },
                 React.createElement('div', { style: { marginBottom: '15px' } }, 'Initializing Crystal Grid...'),
                 React.createElement('div', { style: { width: '40px', height: '40px', border: '3px solid rgba(148,163,184,0.2)', borderTop: '3px solid rgba(96,165,250,0.8)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' } })
               )
             ) : window.CrystalGrid ? React.createElement(window.CrystalGrid, { sections: sections, onSelect: setActiveSectionId }) : (
               React.createElement('div', { style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 5, color: '#ef4444', textAlign: 'center' } },
                 React.createElement('div', null, 'Crystal Grid component not available'),
                 React.createElement('button', { className: 'mhBtn', style: { marginTop: '15px' }, onClick: () => window.location.reload() }, 'Reload')
               )
             )
          ),

          React.createElement('div', { className: `mhSubView ${activeSectionId ? '' : 'hidden'}` },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement('div', null,
                React.createElement('h3', { style: { margin: 0, fontSize: '24px' } }, activeSection?.name),
                React.createElement('p', { style: { color: '#94a3b8', margin: '5px 0' } },
                  activeSection?.comingSoon ? 'Section crystallizing...' : `${hustleItems.length} opportunities detected`
                )
              ),
              React.createElement('button', { className: 'mhBtn', onClick: () => setActiveSectionId(null) }, '← Mesh View')
            ),

            activeSectionId === 'mev' && eigenphiEmbedHtml ? (
              React.createElement('div', { className: 'card', style: { marginTop: '20px', padding: '15px', background: 'rgba(15, 23, 42, 0.4)' } },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' } },
                  React.createElement('span', { style: { fontWeight: 800 } }, 'EigenPhi Live Feed'),
                  React.createElement('button', { className: 'mhBtn', style: { padding: '4px 8px', fontSize: '12px' }, onClick: () => openUrl('https://eigenphi.io') }, 'Open Site')
                ),
                React.createElement('div', { dangerouslySetInnerHTML: { __html: eigenphiEmbedHtml }, style: { maxHeight: '300px', overflow: 'auto' } })
              )
            ) : null,

            React.createElement('div', { className: 'mhCards' },
              error ? (
                React.createElement('div', { style: { gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#ef4444' } },
                  React.createElement('div', { style: { fontSize: '18px', marginBottom: '10px' } }, 'Error loading data'),
                  React.createElement('div', { style: { fontSize: '14px', color: '#94a3b8', marginBottom: '15px' } }, error),
                  React.createElement('button', { className: 'mhBtn', onClick: () => window.location.reload() }, 'Retry')
                )
              ) : loading && !activeSection?.comingSoon ? (
                React.createElement('div', { style: { gridColumn: '1/-1', textAlign: 'center', padding: '40px' } }, 'Crystallizing data...')
              ) : activeSection?.comingSoon ? (
                React.createElement('div', { className: 'mhCard', style: { gridColumn: '1/-1', textAlign: 'center', cursor: 'default' } },
                  React.createElement('h4', null, 'Coming Soon'),
                  React.createElement('p', null, 'The mesh is still forming in this sector. Data streams will arrive soon.')
                )
              ) : hustleItems.map(item => (
                React.createElement('div', { key: item.id, className: 'mhCard', onClick: () => openUrl(item.link) },
                  React.createElement('div', { className: 'mhTime' }, formatTimeAgo(item.date_added || item.timestamp)),
                  React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
                    React.createElement('span', { className: 'mhChip', style: { borderColor: activeSection.accent, color: activeSection.accent } },
                      item.source || item.scraper || 'Alpha'
                    ),
                    item.network && React.createElement('span', { className: 'mhChip' }, item.network)
                  ),
                  React.createElement('h4', { className: 'mhCardTitle' }, item.title || item.name),
                  React.createElement('p', { className: 'mhCardBody' }, shortText(item.description || item.short_description || item.summary)),
                  item.profit_usd && React.createElement('div', { style: { fontWeight: 800, color: '#10b981' } }, `Est. Profit: $${item.profit_usd}`)
                )
              ))
            )
          )
        )
      )
    )
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

// Atomic registration with safety checks
(function registerMyHustleScreen() {
  try {
    // Guard against React not being available
    if (typeof React === 'undefined') {
      console.warn('React not available during MyHustleScreen registration');
      return;
    }
    // Guard against overwriting existing registration
    if (window.MyHustleScreen && typeof window.MyHustleScreen === 'function') {
      console.log('MyHustleScreen already registered, skipping');
      return;
    }
    window.MyHustleScreen = SafeMyHustleScreen;
    window.MyHustleScreenUnsafe = MyHustleScreen;
    console.log('✅ MyHustleScreen registered at:', Date.now(), typeof window.MyHustleScreen);
    try {
      window.dispatchEvent(new Event('MyHustleScreenReady'));
    } catch (e) {
      console.warn('Failed to dispatch MyHustleScreenReady:', e);
    }
  } catch (e) {
    console.error('Failed to register MyHustleScreen:', e);
  }
})();
