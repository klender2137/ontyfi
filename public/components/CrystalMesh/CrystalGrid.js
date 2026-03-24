/**
 * Crystal Mesh UI Components - UI Only
 * Crystal mesh visualization component
 */

if (typeof window !== 'undefined' && window.React) {
  const { useMemo, useRef, useEffect } = React;

  // Utility functions for mesh generation
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

  const generateCrystalMesh = ({ cols = 16, rows = 10, anchorCount = 12, figures = [], frame = { width: 100, height: 100 } }) => {
    const rand = mulberry32(hashString('crystal-mesh:fullscreen:v3'));
    const anchors = [];

    figures.forEach(f => {
      anchors.push({
        x: f.cx,
        y: f.cy,
        dx: (rand() - 0.5) * 10,
        dy: (rand() - 0.5) * 10,
        r: f.r * 3
      });
    });

    for (let i = 0; i < anchorCount; i++) {
      anchors.push({
        x: rand() * 100,
        y: rand() * 100,
        dx: (rand() - 0.5) * 20,
        dy: (rand() - 0.5) * 20,
        r: 20 + rand() * 30
      });
    }

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
      const borderFalloff = (v) => {
        const edge = 10;
        if (v < edge) return v / edge;
        if (v > 100 - edge) return (100 - v) / edge;
        return 1;
      };
      const warpedX = x + ox * borderFalloff(x);
      const warpedY = y + oy * borderFalloff(y);
      return { x: Math.max(0, Math.min(frame.width, warpedX)), y: Math.max(0, Math.min(frame.height, warpedY)) };
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
      return {
        ...fig,
        corners,
        d: `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`,
        labelX: warp(fig.cx, fig.cy).x,
        labelY: warp(fig.cx, fig.cy).y,
        warpedPoints: pts
      };
    });

    return { segs, crystals, anchors };
  };

  const CrystalGrid = ({ sections, onSelect }) => {
    const instanceId = React.useMemo(() => Math.random().toString(36).substr(2, 9), []);
    const safeSections = Array.isArray(sections) ? sections : [];
    
    if (safeSections.length === 0) {
      console.warn('[CrystalGrid] No sections provided');
      return React.createElement('div', { 
        style: { 
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: '14px'
        } 
      }, 'No sections configured');
    }
    const figures = useMemo(() => {
      const gridPositions = [
        { x: 0.15, y: 0.15 }, { x: 0.85, y: 0.15 }, { x: 0.50, y: 0.25 },
        { x: 0.25, y: 0.40 }, { x: 0.75, y: 0.40 }, { x: 0.15, y: 0.65 },
        { x: 0.85, y: 0.65 }, { x: 0.50, y: 0.75 }, { x: 0.35, y: 0.55 },
        { x: 0.65, y: 0.55 }
      ];
      const baseRadius = 7.5;
      return sections.map((s, i) => {
        const pos = gridPositions[i] || { x: 0.5, y: 0.5 };
        const rLocal = mulberry32(hashString(`figure:${s.id}`));
        const r = baseRadius * (1 + (rLocal() - 0.5) * 0.2);
        const cx = Math.max(r + 2, Math.min(100 - r - 2, pos.x * 100));
        const cy = Math.max(r + 2, Math.min(100 - r - 2, pos.y * 100));
        return { id: s.id, label: s.name, cx, cy, r, corners: 6 + Math.floor(rLocal() * 6), accent: s.accent, sectionData: s };
      });
    }, [sections]);

    const mesh = useMemo(() => generateCrystalMesh({
      cols: 28, rows: 18, anchorCount: 16, figures, frame: { width: 100, height: 100 }
    }), [figures]);

    return React.createElement('svg', {
      width: '100%', height: '100%', viewBox: '0 0 100 100', preserveAspectRatio: 'none',
      style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, background: 'radial-gradient(circle at 25% 25%, rgba(96,165,250,0.08) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(168,85,247,0.08) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.06) 0%, transparent 50%)' }
    },
      React.createElement('defs', null,
        React.createElement('filter', { id: `crystalGlow-${instanceId}`, x: '-50%', y: '-50%', width: '200%', height: '200%' },
          React.createElement('feGaussianBlur', { stdDeviation: '1.0', result: 'blur' }),
          React.createElement('feColorMatrix', { in: 'blur', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.9 0', result: 'glow' }),
          React.createElement('feMerge', null, React.createElement('feMergeNode', { in: 'glow' }), React.createElement('feMergeNode', { in: 'SourceGraphic' }))
        ),
        React.createElement('filter', { id: `meshGlow-${instanceId}`, x: '-25%', y: '-25%', width: '150%', height: '150%' },
          React.createElement('feGaussianBlur', { stdDeviation: '0.4', result: 'blur' }),
          React.createElement('feColorMatrix', { in: 'blur', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.7 0', result: 'glow' }),
          React.createElement('feMerge', null, React.createElement('feMergeNode', { in: 'glow' }), React.createElement('feMergeNode', { in: 'SourceGraphic' }))
        ),
        React.createElement('mask', { id: `crystalMask-${instanceId}` },
          React.createElement('rect', { x: 0, y: 0, width: 100, height: 100, fill: 'white' }),
          mesh.crystals.map(c => React.createElement('path', { key: c.id, d: c.d, fill: 'black' }))
        )
      ),
      React.createElement('g', { opacity: '0.8', mask: `url(#crystalMask-${instanceId})` },
        mesh.segs.map((seg, i) => React.createElement('path', { key: `mesh-${i}`, d: `M ${seg[0].x.toFixed(2)} ${seg[0].y.toFixed(2)} L ${seg[1].x.toFixed(2)} ${seg[1].y.toFixed(2)}`, stroke: 'rgba(148, 163, 184, 0.32)', strokeWidth: '0.15', fill: 'none', vectorEffect: 'non-scaling-stroke', filter: `url(#meshGlow-${instanceId})` }))
      ),
      mesh.crystals.map((c) => React.createElement('g', { key: c.id },
        React.createElement('path', { d: c.d, fill: 'rgba(2, 6, 23, 0.5)', stroke: c.accent, strokeOpacity: '0.8', strokeWidth: '0.4', filter: `url(#crystalGlow-${instanceId})` }),
        React.createElement('path', { d: c.d, fill: 'transparent', stroke: 'rgba(255,255,255,0.1)', strokeWidth: '1.8', strokeLinejoin: 'round', opacity: '0.7', pointerEvents: 'stroke', onClick: () => onSelect(c.id), style: { cursor: 'pointer' } }),
        React.createElement('text', { x: Math.max(5, Math.min(95, c.labelX)), y: Math.max(8, Math.min(92, c.labelY)), textAnchor: 'middle', dominantBaseline: 'middle', fill: 'rgba(247, 249, 255, 0.98)', fontSize: '3.8', fontWeight: '900', letterSpacing: '0.1', style: { userSelect: 'none', pointerEvents: 'none' } }, c.label),
        c.sectionData && c.sectionData.comingSoon && React.createElement('text', { x: Math.max(5, Math.min(95, c.labelX)), y: Math.max(12, Math.min(96, c.labelY + 4.5)), textAnchor: 'middle', dominantBaseline: 'middle', fill: 'rgba(251, 191, 36, 0.9)', fontSize: '2.2', fontWeight: '800', style: { userSelect: 'none', pointerEvents: 'none' } }, 'SOON'),
        React.createElement('path', { d: c.d, fill: 'transparent', onClick: () => onSelect(c.id), style: { cursor: 'pointer' } })
      ))
    );
  };

  window.CrystalGrid = CrystalGrid;
  console.log('[CrystalGrid] Component registered successfully');
}
