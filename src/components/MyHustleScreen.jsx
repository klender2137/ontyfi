import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Utility functions
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

const hashString = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Crystal mesh generation - FULLSCREEN VERSION
const generateCrystalMesh = ({ cols = 16, rows = 10, anchorCount = 12, figures = [], frame = { width: 100, height: 100 } }) => {
  const rand = mulberry32(hashString('crystal-mesh:fullscreen:v3'));
  const anchors = [];

  // anchors from crystals (strong influence)
  figures.forEach(f => {
    anchors.push({
      x: f.cx,
      y: f.cy,
      dx: (rand() - 0.5) * 10,
      dy: (rand() - 0.5) * 10,
      r: f.r * 3
    });
  });

  // ambient anchors
  for (let i = 0; i < anchorCount; i++) {
    anchors.push({
      x: rand() * 100,
      y: rand() * 100,
      dx: (rand() - 0.5) * 20,
      dy: (rand() - 0.5) * 20,
      r: 20 + rand() * 30
    });
  }

  // Add corner anchors for better frame fitting
  const cornerAnchors = [
    { x: 2, y: 2, dx: rand() * 8, dy: rand() * 8, r: 15 },
    { x: 98, y: 2, dx: -(rand() * 8), dy: rand() * 8, r: 15 },
    { x: 2, y: 98, dx: rand() * 8, dy: -(rand() * 8), r: 15 },
    { x: 98, y: 98, dx: -(rand() * 8), dy: -(rand() * 8), r: 15 }
  ];
  anchors.push(...cornerAnchors);

  const warp = (x, y) => {
    let ox = 0, oy = 0;
    for (const a of anchors) {
      const dx = x - a.x;
      const dy = y - a.y;
      const d2 = dx * dx + dy * dy;
      const r2 = a.r * a.r;
      const w = Math.exp(-d2 / Math.max(1e-6, r2));
      ox += a.dx * w;
      oy += a.dy * w;
    }

    // Border falloff to prevent distortion outside frame
    const borderFalloff = (v) => {
      const edge = 10;
      if (v < edge) return v / edge;
      if (v > 100 - edge) return (100 - v) / edge;
      return 1;
    };

    const warpedX = x + ox * borderFalloff(x);
    const warpedY = y + oy * borderFalloff(y);

    // Ensure warped points stay within frame bounds
    const clampedX = Math.max(0, Math.min(frame.width, warpedX));
    const clampedY = Math.max(0, Math.min(frame.height, warpedY));
    return { x: clampedX, y: clampedY };
  };

  const grid = [];
  for (let gy = 0; gy <= rows; gy++) {
    for (let gx = 0; gx <= cols; gx++) {
      const x = (gx / cols) * frame.width;
      const y = (gy / rows) * frame.height;
      const p = warp(x, y);
      grid.push({ gx, gy, x: p.x, y: p.y });
    }
  }

  const idx = (gx, gy) => gy * (cols + 1) + gx;
  const segs = [];
  for (let gy = 0; gy <= rows; gy++) {
    for (let gx = 0; gx <= cols; gx++) {
      const p = grid[idx(gx, gy)];
      if (gx < cols) {
        const pr = grid[idx(gx + 1, gy)];
        segs.push([p, pr]);
      }
      if (gy < rows) {
        const pd = grid[idx(gx, gy + 1)];
        segs.push([p, pd]);
      }
      // Add diagonal connections for more organic mesh
      if (gx < cols && gy < rows && ((gx + gy) % 3 === 0)) {
        const pdr = grid[idx(gx + 1, gy + 1)];
        segs.push([p, pdr]);
      }
    }
  }

  const crystals = figures.map((fig) => {
    const rLocal = mulberry32(hashString(`crystal:${fig.id}`));
    const corners = clamp(fig.corners || (6 + Math.floor(rLocal() * 8)), 5, 12);
    const angles = Array.from({ length: corners }, (_, i) => {
      const base = (Math.PI * 2 * i) / corners;
      const jitter = (rLocal() - 0.5) * (Math.PI * 2) * 0.08;
      return base + jitter;
    }).sort((a, b) => a - b);

    const baseR = fig.r || (10 + rLocal() * 5);
    const pts = angles.map((ang) => {
      const rr = baseR * (0.85 + rLocal() * 0.3);
      const x = fig.cx + Math.cos(ang) * rr;
      const y = fig.cy + Math.sin(ang) * rr;
      return warp(x, y);
    });

    const d = `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;

    return {
      ...fig,
      corners,
      d,
      labelX: warp(fig.cx, fig.cy).x,
      labelY: warp(fig.cx, fig.cy).y,
      warpedPoints: pts
    };
  });

  return { segs, crystals, anchors };
};

// Crystal Grid Component - FULLSCREEN VERSION WITH EQUAL AREA ELEMENTS
const CrystalGrid = ({ sections, onSelect }) => {
  const figures = useMemo(() => {
    // Create a perfect grid layout for 10 elements
    const gridPositions = [
      { x: 0.15, y: 0.15 }, // Top-left
      { x: 0.85, y: 0.15 }, // Top-right
      { x: 0.50, y: 0.25 }, // Top-center
      { x: 0.25, y: 0.40 }, // Upper-middle-left
      { x: 0.75, y: 0.40 }, // Upper-middle-right
      { x: 0.15, y: 0.65 }, // Bottom-left
      { x: 0.85, y: 0.65 }, // Bottom-right
      { x: 0.50, y: 0.75 }, // Bottom-center
      { x: 0.35, y: 0.55 }, // Middle-left
      { x: 0.65, y: 0.55 }  // Middle-right
    ];

    // Base radius for equal area - calculate so all elements fit within screen
    const baseRadius = 7.5; // Base radius in viewport units
    const areaVariation = 0.1; // 10% max variation

    return sections.map((s, i) => {
      const pos = gridPositions[i] || { x: 0.5, y: 0.5 };
      const rLocal = mulberry32(hashString(`figure:${s.id}`));

      // Apply area variation (±10%)
      const radiusMultiplier = 1 + (rLocal() - 0.5) * 2 * areaVariation;
      const r = baseRadius * radiusMultiplier;

      // Ensure elements stay within screen boundaries
      // Convert percentage positions to actual coordinates
      const cx = Math.max(r + 2, Math.min(100 - r - 2, pos.x * 100));
      const cy = Math.max(r + 2, Math.min(100 - r - 2, pos.y * 100));

      const corners = 6 + Math.floor(rLocal() * 6); // 6-12 corners

      return {
        id: s.id,
        label: s.name,
        cx,
        cy,
        r,
        corners,
        accent: s.accent,
        sectionData: s
      };
    });
  }, [sections]);

  const mesh = useMemo(() => generateCrystalMesh({
    cols: 28,
    rows: 18,
    anchorCount: 16,
    figures,
    frame: { width: 100, height: 100 }
  }), [figures]);

  const svgRef = useRef(null);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        background: 'radial-gradient(circle at 25% 25%, rgba(96,165,250,0.08) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168,85,247,0.08) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.06) 0%, transparent 50%)'
      }}
      role="img"
      aria-label="Crystal mesh grid"
    >
      <defs>
        <filter
          id="crystalGlow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="1.0" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.9 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id="meshGlow"
          x="-25%"
          y="-25%"
          width="150%"
          height="150%"
        >
          <feGaussianBlur stdDeviation="0.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.7 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <mask id="crystalMask">
          <rect
            x={0}
            y={0}
            width={100}
            height={100}
            fill="white"
          />
          {mesh.crystals.map(c =>
            <path
              key={c.id}
              d={c.d}
              fill="black"
            />
          )}
        </mask>
      </defs>
      {/* Mesh grid background */}
      <g opacity="0.8" mask="url(#crystalMask)">
        {mesh.segs.map((seg, i) =>
          <path
            key={`mesh-${i}`}
            d={`M ${seg[0].x.toFixed(2)} ${seg[0].y.toFixed(2)} L ${seg[1].x.toFixed(2)} ${seg[1].y.toFixed(2)}`}
            stroke="rgba(148, 163, 184, 0.32)"
            strokeWidth="0.15"
            fill="none"
            vectorEffect="non-scaling-stroke"
            filter="url(#meshGlow)"
          />
        )}
      </g>
      {/* Crystal section elements - all equal area with 10% variation */}
      {mesh.crystals.map((c) =>
        <g key={c.id}>
          {/* Crystal shape */}
          <path
            d={c.d}
            fill="rgba(2, 6, 23, 0.5)"
            stroke={c.accent}
            strokeOpacity="0.8"
            strokeWidth="0.4"
            filter="url(#crystalGlow)"
          />
          {/* Interactive overlay */}
          <path
            d={c.d}
            fill="transparent"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1.8"
            strokeLinejoin="round"
            opacity="0.7"
            pointerEvents="stroke"
            onClick={() => onSelect(c.id)}
            style={{ cursor: 'pointer' }}
          />
          {/* Section label - positioned to stay within bounds */}
          <text
            x={Math.max(5, Math.min(95, c.labelX))}
            y={Math.max(8, Math.min(92, c.labelY))}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(247, 249, 255, 0.98)"
            fontSize="3.8"
            fontWeight="900"
            letterSpacing="0.1"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {c.label}
          </text>
          {/* Coming soon indicator for sections that aren't live yet */}
          {c.sectionData && c.sectionData.comingSoon && (
            <text
              x={Math.max(5, Math.min(95, c.labelX))}
              y={Math.max(12, Math.min(96, c.labelY + 4.5))}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(251, 191, 36, 0.9)"
              fontSize="2.2"
              fontWeight="800"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              SOON
            </text>
          )}
          {/* Main click area - ensure it's within bounds */}
          <path
            d={c.d}
            fill="transparent"
            onClick={() => onSelect(c.id)}
            style={{ cursor: 'pointer' }}
          />
        </g>
      )}
    </svg>
  );
};

// Data hook for hustles
const useHustlesV2Data = ({ categories, enabled = true } = {}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const categoryList = Array.isArray(categories)
      ? categories.filter(Boolean)
      : categories
        ? [categories]
        : null;

    let didFallbackToClientFilter = false;
    let unsubscribe = null;

    const trySubscribe = (withServerFilter) => {
      try {
        if (!window.firebase || !window.firebase.firestore) {
          console.error('[MyHustle] Firebase not available, retrying...');
          setTimeout(() => trySubscribe(withServerFilter), 1000);
          return;
        }

        const db = window.firebase.firestore();
        let query = db.collection('hustles_v2').orderBy('date_added', 'desc');

        if (withServerFilter && categoryList && categoryList.length > 0) {
          if (categoryList.length === 1) {
            query = query.where('category', '==', categoryList[0]);
          } else {
            query = query.where('category', 'in', categoryList.slice(0, 10));
          }
        }

        // Add timeout to prevent infinite loading
        const loadingTimeout = setTimeout(() => {
          if (loading) {
            console.warn('[MyHustle] Loading timeout - showing fallback');
            setLoading(false);
            setError('Loading timeout. Please refresh the page.');
          }
        }, 10000); // 10 second timeout

        unsubscribe = query.onSnapshot(
          (snapshot) => {
            let next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

            if (!withServerFilter && categoryList && categoryList.length > 0) {
              didFallbackToClientFilter = true;
              next = next.filter((d) => categoryList.includes(d?.category || d?.type));
            }

            setItems(next);
            setLoading(false);
            clearTimeout(loadingTimeout); // Clear timeout on success
            setError(
              didFallbackToClientFilter
                ? 'Using client-side filtering (Firestore index not available).'
                : null
            );
          },
          (err) => {
            if (withServerFilter) {
              console.warn('[MyHustle] Category query failed, retrying without server filter:', err);
              trySubscribe(false);
              return;
            }
            console.error('[MyHustle] Subscription failed:', err);
            clearTimeout(loadingTimeout); // Clear timeout on error
            setItems([]);
            setLoading(false);
            setError(err?.message || 'Failed to load hustles_v2');
          }
        );
      } catch (e) {
        console.error('[MyHustle] Firebase error:', e);
        // Fallback to mock data
        const mockData = [
          {
            id: 'mock-1',
            title: 'Ethereum Staking Rewards',
            category: 'yield_llama',
            short_description: 'Earn passive income by staking ETH on the beacon chain',
            date_added: new window.firebase.firestore.Timestamp(Date.now() / 1000 - 7200, 0),
            source: 'Ethereum Foundation',
            network: 'Ethereum',
            link: 'https://ethereum.org/staking'
          },
          {
            id: 'mock-2',
            title: 'Arbitrum Airdrop Season 2',
            category: 'airdrop',
            short_description: 'Eligible users can claim ARB tokens from the second airdrop round',
            date_added: new window.firebase.firestore.Timestamp(Date.now() / 1000 - 21600, 0),
            source: 'Arbitrum DAO',
            network: 'Arbitrum',
            link: 'https://arbitrum.foundation/'
          }
        ];
        
        let filteredMock = mockData;
        if (categoryList && categoryList.length > 0) {
          filteredMock = mockData.filter(item => categoryList.includes(item.category));
        }
        
        setItems(filteredMock);
        setLoading(false);
        setError('Using mock data - Firebase unavailable');
      }
    };

    trySubscribe(true);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [categories, enabled]);

  return { items, loading, error };
};

// Main MyHustleScreen Component
const MyHustleScreen = () => {
  const navigate = useNavigate();
  const [activeSectionId, setActiveSectionId] = useState(null);

  const sections = useMemo(
    () => [
      { id: 'mev', name: 'MEV', categories: ['mev'], accent: 'rgba(168, 85, 247, 1)' },
      { id: 'airdrops', name: 'Airdrops', categories: ['airdrop'], accent: 'rgba(34, 211, 238, 1)' },
      { id: 'defi_yields', name: 'DeFi(Yields)', categories: ['yield_llama', 'yield_coindix'], accent: 'rgba(16, 185, 129, 1)' },
      { id: 'socifi', name: 'SociFi', comingSoon: true, accent: 'rgba(96, 165, 250, 1)' },
      { id: 'rwa', name: 'RWA', comingSoon: true, accent: 'rgba(251, 191, 36, 1)' },
      { id: 'node_operating', name: 'Node Operating', comingSoon: true, accent: 'rgba(244, 63, 94, 1)' },
      { id: 'gamify', name: 'GamiFY', comingSoon: true, accent: 'rgba(14, 165, 233, 1)' },
      { id: 'lrt', name: 'LRT', comingSoon: true, accent: 'rgba(139, 92, 246, 1)' },
      { id: 'depin', name: 'DePIN', comingSoon: true, accent: 'rgba(45, 212, 191, 1)' },
      { id: 'memes', name: 'Memes', comingSoon: true, accent: 'rgba(248, 113, 113, 1)' }
    ],
    []
  );

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) || null,
    [activeSectionId, sections]
  );

  const shouldFetch = !!activeSection && !activeSection.comingSoon;
  const { items: hustleItems, loading, error } = useHustlesV2Data({
    categories: activeSection?.categories || null,
    enabled: shouldFetch
  });

  const itemsForActiveSection = useMemo(() => {
    if (!activeSection) return [];
    if (activeSection.comingSoon) return [];
    return hustleItems || [];
  }, [activeSection, hustleItems]);

  const openUrl = (url) => {
    try {
      if (!url) return;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('MyHustle openUrl error:', e);
    }
  };

  return (
    <div style={{
      background: '#050816',
      color: '#f7f9ff',
      minHeight: '100vh',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>{`
        .mhRoot { 
          min-height: 100vh; 
          position: relative; 
          overflow: hidden; 
          display: flex;
          flex-direction: column;
        }
        .mhTopbar { 
          position: relative; 
          z-index: 10; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 18px 20px; 
          background: 'rgba(2, 6, 23, 0.95)';
          backdropFilter: 'blur(10px)';
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)';
        }
        .mhTopbar h2 { margin: 0; font-size: 20px; letter-spacing: 0.2px; }
        .mhBtn { 
          padding: 10px 12px; 
          background: rgba(148, 163, 184, 0.15); 
          color: #f7f9ff; 
          border: 1px solid rgba(148, 163, 184, 0.25); 
          border-radius: 10px; 
          cursor: pointer; 
          font-size: 14px;
        }
        .mhBtn:hover { background: rgba(148, 163, 184, 0.22); }
        .mhStage { 
          position: relative; 
          flex: 1;
          min-height: calc(100vh - 64px);
          background: '#1e293b';
          overflow: hidden;
        }
        .mhGridView, .mhSubView { 
          position: absolute; 
          inset: 0; 
          padding: 0;
          transition: opacity 260ms ease, transform 260ms ease; 
          z-index: 2; 
          overflow: hidden;
          box-sizing: border-box;
        }
        .mhGridView.hidden { opacity: 0; transform: scale(0.98); pointer-events: none; }
        .mhSubView.hidden { opacity: 0; transform: translateY(10px); pointer-events: none; }
        .mhGridStage { 
          position: absolute; 
          inset: 0; 
          z-index: 3; 
          overflow: hidden;
        }
        .mhSubHeader { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          gap: 12px; 
          margin-bottom: 14px; 
          position: relative;
          z-index: 5;
        }
        .mhSubTitle { 
          display: flex; 
          flex-direction: column; 
          gap: 2px; 
          max-width: 70%;
        }
        .mhSubTitle h3 { 
          margin: 0; 
          font-size: 18px; 
          letter-spacing: 0.3px; 
          text-shadow: 0 0 10px rgba(0,0,0,0.5);
        }
        .mhSubTitle div { 
          color: #94a3b8; 
          font-size: 13px; 
        }
        .mhCards { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); 
          gap: 16px; 
          max-width: 100%;
          padding: 0 4px;
        }
        .mhCard { 
          padding: 18px; 
          background: rgba(2, 6, 23, 0.6); 
          border: 1px solid rgba(148, 163, 184, 0.25); 
          border-radius: 16px; 
          cursor: pointer; 
          position: relative; 
          transition: transform 180ms ease, border-color 180ms ease; 
          backdrop-filter: blur(10px);
        }
        .mhCard:hover { 
          transform: translateY(-2px); 
          border-color: rgba(148, 163, 184, 0.4); 
        }
        .mhChipRow { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          gap: 10px; 
          margin-bottom: 12px; 
        }
        .mhChip { 
          font-size: 11px; 
          font-weight: 800; 
          padding: 4px 10px; 
          border-radius: 999px; 
          border: 1px solid rgba(255,255,255,0.18); 
          background: rgba(255,255,255,0.08); 
        }
        .mhTime { 
          position: absolute; 
          top: 14px; 
          right: 14px; 
          background: rgba(2, 6, 23, 0.7); 
          border: 1px solid rgba(148, 163, 184, 0.25); 
          color: #cbd5e1; 
          padding: 3px 8px; 
          border-radius: 999px; 
          font-size: 11px; 
          font-weight: 800; 
          z-index: 1;
        }
        .mhCardTitle { 
          margin: 0 0 10px; 
          font-size: 17px; 
          line-height: 1.3;
        }
        .mhCardBody { 
          margin: 0 0 12px; 
          color: #94a3b8; 
          line-height: 1.5; 
          font-size: 14px;
        }
        .mhMeta { 
          font-size: 12px; 
          color: #6b7280; 
        }
        .mhGridText {
          position: absolute;
          top: 20px;
          left: 20px;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 600;
          z-index: 4;
          text-shadow: 0 0 8px rgba(0,0,0,0.8);
        }
        @media (max-width: 520px) {
          .mhCards { grid-template-columns: 1fr; }
          .mhSubTitle h3 { font-size: 16px; }
          .mhCard { padding: 16px; }
          .mhCardTitle { font-size: 16px; }
        }
      `}</style>
      <div className="mhRoot">
        <div className="mhTopbar">
          <h2>My Hustle</h2>
          <button 
            className="mhBtn" 
            onClick={() => navigate('/')} 
          >
            ← Home
          </button>
        </div>
        <div className="mhStage">
          {/* Fullscreen background gradients */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 20% 20%, rgba(96,165,250,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 70%, rgba(34,211,238,0.12) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)',
              zIndex: 1
            }}
          />
          <div className={`mhGridView ${activeSection ? 'hidden' : ''}`}>
            <div className="mhGridText">
              Crystal Mesh • Live from hustles_v2 • Click crystals to explore sections
            </div>
            <div className="mhGridStage">
              <CrystalGrid 
                sections={sections} 
                onSelect={setActiveSectionId} 
              />
            </div>
          </div>
          <div className={`mhSubView ${activeSection ? '' : 'hidden'}`}>
            <div className="mhSubHeader">
              <div className="mhSubTitle">
                <h3>{activeSection ? activeSection.name : ''}</h3>
                <div>
                  {activeSection
                    ? activeSection.comingSoon
                      ? 'Coming Soon - Crystal calibrating...'
                      : `${itemsForActiveSection.length} blocks • Real-time data`
                    : ''
                  }
                </div>
              </div>
              <button 
                className="mhBtn" 
                onClick={() => setActiveSectionId(null)} 
              >
                ← Mesh View
              </button>
            </div>
            {activeSection && activeSection.comingSoon
              ? <div className="mhCards">
                  <div 
                    className="mhCard" 
                    style={{ cursor: 'default', maxWidth: '400px', margin: '0 auto' }} 
                  >
                    <div className="mhChipRow">
                      <span className="mhChip">Scanning</span>
                      <span className="mhChip">alpha</span>
                    </div>
                    <h4 className="mhCardTitle">Crystal Formation in Progress</h4>
                    <p className="mhCardBody">
                      This crystal sector is still crystallizing. New scrapers will stream data into this formation soon. The mesh adapts and grows with each new data point.
                    </p>
                  </div>
                </div>
              : <div className="mhCards">
                  {loading && <div 
                    className="mhCard" 
                    style={{ cursor: 'default', gridColumn: '1 / -1', maxWidth: '400px', margin: '0 auto' }} 
                  >
                    <div className="mhChipRow">
                      <span className="mhChip">Loading</span>
                      <span className="mhChip">hustles_v2</span>
                    </div>
                    <h4 className="mhCardTitle">Crystallizing Alpha Data...</h4>
                    <p className="mhCardBody">Scanning the crypto multiverse for opportunities. The crystal mesh is aligning with real-time market data.</p>
                  </div>}
                  {!loading && error && <div 
                    className="mhCard" 
                    style={{ cursor: 'default', gridColumn: '1 / -1', maxWidth: '500px', margin: '0 auto' }} 
                  >
                    <div className="mhChipRow">
                      <span className="mhChip">Warning</span>
                      <span className="mhChip">feed</span>
                    </div>
                    <h4 className="mhCardTitle">Crystal Mesh Disruption</h4>
                    <p 
                      className="mhCardBody" 
                      style={{ color: '#fbbf24' }} 
                    >
                      {error}
                    </p>
                  </div>}
                  {itemsForActiveSection.map((item) => {
                    const title = item?.title || item?.name || 'Block';
                    const description = shortText(item?.short_description || item?.description || item?.summary || '');
                    const timeAgo = formatTimeAgo(item?.date_added || item?.timestamp || item?.addedAt);
                    const source = item?.source || item?.scraper || item?.origin || 'Source';

                    return (
                      <div
                        key={item.id}
                        className="mhCard"
                        role="button"
                        tabIndex={0}
                        onClick={() => item?.link && openUrl(item.link)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && item?.link) {
                            e.preventDefault();
                            openUrl(item.link);
                          }
                        }}
                      >
                        {timeAgo && <div className="mhTime">{timeAgo}</div>}
                        <div className="mhChipRow">
                          <span className="mhChip">{source}</span>
                          <span className="mhChip">{item?.category || item?.tier || item?.risk_score || item?.network || item?.chain || 'alpha'}</span>
                        </div>
                        <h4 className="mhCardTitle">{title}</h4>
                        {description && <p className="mhCardBody">{description}</p>}
                        <div className="mhMeta">
                          {(item?.network || item?.chain) ? `Network: ${item.network || item.chain}` : null}
                        </div>
                      </div>
                    );
                  })}
                </div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyHustleScreen;