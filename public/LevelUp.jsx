// LevelUpScreen.js - Education component with error boundary
function LevelUpScreen({ onGoHome, onGoToTree }) {
  // Ensure React is available
  if (!window.React) {
    console.error('React not available in LevelUpScreen');
    return React.createElement('div', {
      className: 'screen',
      style: { padding: '2rem', textAlign: 'center' }
    }, 'React not loaded');
  }
  
  const { useEffect, useMemo, useRef, useState } = React;

  const [profile, setProfile] = useState(null);
  const [quests, setQuests] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [claimFx, setClaimFx] = useState({ active: false, at: 0 });

  const lastQuestStatusesRef = useRef(new Map());

  const g = typeof window !== 'undefined' ? window.Gamification : null;
  const questDefs = g?.QUEST_DEFS || {};

  const level = useMemo(() => {
    const points = Number(profile?.lifetime_points) || 0;
    return g?.calculateLevel ? g.calculateLevel(points) : 1;
  }, [profile, g]);

  const points = Number(profile?.lifetime_points) || 0;
  const levelStartPoints = g?.pointsRequiredForLevel ? g.pointsRequiredForLevel(level) : 0;
  const nextLevelStartPoints = g?.pointsRequiredForLevel ? g.pointsRequiredForLevel(Math.min(15, level + 1)) : levelStartPoints;
  const progressToNext = Math.max(0, Math.min(1, (points - levelStartPoints) / Math.max(1, (nextLevelStartPoints - levelStartPoints))));

  const croins = Number(profile?.croin_balance) || 0;

  useEffect(() => {
    if (!g) return;

    let unsubProfile = () => {};
    let unsubQuests = () => {};
    let leaderboardSub = null;

    try {
      if (typeof g.initForCurrentUser === 'function') {
        g.initForCurrentUser().catch(() => {});
      }
      if (typeof g.subscribeUserProfile === 'function') {
        unsubProfile = g.subscribeUserProfile(setProfile);
      }
      if (typeof g.subscribeUserQuests === 'function') {
        unsubQuests = g.subscribeUserQuests(setQuests);
      }

      if (typeof g.subscribeLeaderboard === 'function') {
        leaderboardSub = g.subscribeLeaderboard(20);
      }
    } catch (e) {
      console.warn('[LevelUp] subscriptions failed:', e);
    }

    const onLeaderboard = (ev) => {
      setLeaderboard(Array.isArray(ev?.detail) ? ev.detail : []);
    };
    window.addEventListener('LeaderboardUpdated', onLeaderboard);

    return () => {
      try { unsubProfile(); } catch {}
      try { unsubQuests(); } catch {}
      try { leaderboardSub?.unsubscribe?.(); } catch {}
      window.removeEventListener('LeaderboardUpdated', onLeaderboard);
    };
  }, [g]);

  useEffect(() => {
    if (!Array.isArray(quests) || quests.length === 0) return;

    const prev = lastQuestStatusesRef.current;
    let fireFx = false;

    quests.forEach((q) => {
      const key = q?.quest_id || q?.id;
      if (!key) return;
      const prevStatus = prev.get(key);
      const nextStatus = q?.status;
      if (prevStatus === 'claimable' && nextStatus === 'completed') {
        fireFx = true;
      }
      prev.set(key, nextStatus);
    });

    if (fireFx) {
      setClaimFx({ active: true, at: Date.now() });
      setTimeout(() => setClaimFx({ active: false, at: Date.now() }), 1200);
    }
  }, [quests]);

  const activeQuestRows = useMemo(() => {
    const byId = new Map((Array.isArray(quests) ? quests : []).map((q) => [q?.quest_id || q?.id, q]));
    return Object.keys(questDefs).map((id) => {
      const q = byId.get(id) || { quest_id: id, status: 'locked', progress: 0, target: questDefs[id]?.target ?? null };
      return { ...q, ...questDefs[id] };
    });
  }, [quests, questDefs]);

  function CoinIcon() {
    return React.createElement('span', {
      style: {
        display: 'inline-flex',
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: 'linear-gradient(180deg, #fbbf24, #f59e0b)',
        boxShadow: '0 6px 18px rgba(245, 158, 11, 0.35)',
        color: '#1f2937',
        fontWeight: 900,
        marginRight: 8
      }
    }, 'C');
  }

  async function handleStartQuest(id) {
    try {
      await g?.startQuest?.(id);
      if (id === 'wallet_link') {
        await g?.syncAttachWalletQuest?.();
      }
    } catch (e) {
      console.warn('[LevelUp] start quest failed', e);
    }
  }

  async function handleClaimQuest(id) {
    const res = await g?.claimQuest?.(id);
    if (res && res.ok === false && res.error) {
      try { alert(res.error); } catch {}
    }
  }

  function formatTime(ms) {
    const v = Math.max(0, Number(ms) || 0);
    const totalSeconds = Math.floor(v / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  return (
    <div className="screen">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '0.75rem'
      }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f7f9ff', letterSpacing: '-0.02em' }}>LevelUp</div>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Quests, CRoins, and Global Ranking</div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="secondary-button" onClick={onGoHome}>← Home</button>
          <button className="secondary-button" onClick={onGoToTree}>🌳 Tree</button>
        </div>
      </div>

      {claimFx.active && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: 999,
            background: 'rgba(16, 185, 129, 0.18)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#d1fae5',
            fontWeight: 800,
            backdropFilter: 'blur(6px)',
            transform: 'translateY(-10px)',
            animation: 'levelup-pop 1.2s ease-out forwards'
          }}>
            Quest completed
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: 16,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Current Level</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f7f9ff', letterSpacing: '-0.02em' }}>{level} / 15</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Lifetime Points</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e5e7eb' }}>{points.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.8rem', marginBottom: 6 }}>
              <div>{levelStartPoints.toLocaleString()}</div>
              <div>{nextLevelStartPoints.toLocaleString()}</div>
            </div>
            <div style={{ width: '100%', height: 10, background: 'rgba(148, 163, 184, 0.25)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round(progressToNext * 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                transition: 'width 0.35s ease'
              }} />
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {React.createElement(CoinIcon)}
              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>CRoins Balance</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fde68a' }}>{croins.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.85rem' }}>
              In-app time: {formatTime(profile?.in_app_time_ms)}
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: 16,
          padding: '1.25rem'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Profile</div>
          <div style={{ marginTop: 6, fontSize: '1.05rem', color: '#f7f9ff', fontWeight: 800 }}>
            {profile?.nickname || profile?.display_name || g?.maskWallet?.(profile?.wallet_address) || 'Anonymous'}
          </div>
          <div style={{ marginTop: 10, color: '#94a3b8', fontSize: '0.85rem' }}>
            Preferred field: {profile?.preferred_crypto_field || 'Not set'}
          </div>
          <div style={{ marginTop: 10, color: '#94a3b8', fontSize: '0.85rem' }}>
            Bubble bounces: {Number(profile?.stats?.bubble_bounces) || 0}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: 16,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: 10 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f7f9ff' }}>Active Quests</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Start, progress, claim</div>
          </div>

          <div style={{ maxHeight: 360, overflow: 'auto', paddingRight: 6 }}>
            {activeQuestRows.map((q) => {
              const status = q.status || 'locked';
              const progress = Number(q.progress) || 0;
              const target = q.target != null ? (Number(q.target) || 0) : null;
              const pct = target ? Math.max(0, Math.min(1, progress / Math.max(1, target))) : 0;

              const canStart = status === 'locked' || status === 'in_progress';
              const canClaim = status === 'claimable';
              const isDone = status === 'completed';

              return (
                <div key={q.id} style={{
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: 12,
                  padding: '0.9rem',
                  marginBottom: '0.75rem',
                  background: isDone ? 'rgba(16, 185, 129, 0.08)' : canClaim ? 'rgba(251, 191, 36, 0.08)' : 'rgba(59, 130, 246, 0.06)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: '#f7f9ff' }}>{q.title}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 4 }}>{q.description}</div>
                      {target != null && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', marginBottom: 6 }}>
                            <div>{progress} / {target}</div>
                            <div>{Math.round(pct * 100)}%</div>
                          </div>
                          <div style={{ width: '100%', height: 8, background: 'rgba(148, 163, 184, 0.25)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.round(pct * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #a78bfa, #60a5fa)', transition: 'width 0.35s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Reward</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, color: '#fde68a', fontWeight: 900 }}>
                        {React.createElement(CoinIcon)}
                        +{Number(q.reward || 0).toLocaleString()}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {canStart && (
                          <button
                            className="secondary-button"
                            onClick={() => handleStartQuest(q.id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            {status === 'in_progress' ? 'Active' : 'Start'}
                          </button>
                        )}
                        {canClaim && (
                          <button
                            className="primary-button"
                            onClick={() => handleClaimQuest(q.id)}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: '#10b981' }}
                          >
                            Claim
                          </button>
                        )}
                        {isDone && (
                          <button
                            className="secondary-button"
                            disabled
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', opacity: 0.7 }}
                          >
                            Completed
                          </button>
                        )}
                      </div>

                      <div style={{ marginTop: 8, color: canClaim ? '#fde68a' : isDone ? '#a7f3d0' : '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                        {status.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: 16,
          padding: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: 10 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f7f9ff' }}>Global Ranking</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Live</div>
          </div>

          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>#</th>
                  <th style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>User</th>
                  <th style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Field</th>
                  <th style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>Time</th>
                  <th style={{ padding: '0.5rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.2)', textAlign: 'right' }}>CRoins</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((u, idx) => {
                  const name = u.nickname || u.display_name || g?.maskWallet?.(u.wallet_address) || 'Anonymous';
                  return (
                    <tr key={u.uid || u.id || idx} style={{ color: '#e5e7eb' }}>
                      <td style={{ padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.12)', color: '#94a3b8' }}>{idx + 1}</td>
                      <td style={{ padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.12)', fontWeight: 800 }}>{name}</td>
                      <td style={{ padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.12)', color: '#94a3b8' }}>{u.preferred_crypto_field || '—'}</td>
                      <td style={{ padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.12)', color: '#94a3b8' }}>{formatTime(u.in_app_time_ms)}</td>
                      <td style={{ padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(148, 163, 184, 0.12)', textAlign: 'right', fontWeight: 900, color: '#fde68a' }}>{Number(u.croin_balance || 0).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '0.75rem 0.25rem', color: '#94a3b8' }}>Loading leaderboard…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes levelup-pop {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          20% { opacity: 1; transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(-10px) scale(1); }
          100% { opacity: 0; transform: translateY(-22px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

// Error Boundary for LevelUp
class LevelUpErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('LevelUp Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'screen',
        style: { padding: '2rem', textAlign: 'center' }
      }, [
        React.createElement('h2', { key: 'title' }, 'Level Up - Error'),
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

// Wrapped component with error boundary
function SafeLevelUpScreen(props) {
  return React.createElement(LevelUpErrorBoundary, null,
    React.createElement(LevelUpScreen, props)
  );
}

// Atomic registration with safety checks
(function registerLevelUpScreen() {
  try {
    // Guard against React not being available
    if (typeof React === 'undefined') {
      console.warn('React not available during LevelUpScreen registration');
      return;
    }
    // Guard against overwriting existing registration
    if (window.LevelUpScreen && typeof window.LevelUpScreen === 'function') {
      console.log('LevelUpScreen already registered, skipping');
      return;
    }
    window.LevelUpScreen = SafeLevelUpScreen;
    console.log('✅ LevelUpScreen registered successfully');
    try {
      window.dispatchEvent(new Event('LevelUpScreenReady'));
    } catch (e) {
      console.warn('Failed to dispatch LevelUpScreenReady:', e);
    }
  } catch (error) {
    console.error('Failed to register LevelUpScreen:', error);
  }
})();