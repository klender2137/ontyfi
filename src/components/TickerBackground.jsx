import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/*
TickerBackground
Electric-network ticker system

Concept:
- Nodes form a graph mesh
- Links = beams
- Tickers propagate through links like electrical pulses
*/

const NODE_COUNT = 40;
const LINK_DISTANCE = 220;

const random = (min, max) => Math.random() * (max - min) + min;

function createNodes(width, height) {
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      id: i,
      x: random(0, width),
      y: random(0, height)
    });
  }
  return nodes;
}

function createLinks(nodes) {
  const links = [];
  nodes.forEach(a => {
    nodes.forEach(b => {
      if (a.id === b.id) return;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < LINK_DISTANCE && Math.random() > 0.55) {
        links.push({
          from: a.id,
          to: b.id
        });
      }
    });
  });

  return links;
}

export default function TickerBackground({
  updateInterval = 30000,
  tickerCount = 30,
  opacity = 0.35
}) {
  const [tickers, setTickers] = useState([]);
  const [packets, setPackets] = useState([]);

  const svgRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);

  const fetchTickers = useCallback(async () => {
    try {
      const r = await fetch(`/api/finance/tickers?count=${tickerCount}`);
      const j = await r.json();
      if (j.ok) setTickers(j.data);
    } catch {}
  }, [tickerCount]);

  useEffect(() => {
    fetchTickers();
    const i = setInterval(fetchTickers, updateInterval);
    return () => clearInterval(i);
  }, [fetchTickers, updateInterval]);

  /* initialize network */

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const nodes = createNodes(w, h);
    const links = createLinks(nodes);

    nodesRef.current = nodes;
    linksRef.current = links;
  }, []);

  /* spawn ticker packets */

  useEffect(() => {
    if (!tickers.length) return;

    const interval = setInterval(() => {
      const ticker = tickers[Math.floor(Math.random() * tickers.length)];
      const link =
        linksRef.current[Math.floor(Math.random() * linksRef.current.length)];

      if (!link) return;

      setPackets(p => [
        ...p,
        {
          id: Math.random(),
          progress: 0,
          speed: random(0.002, 0.006),
          ticker,
          link
        }
      ]);
    }, 600);

    return () => clearInterval(interval);
  }, [tickers]);

  /* animation loop */

  useEffect(() => {
    let frame;

    const animate = () => {
      setPackets(packets =>
        packets
          .map(p => ({ ...p, progress: p.progress + p.speed }))
          .filter(p => p.progress < 1)
      );

      frame = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(frame);
  }, []);

  const nodes = nodesRef.current;
  const links = linksRef.current;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: -1,
        opacity
      }}
    >
      <svg ref={svgRef} width="100%" height="100%">
        {/* beams */}
        {links.map((l, i) => {
          const a = nodes[l.from];
          const b = nodes[l.to];

          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(120,160,255,0.25)"
              strokeWidth="1"
            />
          );
        })}

        {/* nodes */}
        {nodes.map(n => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r="2"
            fill="rgba(180,200,255,0.5)"
          />
        ))}

        {/* ticker packets */}
        {packets.map(packet => {
          const a = nodes[packet.link.from];
          const b = nodes[packet.link.to];

          const x = a.x + (b.x - a.x) * packet.progress;
          const y = a.y + (b.y - a.y) * packet.progress;

          const positive = packet.ticker.change >= 0;

          const text = `${packet.ticker.symbol} $${packet.ticker.price.toFixed(
            2
          )}`;

          return (
            <g key={packet.id}>
              <circle
                cx={x}
                cy={y}
                r="3"
                fill={positive ? "#4ade80" : "#f87171"}
              />

              <text
                x={x + 6}
                y={y - 6}
                fontSize="11"
                fill={positive ? "#4ade80" : "#f87171"}
                fontFamily="monospace"
              >
                {text}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}