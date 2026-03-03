function MyHustleScreen({ onGoHome = () => {}, onGoToTree = () => {} }) {
  const [airdropItems, setAirdropItems] = React.useState([]);
  const [mevItems, setMevItems] = React.useState([]);
  const [mevHealth, setMevHealth] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const unsubRefs = React.useRef({ airdrops: null, mev: null, mevHealth: null });

  const MAX_AIRDROPS = 50;
  const MAX_MEV = 30;

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

  const sourceColor = (source) => {
    const s = (source || '').toString();
    const colors = {
      'DeFiLlama': '#8b5cf6',
      'Airdrops.io': '#3b82f6',
      'AirDropAlert': '#10b981',
      'AirdropBob': '#f59e0b',
      'Freeairdrop.io': '#06b6d4',
      'Flashbots': '#f97316',
      'Jito': '#a855f7',
      'EigenPhi': '#22c55e'
    };
    return colors[s] || '#64748b';
  };

  const riskColor = (risk) => {
    const r = (risk || '').toString().toLowerCase();
    if (r.includes('toxic')) return '#ef4444';
    if (r.includes('benign')) return '#10b981';
    return '#64748b';
  };

  const riskGlow = (risk) => {
    const r = (risk || '').toString().toLowerCase();
    if (r.includes('toxic')) return '0 0 20px rgba(239, 68, 68, 0.3)';
    if (r.includes('benign')) return '0 0 20px rgba(16, 185, 129, 0.3)';
    return 'none';
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
    console.log('🔥 [MYHUSTLE] Initializing MyHustle screen...');
    setLoading(true);
    setError(null);

    let initialized = false;
    const initSubscriptions = () => {
      console.log('🔥 [MYHUSTLE] Setting up Firebase subscriptions...');
      if (initialized) return;
      if (!window.firebase || !window.firebase.firestore) {
        console.error('🔥 [MYHUSTLE] Firebase not ready (firestore missing)');
        setError('Firebase not ready (firestore missing).');
        setLoading(false);
        return;
      }
      initialized = true;
      const db = window.firebase.firestore();

      try {
        console.log('🔥 [MYHUSTLE] Setting up MEV hustles listener...');
        unsubRefs.current.mev = db
          .collection('mev_hustles')
          .orderBy('timestamp', 'desc')
          .limit(MAX_MEV)
          .onSnapshot(
            (snap) => {
              console.log('🔥 [MYHUSTLE] MEV hustles snapshot received:', snap.docs.length, 'documents');
              const next = snap.docs.map((d) => {
                const data = d.data();
                console.log('🔥 [MYHUSTLE] MEV hustle:', data?.title, 'Risk:', data?.risk_score, 'Profit:', data?.profit_usd);
                return { id: d.id, ...data };
              });
              setMevItems(Array.isArray(next) ? next : []);
              setLoading(false);
            },
            (e) => {
              console.error('🔥 [MYHUSTLE] MEV onSnapshot error:', e);
              setError(e?.message || 'Failed to load MEV hustles');
              setLoading(false);
            }
          );

        console.log('🔥 [MYHUSTLE] Setting up MEV health listener...');
        unsubRefs.current.mevHealth = db
          .collection('mev_health')
          .doc('latest')
          .onSnapshot(
            (doc) => {
              const health = doc && doc.exists ? doc.data() : null;
              console.log('🔥 [MYHUSTLE] MEV health update:', health);
              setMevHealth(health);
            },
            (e) => {
              console.error('🔥 [MYHUSTLE] MEV health onSnapshot error:', e);
            }
          );

        console.log('🔥 [MYHUSTLE] Setting up airdrops listener...');
        unsubRefs.current.airdrops = db
          .collection('hustles_v2')
          .orderBy('date_added', 'desc')
          .limit(MAX_AIRDROPS)
          .onSnapshot(
            (snap) => {
              console.log('🔥 [MYHUSTLE] Airdrops snapshot received:', snap.docs.length, 'documents');
              const next = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
              setAirdropItems(Array.isArray(next) ? next : []);
              setLoading(false);
            },
            (e) => {
              console.error('🔥 [MYHUSTLE] Airdrops onSnapshot error:', e);
              setError(e?.message || 'Failed to load airdrops');
              setLoading(false);
            }
          );
      } catch (e) {
        console.error('🔥 [MYHUSTLE] MyHustle init error:', e);
        setError(e?.message || 'Failed to initialize listeners');
        setLoading(false);
      }
    };

    // Try immediate init, otherwise wait up to 3s
    initSubscriptions();
    const timeoutId = setTimeout(() => {
      if (!initialized) initSubscriptions();
    }, 3000);

    return () => {
      clearTimeout(timeoutId);
      safeCall(unsubRefs.current.airdrops);
      safeCall(unsubRefs.current.mev);
      safeCall(unsubRefs.current.mevHealth);
      unsubRefs.current.airdrops = null;
      unsubRefs.current.mev = null;
      unsubRefs.current.mevHealth = null;
    };
  }, []);

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>My Hustle</h2>
        <div>
          <button className="secondary-button" onClick={() => safeCall(onGoHome)} style={{ marginRight: '1rem' }}>← Home</button>
          <button className="secondary-button" onClick={() => safeCall(onGoToTree)}>🌳 Tree</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800 }}>MEV Platforms</div>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Listening to <code>mev_hustles</code>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: systemLight(mevHealth).color }} />
            <div style={{ fontWeight: 800 }}>{systemLight(mevHealth).label}</div>
          </div>
        </div>
      </div>

      {Array.isArray(mevItems) && mevItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {mevItems.slice(0, MAX_MEV).map((h) => {
            const risk = h?.risk_score || 'Unknown';
            const hasRiskGlow = risk !== 'Unknown';
            
            return (
              <div 
                key={h?.id || Math.random().toString(16).slice(2)} 
                className="card" 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '180px 1fr 150px', 
                  gap: '1rem', 
                  alignItems: 'center',
                  boxShadow: hasRiskGlow ? riskGlow(risk) : 'none',
                  borderLeft: hasRiskGlow ? `4px solid ${riskColor(risk)}` : 'none'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ background: sourceColor(h?.source_platform), color: 'white', padding: '0.25rem 0.6rem', borderRadius: 999, width: 'fit-content', fontSize: '0.75rem', fontWeight: 800 }}>
                    {h?.source_platform || 'MEV'}
                  </span>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{h?.network || '—'}{h?.type ? ` • ${h.type}` : ''}</div>
                  <div style={{ 
                    color: riskColor(risk), 
                    fontSize: '0.85rem', 
                    fontWeight: risk !== 'Unknown' ? 700 : 400 
                  }}>
                    Risk: {risk}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{h?.title || 'Untitled'}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                    Profit: {typeof h?.profit_usd === 'number' ? `$${h.profit_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                  </div>
                  {h?.block_number && (
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Block: {h.block_number}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="primary-button" onClick={() => openUrl(h?.explorer_url)} disabled={!h?.explorer_url} style={{ width: 150 }}>
                    Open Explorer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && (!Array.isArray(mevItems) || mevItems.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>No MEV hustles yet</div>
          <div style={{ color: '#94a3b8' }}>The MEV pipeline hasn't written to <code>mev_hustles</code> yet.</div>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Check Firebase Functions logs for scraping activity.
          </div>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading…
        </div>
      )}

      {error && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', borderColor: '#ef4444' }}>
          <div style={{ color: '#ef4444', fontWeight: 800, marginBottom: '0.5rem' }}>MyHustle Error</div>
          <div style={{ color: '#94a3b8' }}>{error}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: 800 }}>Airdrop Feed</div>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Listening to <code>hustles_v2</code></div>
      </div>

      {!loading && !error && (!Array.isArray(airdropItems) || airdropItems.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>No airdrops yet</div>
          <div style={{ color: '#94a3b8' }}>The collector hasn’t written to <code>hustles_v2</code> yet.</div>
        </div>
      )}

      {!loading && !error && Array.isArray(airdropItems) && airdropItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {airdropItems.slice(0, MAX_AIRDROPS).map((a) => (
            <div key={a?.id || Math.random().toString(16).slice(2)} className="card" style={{ display: 'grid', gridTemplateColumns: '180px 1fr 150px', gap: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ background: sourceColor(a?.source), color: 'white', padding: '0.25rem 0.6rem', borderRadius: 999, width: 'fit-content', fontSize: '0.75rem', fontWeight: 800 }}>
                  {a?.source || 'Unknown'}
                </span>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{a?.network || '—'}</div>
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{a?.title || 'Untitled'}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.45 }}>{a?.description || ''}</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary-button" onClick={() => openUrl(a?.link)} disabled={!a?.link} style={{ width: 150 }}>
                  View Alpha
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
