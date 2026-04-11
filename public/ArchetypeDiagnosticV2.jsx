import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:    "#080B14",
  panel: "#0D1220",
  card:  "#111827",
  border:"rgba(255,255,255,0.07)",
  muted: "#4B5563",
  dim:   "#9CA3AF",
  text:  "#E5E7EB",
  hi:    "#F9FAFB",
  accent:"#6366F1",
  accentL:"rgba(99,102,241,0.15)",
  green: "#10B981",
  red:   "#EF4444",
  amber: "#F59E0B",
};

const s = (obj) => Object.entries(obj).map(([k,v])=>
  k.replace(/([A-Z])/g,"-$1").toLowerCase()+":"+v).join(";");

// ─── FIELD DEFINITIONS ───────────────────────────────────────────────────────
const FIELDS = {
  QuantFin:  { label:"Quant Finance",    arch:"The Architect",   color:"#6366F1", traits:{ Speed:70, Precision:95, Risk:60, Social:20, Technical:95, Narrative:30, Stability:55, Endurance:75, Calibration:85, WorkingMemory:90 }},
  IB:        { label:"Investment Banking",arch:"The Gladiator",   color:"#EF4444", traits:{ Speed:85, Precision:65, Risk:70, Social:90, Technical:40, Narrative:75, Stability:30, Endurance:95, Calibration:55, WorkingMemory:65 }},
  VC:        { label:"Venture Capital",  arch:"The Visionary",   color:"#10B981", traits:{ Speed:65, Precision:35, Risk:85, Social:75, Technical:50, Narrative:95, Stability:20, Endurance:60, Calibration:45, WorkingMemory:55 }},
  RiskM:     { label:"Risk Management",  arch:"The Sentry",      color:"#3B82F6", traits:{ Speed:40, Precision:92, Risk:15, Social:40, Technical:82, Narrative:35, Stability:95, Endurance:65, Calibration:90, WorkingMemory:80 }},
  HedgeFund: { label:"Hedge Funds",      arch:"The Gambler",     color:"#F59E0B", traits:{ Speed:95, Precision:70, Risk:92, Social:50, Technical:78, Narrative:55, Stability:18, Endurance:82, Calibration:75, WorkingMemory:70 }},
  FPA:       { label:"FP&A",             arch:"The Navigator",   color:"#8B5CF6", traits:{ Speed:38, Precision:88, Risk:28, Social:55, Technical:82, Narrative:50, Stability:88, Endurance:60, Calibration:80, WorkingMemory:85 }},
  AssetMgmt: { label:"Asset Management", arch:"The Guardian",    color:"#06B6D4", traits:{ Speed:48, Precision:70, Risk:42, Social:82, Technical:60, Narrative:68, Stability:82, Endurance:55, Calibration:65, WorkingMemory:60 }},
  PublicFin: { label:"Public Finance",   arch:"The Diplomat",    color:"#64748B", traits:{ Speed:32, Precision:58, Risk:18, Social:72, Technical:42, Narrative:88, Stability:92, Endurance:48, Calibration:55, WorkingMemory:50 }},
  PE:        { label:"Private Equity",   arch:"The Surgeon",     color:"#EC4899", traits:{ Speed:62, Precision:82, Risk:78, Social:68, Technical:65, Narrative:88, Stability:38, Endurance:95, Calibration:70, WorkingMemory:72 }},
};

const WEIGHTS = {
  QuantFin:  { Speed:0.5, Precision:1.0, Risk:0.5, Social:0.2, Technical:1.0, Narrative:0.2, Stability:0.4, Endurance:0.6, Calibration:0.9, WorkingMemory:0.9 },
  IB:        { Speed:0.8, Precision:0.5, Risk:0.6, Social:1.0, Technical:0.3, Narrative:0.8, Stability:0.2, Endurance:1.0, Calibration:0.4, WorkingMemory:0.5 },
  VC:        { Speed:0.5, Precision:0.2, Risk:0.9, Social:0.7, Technical:0.4, Narrative:1.0, Stability:0.1, Endurance:0.5, Calibration:0.3, WorkingMemory:0.4 },
  RiskM:     { Speed:0.3, Precision:1.0, Risk:0.2, Social:0.3, Technical:0.9, Narrative:0.2, Stability:1.0, Endurance:0.6, Calibration:1.0, WorkingMemory:0.8 },
  HedgeFund: { Speed:1.0, Precision:0.6, Risk:1.0, Social:0.4, Technical:0.7, Narrative:0.5, Stability:0.1, Endurance:0.7, Calibration:0.7, WorkingMemory:0.6 },
  FPA:       { Speed:0.2, Precision:0.9, Risk:0.2, Social:0.5, Technical:0.9, Narrative:0.4, Stability:0.9, Endurance:0.5, Calibration:0.8, WorkingMemory:0.9 },
  AssetMgmt: { Speed:0.3, Precision:0.6, Risk:0.3, Social:0.9, Technical:0.5, Narrative:0.6, Stability:0.9, Endurance:0.4, Calibration:0.6, WorkingMemory:0.5 },
  PublicFin: { Speed:0.2, Precision:0.4, Risk:0.1, Social:0.7, Technical:0.3, Narrative:1.0, Stability:1.0, Endurance:0.4, Calibration:0.4, WorkingMemory:0.4 },
  PE:        { Speed:0.5, Precision:0.8, Risk:0.8, Social:0.6, Technical:0.6, Narrative:0.9, Stability:0.3, Endurance:1.0, Calibration:0.7, WorkingMemory:0.7 },
};

// ─── SCORING ENGINE ──────────────────────────────────────────────────────────
// Uses standardized cosine similarity with per-field weighting
// Avoids the "everyone gets 80%" problem by computing true distributional fit
function computeResult(rawTraits) {
  const traitKeys = Object.keys(rawTraits);

  // Normalize user traits to 0-1
  const uNorm = {};
  traitKeys.forEach(t => { uNorm[t] = rawTraits[t] / 100; });

  const scores = Object.entries(FIELDS).map(([key, field]) => {
    const w = WEIGHTS[key];
    // Compute weighted dot product and magnitudes
    let dot = 0, uMag = 0, fMag = 0;
    traitKeys.forEach(t => {
      const wt = w[t] || 0;
      const u = uNorm[t];
      const f = field.traits[t] / 100;
      dot  += wt * u * f;
      uMag += wt * u * u;
      fMag += wt * f * f;
    });
    const cosSim = dot / (Math.sqrt(uMag) * Math.sqrt(fMag) + 1e-9);

    // Also compute weighted RMSE as a penalty for large deviations
    const rmse = Math.sqrt(
      traitKeys.reduce((acc, t) => {
        const wt = w[t] || 0;
        return acc + wt * Math.pow((uNorm[t] - field.traits[t]/100), 2);
      }, 0) / traitKeys.length
    );

    // Combined score: cosine similarity penalized by RMSE
    const combined = cosSim * (1 - 0.6 * rmse);
    return { key, combined, cosSim, rmse };
  });

  scores.sort((a, b) => b.combined - a.combined);

  // Convert to meaningful percentages — spread across the real range
  const top = scores[0].combined;
  const bottom = scores[scores.length - 1].combined;
  const range = top - bottom;

  return scores.map(s => ({
    ...s,
    pct: Math.round(((s.combined - bottom) / (range + 1e-9)) * 65 + 20), // 20-85% realistic spread
  }));
}

// ─── TRAIT MERGER ────────────────────────────────────────────────────────────
const DEFAULT_TRAITS = { Speed:50, Precision:50, Risk:50, Social:50, Technical:50, Narrative:50, Stability:50, Endurance:50, Calibration:50, WorkingMemory:50 };

function mergeTraits(base, update) {
  const next = { ...base };
  // Use exponential moving average — later answers weight more
  Object.entries(update).forEach(([k, v]) => {
    if (next[k] !== undefined) next[k] = Math.round(next[k] * 0.45 + v * 0.55);
  });
  return next;
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 6 }}>
        <span style={{ fontSize:11, color:C.muted, letterSpacing:"0.1em" }}>Q {step+1} / {total}</span>
        <span style={{ fontSize:11, color:C.muted }}>{pct}%</span>
      </div>
      <div style={{ height:2, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:C.accent, borderRadius:2, transition:"width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
    </div>
  );
}

function QShell({ label, title, desc, children }) {
  return (
    <div>
      <div style={{ fontSize:10, color:C.accent, letterSpacing:"0.15em", fontWeight:600, marginBottom:6, textTransform:"uppercase" }}>{label}</div>
      <h2 style={{ fontSize:17, fontWeight:600, color:C.hi, marginBottom: desc ? 6 : 20, lineHeight:1.3 }}>{title}</h2>
      {desc && <p style={{ fontSize:13, color:C.dim, marginBottom:20, lineHeight:1.6 }}>{desc}</p>}
      {children}
    </div>
  );
}

function Btn({ onClick, disabled, children, secondary, style: extra }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"11px 20px", borderRadius:8, border: secondary ? `1px solid ${C.border}` : "none",
      background: secondary ? "transparent" : C.accent, color: secondary ? C.dim : "#fff",
      fontSize:13, fontWeight:500, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.35 : 1, transition:"opacity 0.2s", ...extra,
    }}>{children}</button>
  );
}

// ─── Q1: CASCADING CRISIS TRIAGE ─────────────────────────────────────────────
// User sees 6 simultaneous alerts. Must click to dismiss in order of priority.
// Measures: Speed, Precision (choosing the right order), Endurance
const CRISIS_EVENTS = [
  { id:"a", sev:5, text:"Client calling re: $40M misallocated funds — live call", trait_boost:{Speed:20,Social:15} },
  { id:"b", sev:4, text:"Compliance filing deadline in 12 min — system access lost", trait_boost:{Precision:20,Stability:15} },
  { id:"c", sev:3, text:"Junior analyst spreadsheet error — £2M understatement in deck", trait_boost:{Precision:15,Technical:15} },
  { id:"d", sev:2, text:"MD waiting for updated model — meeting in 30 min", trait_boost:{Endurance:10,Speed:10} },
  { id:"e", sev:1, text:"Reuters journalist emailed — wants comment on deal rumour", trait_boost:{Narrative:10,Social:10} },
  { id:"f", sev:2, text:"Server threw 500 error on pricing API — portfolio at stale data", trait_boost:{Technical:15,Risk:10} },
];
const IDEAL_ORDER = ["a","b","c","f","d","e"]; // by severity descending with tie-breaks

function Q1({ onAnswer }) {
  const [dismissed, setDismissed] = useState([]);
  const [startTime] = useState(Date.now());
  const [done, setDone] = useState(false);

  function dismiss(id) {
    if (dismissed.includes(id) || done) return;
    const next = [...dismissed, id];
    setDismissed(next);
    if (next.length === CRISIS_EVENTS.length) setDone(true);
  }

  function submit() {
    const elapsed = (Date.now() - startTime) / 1000;
    // Compute Kendall tau between user order and ideal order
    let concordant = 0, discordant = 0;
    for (let i = 0; i < dismissed.length; i++) {
      for (let j = i+1; j < dismissed.length; j++) {
        const ui = IDEAL_ORDER.indexOf(dismissed[i]), uj = IDEAL_ORDER.indexOf(dismissed[j]);
        if (ui < uj) concordant++; else discordant++;
      }
    }
    const tau = (concordant - discordant) / (concordant + discordant + 1e-9);
    const orderScore = Math.round((tau + 1) / 2 * 100); // 0-100
    const speedScore = Math.max(10, Math.min(100, Math.round(110 - elapsed * 1.5)));
    const traits = { Speed: speedScore, Precision: orderScore, Endurance: Math.round((orderScore + speedScore) / 2) };
    // Add trait boosts from the first 2 dismissed
    [dismissed[0], dismissed[1]].forEach(id => {
      const ev = CRISIS_EVENTS.find(e => e.id === id);
      if (ev) Object.entries(ev.trait_boost).forEach(([t,v]) => { traits[t] = Math.min(100, (traits[t] || 50) + v * 0.4); });
    });
    onAnswer(traits);
  }

  const remaining = CRISIS_EVENTS.filter(e => !dismissed.includes(e.id));
  const sevColors = { 5:"#EF4444", 4:"#F59E0B", 3:"#6366F1", 2:"#10B981", 1:C.muted };

  return (
    <QShell label="Stress Response" title="Inbox on fire — triage these alerts"
      desc="Click to dismiss each alert in the order you would actually handle them. Your sequence is measured.">
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {CRISIS_EVENTS.map((ev, idx) => {
          const isDone = dismissed.includes(ev.id);
          const rank = dismissed.indexOf(ev.id) + 1;
          return (
            <div key={ev.id} onClick={() => dismiss(ev.id)} style={{
              display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
              background: isDone ? "rgba(255,255,255,0.03)" : C.card,
              border:`0.5px solid ${isDone ? "rgba(255,255,255,0.04)" : sevColors[ev.sev]+"40"}`,
              borderLeft: `3px solid ${isDone ? "rgba(255,255,255,0.1)" : sevColors[ev.sev]}`,
              borderRadius:8, cursor: isDone ? "default" : "pointer",
              opacity: isDone ? 0.35 : 1, transition:"all 0.2s",
            }}>
              <div style={{
                width:20, height:20, borderRadius:"50%", border:`1.5px solid ${isDone ? C.muted : sevColors[ev.sev]}`,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                background: isDone ? C.muted+"30" : "transparent", fontSize:11, fontWeight:600, color: isDone ? C.muted : sevColors[ev.sev],
              }}>{isDone ? rank : ev.sev}</div>
              <span style={{ fontSize:13, color: isDone ? C.muted : C.text, textDecoration: isDone ? "line-through" : "none" }}>
                {ev.text}
              </span>
            </div>
          );
        })}
      </div>
      <Btn onClick={submit} disabled={!done} style={{ width:"100%" }}>Submit triage order</Btn>
    </QShell>
  );
}

// ─── Q2: PATTERN UNDER NOISE ─────────────────────────────────────────────────
// A 10×10 grid of numbers (1-9). One 3×3 subgrid sums to a different total than the rest.
// User must identify WHICH region. 60 second timer. Tests: Technical, Precision, WorkingMemory
function Q2({ onAnswer }) {
  const SIZE = 8;
  const { grid, answerRow, answerCol } = useMemo(() => {
    const g = Array.from({length:SIZE}, () => Array.from({length:SIZE}, () => Math.floor(Math.random()*9)+1));
    const ar = Math.floor(Math.random()*(SIZE-2));
    const ac = Math.floor(Math.random()*(SIZE-2));
    // Make 3×3 subgrid values all +3 (biased high)
    for (let r=ar; r<ar+3; r++) for (let c=ac; c<ac+3; c++) g[r][c] = Math.min(9, g[r][c]+3);
    return { grid:g, answerRow:ar, answerCol:ac };
  }, []);

  const [sel, setSel] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => {
      if (e >= 59) { clearInterval(timerRef.current); setDone(true); return 60; }
      return e+1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const cellsPerRegion = 3;
  const regions = [];
  for (let r=0; r<=SIZE-cellsPerRegion; r+=cellsPerRegion)
    for (let c=0; c<=SIZE-cellsPerRegion; c+=cellsPerRegion)
      regions.push({ r, c });

  function selectRegion(r, c) {
    if (done && sel) return;
    setSel({r,c});
    clearInterval(timerRef.current);
    setDone(true);
  }

  function submit() {
    const correct = sel && sel.r===answerRow && sel.c===answerCol;
    const timeBonus = Math.max(0, 60-elapsed);
    const precScore = correct ? Math.round(50 + timeBonus * 0.8) : 15;
    const techScore = correct ? Math.round(50 + timeBonus * 0.6) : 20;
    const wmScore   = correct ? Math.round(45 + timeBonus * 0.7) : 18;
    onAnswer({ Precision: precScore, Technical: techScore, WorkingMemory: wmScore });
  }

  const timeLeft = 60 - elapsed;
  const pct = timeLeft / 60;

  // Highlight cells that are in the selected region
  function inRegion(r,c,reg) { return reg && r>=reg.r && r<reg.r+3 && c>=reg.c && c<reg.c+3; }

  return (
    <QShell label="Pattern Recognition" title="Find the anomalous region"
      desc="One 3×3 block has a systematically different numerical pattern. Click any cell within it. 60 seconds.">
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
          <div style={{ height:"100%", width:`${pct*100}%`, background: pct>.5?C.green:pct>.25?C.amber:C.red, borderRadius:2, transition:"width 1s linear" }} />
        </div>
        <span style={{ fontSize:12, fontWeight:600, color:pct>.25?C.dim:C.red, minWidth:28 }}>{timeLeft}s</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${SIZE},1fr)`, gap:3, marginBottom:16, fontFamily:"monospace" }}>
        {grid.map((row,r) => row.map((val,c) => {
          const highlighted = inRegion(r,c,sel);
          const isAnswer = done && r>=answerRow && r<answerRow+3 && c>=answerCol && c<answerCol+3;
          return (
            <div key={`${r}-${c}`} onClick={() => !done && selectRegion(r-(r%3), c-(c%3))}
              style={{
                aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:600,
                background: isAnswer && done ? (sel?.r===answerRow&&sel?.c===answerCol ? "#10B98120":"#EF444420")
                  : highlighted ? `${C.accent}25` : "rgba(255,255,255,0.04)",
                border:`0.5px solid ${isAnswer && done ? (sel?.r===answerRow ? "#10B98150":"#EF444450") : highlighted ? C.accent+"60" : "rgba(255,255,255,0.05)"}`,
                borderRadius:3, cursor: done?"default":"pointer", color: val>7?"#F59E0B":val<4?"#6366F1":C.dim,
                transition:"background 0.15s",
              }}>{val}</div>
          );
        }))}
      </div>
      {(done || sel) && <Btn onClick={submit} style={{ width:"100%" }}>Submit</Btn>}
      {!done && !sel && <div style={{ height:40 }} />}
    </QShell>
  );
}

// ─── Q3: WORKING MEMORY — SEQUENCE RECALL ────────────────────────────────────
// Show a sequence of 9 numbers for 4 seconds, then ask user to enter them backwards.
// Tests: WorkingMemory, Precision
function Q3({ onAnswer }) {
  const seq = useMemo(() => Array.from({length:9}, () => Math.floor(Math.random()*9)+1), []);
  const [phase, setPhase] = useState("show"); // show | recall | done
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(4);
  const timerRef = useRef(null);

  useEffect(() => {
    if (phase !== "show") return;
    timerRef.current = setInterval(() => setTimeLeft(t => {
      if (t <= 1) { clearInterval(timerRef.current); setPhase("recall"); return 0; }
      return t-1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  function submit() {
    const userDigits = input.replace(/\s/g,"").split("").map(Number);
    const reversed = [...seq].reverse();
    let correct = 0;
    reversed.forEach((d,i) => { if (userDigits[i] === d) correct++; });
    const score = Math.round((correct / seq.length) * 100);
    onAnswer({ WorkingMemory: score, Precision: Math.round(score * 0.9), Technical: Math.round(score * 0.7) });
  }

  return (
    <QShell label="Working Memory" title="Memorise and reverse"
      desc={phase==="show" ? `Memorise this ${seq.length}-digit sequence. You will type it backwards.` : "Type the sequence backwards (right to left). No spaces needed."}>
      {phase === "show" && (
        <div>
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
            {seq.map((d,i) => (
              <div key={i} style={{
                width:42, height:52, display:"flex", alignItems:"center", justifyContent:"center",
                background:C.card, border:`1px solid ${C.accent}50`, borderRadius:8,
                fontSize:22, fontWeight:700, color:C.hi, fontFamily:"monospace",
              }}>{d}</div>
            ))}
          </div>
          <div style={{ textAlign:"center", color:C.amber, fontSize:13, fontWeight:600 }}>Disappearing in {timeLeft}s…</div>
        </div>
      )}
      {phase === "recall" && (
        <div>
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20, flexWrap:"wrap" }}>
            {seq.map((_,i) => (
              <div key={i} style={{
                width:42, height:52, display:"flex", alignItems:"center", justifyContent:"center",
                background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.08)`, borderRadius:8,
                fontSize:22, fontWeight:700, color:C.muted, fontFamily:"monospace",
              }}>?</div>
            ))}
          </div>
          <input value={input} onChange={e=>setInput(e.target.value)} maxLength={9}
            placeholder="Type 9 digits reversed…" autoFocus
            style={{
              width:"100%", padding:"12px 14px", background:C.card, border:`1px solid ${C.border}`,
              borderRadius:8, color:C.hi, fontSize:18, fontFamily:"monospace", letterSpacing:"0.2em",
              textAlign:"center", outline:"none", marginBottom:16,
            }} />
          <Btn onClick={submit} disabled={input.replace(/\s/g,"").length < seq.length} style={{ width:"100%" }}>Submit</Btn>
        </div>
      )}
    </QShell>
  );
}

// ─── Q4: ETHICAL RANKER ──────────────────────────────────────────────────────
const Q4_SCENARIOS = [
  { id:"a", label:"Tell a client their mandate lost 18% due to your model error", trait:"Risk" },
  { id:"b", label:"Sign off on a deal that will eliminate 1,200 jobs — legally sound", trait:"Narrative" },
  { id:"c", label:"Work every weekend for 3 years to make MD", trait:"Endurance" },
  { id:"d", label:"Spend entire career in a role with no external visibility", trait:"Social" },
  { id:"e", label:"Approve a product you believe is priced to extract from retail investors", trait:"Stability" },
  { id:"f", label:"Relocate to a city you dislike for the highest-paying role", trait:"Speed" },
];

function Q4({ onAnswer }) {
  const [order, setOrder] = useState(Q4_SCENARIOS.map(s=>s.id));
  const [dragId, setDragId] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  function handleDrop(toIdx) {
    if (dragId === null) return;
    const fromIdx = order.indexOf(dragId);
    if (fromIdx === toIdx) return;
    const next = [...order];
    next.splice(fromIdx,1);
    next.splice(toIdx,0,dragId);
    setOrder(next); setDragId(null); setOverIdx(null);
  }

  function submit() {
    const traits = {};
    order.forEach((id,rank) => {
      const s = Q4_SCENARIOS.find(x=>x.id===id);
      // Most tolerable (rank 0) = high tolerance for that stressor
      traits[s.trait] = Math.round(Math.max(15, 100 - rank * 15));
    });
    onAnswer(traits);
  }

  return (
    <QShell label="Tolerance Mapping" title="Rank these professional trade-offs"
      desc="Drag from most tolerable (top) to absolutely unacceptable (bottom). Your ranking reveals what you can sustain.">
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {order.map((id,idx) => {
          const sc = Q4_SCENARIOS.find(x=>x.id===id);
          const isOver = overIdx === idx;
          return (
            <div key={id} draggable
              onDragStart={()=>setDragId(id)}
              onDragOver={e=>{e.preventDefault();setOverIdx(idx);}}
              onDragLeave={()=>setOverIdx(null)}
              onDrop={()=>handleDrop(idx)}
              onDragEnd={()=>{setDragId(null);setOverIdx(null);}}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
                background: isOver ? `${C.accent}15` : dragId===id ? "rgba(255,255,255,0.02)" : C.card,
                border:`0.5px solid ${isOver ? C.accent+"80" : "rgba(255,255,255,0.07)"}`,
                borderRadius:8, cursor:"grab", opacity: dragId===id ? 0.5 : 1, transition:"background 0.1s",
                userSelect:"none",
              }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:14, fontFamily:"monospace" }}>{idx+1}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity:0.3, flexShrink:0 }}>
                <rect y="1" width="12" height="1.5" rx="0.75" fill="white"/>
                <rect y="5" width="12" height="1.5" rx="0.75" fill="white"/>
                <rect y="9" width="12" height="1.5" rx="0.75" fill="white"/>
              </svg>
              <span style={{ fontSize:13, color:C.text, lineHeight:1.4 }}>{sc.label}</span>
            </div>
          );
        })}
      </div>
      <Btn onClick={submit} style={{ width:"100%" }}>Confirm ranking</Btn>
    </QShell>
  );
}

// ─── Q5: SIGNAL vs NOISE — DATA TABLE AUDIT ──────────────────────────────────
// Show a 6-row financial table. 2 cells have errors. User must click them.
function Q5({ onAnswer }) {
  // Generate a plausible revenue table with 2 planted errors
  const rows = useMemo(() => {
    const base = [
      { dept:"Equities",   rev:142, cost:89,  margin:null, hc:34, revPerHC:null },
      { dept:"FICC",       rev:218, cost:156, margin:null, hc:52, revPerHC:null },
      { dept:"IBD",        rev:98,  cost:71,  margin:null, hc:28, revPerHC:null },
      { dept:"AM",         rev:76,  cost:38,  margin:null, hc:19, revPerHC:null },
      { dept:"Prime",      rev:184, cost:109, margin:null, hc:41, revPerHC:null },
      { dept:"Research",   rev:44,  cost:36,  margin:null, hc:18, revPerHC:null },
    ];
    // Compute correct values
    base.forEach(r => { r.margin = Math.round((r.rev-r.cost)/r.rev*100); r.revPerHC = Math.round(r.rev/r.hc*10)/10; });
    // Plant 2 errors: wrong margin and wrong revPerHC
    const errorCells = new Set();
    while (errorCells.size < 2) errorCells.add(Math.floor(Math.random()*6));
    const errArr = [...errorCells];
    const correctMargins = base.map(r=>r.margin);
    const correctRevPerHC = base.map(r=>r.revPerHC);
    base[errArr[0]].margin = correctMargins[errArr[0]] + (Math.random()<0.5?-12:15); // deliberate error
    base[errArr[1]].revPerHC = Math.round((correctRevPerHC[errArr[1]] * 1.38)*10)/10;
    return { rows: base, errorRows: errArr, correctMargins, correctRevPerHC };
  }, []);

  const [clicked, setClicked] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(()=>setElapsed(e=>e+1), 1000);
    return ()=>clearInterval(timerRef.current);
  }, []);

  function toggleCell(cellId) {
    if (submitted) return;
    setClicked(prev => prev.includes(cellId) ? prev.filter(x=>x!==cellId) : prev.length<2 ? [...prev,cellId] : prev);
  }

  function submit() {
    clearInterval(timerRef.current);
    setSubmitted(true);
    const errorCellIds = [`${rows.errorRows[0]}-margin`, `${rows.errorRows[1]}-revPerHC`];
    const correctFound = clicked.filter(c=>errorCellIds.includes(c)).length;
    const wrongClicked = clicked.filter(c=>!errorCellIds.includes(c)).length;
    const netScore = Math.round(((correctFound * 50) - (wrongClicked * 20)) * (1 - elapsed * 0.004));
    const finalScore = Math.max(5, Math.min(100, netScore));
    onAnswer({ Precision: finalScore, Technical: Math.round(finalScore*0.9), WorkingMemory: Math.round(finalScore*0.8) });
  }

  const cols = ["Dept","Rev ($M)","Cost ($M)","Margin %","HC","Rev/HC"];
  const cellKey = (ri, col) => `${ri}-${col}`;

  return (
    <QShell label="Audit Eye" title="Two cells in this table contain errors"
      desc="Click exactly 2 cells you believe are wrong. Timer running. Margin % = (Rev−Cost)/Rev. Rev/HC = Rev÷HC.">
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
        <span style={{ fontSize:11, color:C.muted }}>Time elapsed: {elapsed}s</span>
        <span style={{ marginLeft:"auto", fontSize:11, color:C.dim }}>Selected: {clicked.length}/2</span>
      </div>
      <div style={{ overflowX:"auto", marginBottom:16 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"monospace" }}>
          <thead>
            <tr>{cols.map(c=>(
              <th key={c} style={{ padding:"8px 10px", color:C.muted, fontWeight:500, borderBottom:`1px solid ${C.border}`, textAlign:"left", whiteSpace:"nowrap" }}>{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.rows.map((row,ri)=>(
              <tr key={ri}>
                <td style={{ padding:"8px 10px", color:C.dim, borderBottom:`0.5px solid rgba(255,255,255,0.04)` }}>{row.dept}</td>
                {["rev","cost"].map(col=>(
                  <td key={col} style={{ padding:"8px 10px", color:C.text, borderBottom:`0.5px solid rgba(255,255,255,0.04)` }}>{row[col]}</td>
                ))}
                {["margin","revPerHC"].map(col=>{
                  const cid = cellKey(ri,col);
                  const isClicked = clicked.includes(cid);
                  const isError = submitted && rows.errorRows.includes(ri) && ((col==="margin"&&ri===rows.errorRows[0])||(col==="revPerHC"&&ri===rows.errorRows[1]));
                  const isWrong = submitted && isClicked && !isError;
                  return (
                    <td key={col} onClick={()=>toggleCell(cid)} style={{
                      padding:"8px 10px", cursor: submitted?"default":"pointer",
                      background: isError && submitted ? "#10B98115" : isWrong ? "#EF444415" : isClicked ? `${C.accent}20` : "transparent",
                      border: isClicked ? `0.5px solid ${submitted?(isError?C.green:C.red):C.accent}` : `0.5px solid transparent`,
                      borderRadius:4, color: isClicked ? C.hi : C.text, fontWeight: isClicked?600:400,
                      transition:"all 0.15s",
                    }}>
                      {col==="margin"?`${row.margin}%`:row.revPerHC}
                    </td>
                  );
                })}
                <td style={{ padding:"8px 10px", color:C.text, borderBottom:`0.5px solid rgba(255,255,255,0.04)` }}>{row.hc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!submitted
        ? <Btn onClick={submit} disabled={clicked.length!==2} style={{ width:"100%" }}>Submit audit</Btn>
        : <Btn onClick={()=>{
            const errorCellIds=[`${rows.errorRows[0]}-margin`,`${rows.errorRows[1]}-revPerHC`];
            const cf=clicked.filter(c=>errorCellIds.includes(c)).length;
            const wc=clicked.filter(c=>!errorCellIds.includes(c)).length;
            const net=Math.max(5,Math.min(100,Math.round(((cf*50)-(wc*20))*(1-elapsed*0.004))));
            onAnswer({Precision:net,Technical:Math.round(net*.9),WorkingMemory:Math.round(net*.8)});
          }} style={{ width:"100%" }}>Continue</Btn>}
    </QShell>
  );
}

// ─── Q6: NARRATIVE BUILDER ───────────────────────────────────────────────────
const Q6_CHIPS = {
  Verb:    [{v:"Deconstructing",t:"Technical"},{v:"Brokering",t:"Social"},{v:"Hedging",t:"Risk"},{v:"Institutionalising",t:"Stability"},{v:"Disrupting",t:"Narrative"}],
  Subject: [{v:"illiquid credit",t:"Risk"},{v:"a hostile takeover",t:"Endurance"},{v:"a regulatory framework",t:"Stability"},{v:"an early-stage thesis",t:"Narrative"},{v:"a derivative structure",t:"Technical"}],
  Outcome: [{v:"generates alpha no-one else sees",t:"Technical"},{v:"closes in 48 hours",t:"Speed"},{v:"outlasts market cycles",t:"Stability"},{v:"redefines an industry",t:"Narrative"},{v:"protects the downside",t:"Risk"}],
};

function Q6({ onAnswer }) {
  const [sel, setSel] = useState({Verb:null,Subject:null,Outcome:null});
  const ready = sel.Verb && sel.Subject && sel.Outcome;

  function submit() {
    const traits = {Technical:45,Social:45,Risk:45,Stability:45,Narrative:45,Endurance:45,Speed:45,Precision:50,WorkingMemory:50,Calibration:50};
    [sel.Verb,sel.Subject,sel.Outcome].forEach(c=>{if(c&&traits[c.t]!==undefined)traits[c.t]=Math.min(100,traits[c.t]+28);});
    onAnswer(traits);
  }

  return (
    <QShell label="Motivation Profile" title="Build your professional sentence"
      desc="Choose one from each row. The combination reveals your intrinsic drive.">
      <div style={{ background:"rgba(99,102,241,0.08)", border:`1px solid ${C.accent}30`, borderRadius:10, padding:"16px 18px", marginBottom:22, fontSize:14, lineHeight:2.4, fontStyle:"italic", color:C.text }}>
        {"I get genuine satisfaction from "}
        <ChipSlot val={sel.Verb?.v} />
        {" "}
        <ChipSlot val={sel.Subject?.v} />
        {" that "}
        <ChipSlot val={sel.Outcome?.v} />
        {"."}
      </div>
      {Object.entries(Q6_CHIPS).map(([cat,chips])=>(
        <div key={cat} style={{ marginBottom:16 }}>
          <p style={{ fontSize:10, color:C.muted, marginBottom:8, fontWeight:600, letterSpacing:"0.12em" }}>{cat.toUpperCase()}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {chips.map(c=>{
              const active = sel[cat]?.v===c.v;
              return <button key={c.v} onClick={()=>setSel(s=>({...s,[cat]:c}))} style={{
                padding:"6px 13px", fontSize:12, borderRadius:20,
                background: active?C.accent:"rgba(255,255,255,0.05)",
                border:`0.5px solid ${active?C.accent:"rgba(255,255,255,0.1)"}`,
                color: active?"#fff":C.dim, fontWeight:active?500:400, cursor:"pointer",
              }}>{c.v}</button>;
            })}
          </div>
        </div>
      ))}
      <Btn onClick={submit} disabled={!ready} style={{ width:"100%", marginTop:8 }}>Confirm</Btn>
    </QShell>
  );
}

function ChipSlot({ val }) {
  return <span style={{ borderBottom:`1.5px solid ${val?C.accent:"rgba(255,255,255,0.15)"}`, padding:"0 5px", color:val?C.accent:C.muted, fontStyle:"normal", fontWeight:val?600:400 }}>{val||"___"}</span>;
}

// ─── Q7: CALIBRATION — PROBABILITY ESTIMATION ────────────────────────────────
// User estimates probabilities for 5 financial events. Brier score measures calibration.
const Q7_EVENTS = [
  { q:"A randomly selected S&P 500 stock beats the index over 12 months", truth:38 },
  { q:"A Series A startup founded today reaches a $1B valuation", truth:1 },
  { q:"A 10-year US Treasury held to maturity defaults", truth:1 },
  { q:"An IB analyst promoted to associate within 3 years of joining", truth:55 },
  { q:"A hedge fund that outperformed last year outperforms again next year", truth:47 },
];

function Q7({ onAnswer }) {
  const [vals, setVals] = useState(Q7_EVENTS.map(()=>50));

  function submit() {
    // Brier score: lower is better calibration
    const brier = Q7_EVENTS.reduce((acc,ev,i)=>{
      const diff = (vals[i]/100) - (ev.truth/100);
      return acc + diff*diff;
    }, 0) / Q7_EVENTS.length;
    // Convert to 0-100 (lower brier = higher calibration score)
    const calibScore = Math.round(Math.max(5, (1 - brier*3) * 100));
    onAnswer({ Calibration: calibScore, Precision: Math.round(calibScore*0.8), Risk: Math.round(calibScore*0.7) });
  }

  return (
    <QShell label="Calibration Test" title="Estimate these probabilities (%)"
      desc="There are no trick answers — this measures how well your confidence matches reality. A perfectly calibrated person scores 100%.">
      <div style={{ display:"flex", flexDirection:"column", gap:16, marginBottom:22 }}>
        {Q7_EVENTS.map((ev,i)=>(
          <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
            <p style={{ fontSize:13, color:C.text, marginBottom:12, lineHeight:1.5 }}>{ev.q}</p>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <input type="range" min="0" max="100" step="1" value={vals[i]} onChange={e=>{const n=[...vals];n[i]=+e.target.value;setVals(n);}} style={{ flex:1, accentColor:C.accent }} />
              <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:14, color:C.accent, minWidth:36, textAlign:"right" }}>{vals[i]}%</span>
            </div>
            <div style={{ marginTop:6, height:2, background:"rgba(255,255,255,0.04)", borderRadius:1 }}>
              <div style={{ height:"100%", width:`${vals[i]}%`, background:`${C.accent}60`, borderRadius:1, transition:"width 0.1s" }} />
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={submit} style={{ width:"100%" }}>Submit estimates</Btn>
    </QShell>
  );
}

// ─── Q8: LOSS AVERSION GAME (IMPROVED) ───────────────────────────────────────
// Compounding stakes — each win multiplies, and we track Kelly bet sizing behavior
function Q8({ onAnswer }) {
  const [flips, setFlips] = useState(0);
  const [wallet, setWallet] = useState(1000);
  const [history, setHistory] = useState([]);
  const [flipping, setFlipping] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [betPct, setBetPct] = useState(20); // user chooses how much to bet per flip

  function flip() {
    if (flipping || stopped) return;
    setFlipping(true);
    const betAmt = Math.round(wallet * betPct / 100);
    setTimeout(() => {
      const win = Math.random() < 0.55; // 55% win edge (Kelly-optimal ≈ 10% of bankroll)
      const newWallet = win ? wallet + Math.round(betAmt * 1.5) : Math.max(0, wallet - betAmt);
      setHistory(h => [...h, { flip: flips+1, bet: betPct, win, wallet: newWallet }]);
      setWallet(newWallet);
      setFlips(f=>f+1);
      if (newWallet === 0) setStopped(true);
      setFlipping(false);
    }, 450);
  }

  function submit() {
    // Kelly criterion: optimal is ~10% bet. Measure deviation from optimal.
    const avgBet = history.length ? history.reduce((a,h)=>a+h.bet,0)/history.length : betPct;
    const kellyDev = Math.abs(avgBet - 10);
    const riskScore = Math.min(95, Math.round(flips * 12 + (wallet > 1000 ? 10 : 0)));
    const calibScore = Math.max(10, Math.round(100 - kellyDev * 2.5));
    const speedScore = Math.min(90, flips * 8);
    onAnswer({ Risk: riskScore, Calibration: calibScore, Speed: speedScore, Endurance: Math.min(85, flips*10) });
  }

  const kellyOptimal = Math.round(wallet * 0.10);

  return (
    <QShell label="Risk Appetite" title="Variable-stake coin flip"
      desc="55% chance to win 1.5× your bet. 45% to lose it. Choose your bet size each round. Mathematically optimal bet ≈ 10% of bankroll (Kelly criterion).">
      <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ flex:1, background:C.card, borderRadius:8, padding:"12px 14px", minWidth:100 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Wallet</div>
          <div style={{ fontSize:22, fontWeight:700, color: wallet>1000?C.green:wallet<600?C.red:C.hi, fontFamily:"monospace" }}>${wallet.toLocaleString()}</div>
        </div>
        <div style={{ flex:1, background:C.card, borderRadius:8, padding:"12px 14px", minWidth:100 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Flips</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.dim, fontFamily:"monospace" }}>{flips}</div>
        </div>
        <div style={{ flex:1, background:C.card, borderRadius:8, padding:"12px 14px", minWidth:100 }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>Kelly optimal</div>
          <div style={{ fontSize:22, fontWeight:700, color:C.amber, fontFamily:"monospace" }}>${kellyOptimal}</div>
        </div>
      </div>
      {!stopped && (
        <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"14px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, color:C.dim }}>Bet size: {betPct}% of wallet</span>
            <span style={{ fontSize:12, color:C.amber }}>${Math.round(wallet*betPct/100)}</span>
          </div>
          <input type="range" min="5" max="100" step="5" value={betPct} onChange={e=>setBetPct(+e.target.value)} style={{ width:"100%", accentColor:C.accent }} />
        </div>
      )}
      {history.length > 0 && (
        <div style={{ display:"flex", gap:3, marginBottom:14, flexWrap:"wrap" }}>
          {history.slice(-12).map((h,i)=>(
            <div key={i} style={{ width:24, height:24, borderRadius:4, background: h.win?`${C.green}30`:`${C.red}30`, border:`0.5px solid ${h.win?C.green+"60":C.red+"60"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:h.win?C.green:C.red }}>
              {h.win?"W":"L"}
            </div>
          ))}
        </div>
      )}
      {!stopped ? (
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={flip} disabled={flipping||wallet===0} style={{ flex:1 }}>{flipping?"Flipping…":"Flip"}</Btn>
          {flips >= 2 && <Btn onClick={()=>setStopped(true)} secondary style={{ flex:1 }}>Walk away</Btn>}
        </div>
      ) : (
        <Btn onClick={submit} style={{ width:"100%" }}>See results</Btn>
      )}
      {flips===0 && !stopped && <Btn onClick={()=>setStopped(true)} secondary style={{ width:"100%", marginTop:8, fontSize:12 }}>I would never play this — skip</Btn>}
    </QShell>
  );
}

// ─── Q9: AMBIGUITY TOLERANCE ─────────────────────────────────────────────────
// 5 scenarios with no right answer. Rate comfort 1-5. Maps to Stability vs Risk
const Q9_SCENARIOS = [
  { text:"Your managing director gives vague direction. You won't get clarity for 2 weeks.", trait:"Stability" },
  { text:"A deal you've worked on for 6 months falls apart at signing. No explanation given.", trait:"Endurance" },
  { text:"You're asked to model a scenario with no historical precedent and zero comparable data.", trait:"Technical" },
  { text:"Your fund's thesis is right, but the market disagrees for 18 months straight.", trait:"Risk" },
  { text:"You manage a client relationship where the mandate is never clearly defined.", trait:"Social" },
];

function Q9({ onAnswer }) {
  const [ratings, setRatings] = useState(Q9_SCENARIOS.map(()=>3));

  function submit() {
    const traits = {};
    Q9_SCENARIOS.forEach((sc,i)=>{
      traits[sc.trait] = Math.round((ratings[i]/5)*100);
    });
    // High comfort with ambiguity → higher Risk, lower Stability need
    const avgRating = ratings.reduce((a,v)=>a+v,0)/ratings.length;
    traits.Stability = Math.round(100 - avgRating*12);
    onAnswer(traits);
  }

  return (
    <QShell label="Ambiguity Tolerance" title="How comfortable are you with each scenario?"
      desc="1 = deeply uncomfortable, 5 = thrives in this. There are no right answers.">
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:22 }}>
        {Q9_SCENARIOS.map((sc,i)=>(
          <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
            <p style={{ fontSize:13, color:C.text, marginBottom:12, lineHeight:1.5 }}>{sc.text}</p>
            <div style={{ display:"flex", justifyContent:"space-between", gap:6 }}>
              {[1,2,3,4,5].map(v=>(
                <button key={v} onClick={()=>{const n=[...ratings];n[i]=v;setRatings(n);}} style={{
                  flex:1, padding:"8px 0", borderRadius:6, border:`0.5px solid ${ratings[i]>=v?C.accent:"rgba(255,255,255,0.1)"}`,
                  background: ratings[i]>=v?`${C.accent}20`:"transparent",
                  color: ratings[i]>=v?C.accent:C.muted, fontSize:12, fontWeight:ratings[i]>=v?600:400, cursor:"pointer",
                }}>{v}</button>
              ))}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ fontSize:10, color:C.muted }}>Uncomfortable</span>
              <span style={{ fontSize:10, color:C.muted }}>Thrives</span>
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={submit} style={{ width:"100%" }}>Continue</Btn>
    </QShell>
  );
}

// ─── Q10: TIME BUDGET ─────────────────────────────────────────────────────────
const Q10_BUCKETS = [
  { id:"deep",    label:"Deep analytical work (modelling, research, code)", trait:"Technical", defaultH:4 },
  { id:"comms",   label:"Client calls, pitches, relationship management", trait:"Social", defaultH:2 },
  { id:"meetings",label:"Internal meetings, briefings, strategy sessions", trait:"Narrative", defaultH:2 },
  { id:"admin",   label:"Reporting, compliance, documentation", trait:"Stability", defaultH:1 },
  { id:"learning",label:"Reading, market monitoring, self-development", trait:"Precision", defaultH:1 },
];

function Q10({ onAnswer }) {
  const [hours, setHours] = useState(Q10_BUCKETS.map(b=>b.defaultH));
  const total = hours.reduce((a,v)=>a+v,0);

  function submit() {
    const traits = {};
    Q10_BUCKETS.forEach((b,i)=>{
      traits[b.trait] = Math.round((hours[i]/10)*100);
    });
    traits.Social = Math.round((hours[1]/total)*100);
    traits.Technical = Math.round((hours[0]/total)*100);
    traits.Endurance = Math.min(95, total*5+50);
    onAnswer(traits);
  }

  const overBudget = total > 10;

  return (
    <QShell label="Daily Design" title="Allocate your ideal 10-hour workday"
      desc="Drag each slider. Your total must not exceed 10 hours. Distribution reveals what you genuinely want to do.">
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
        <span style={{ fontSize:13, fontWeight:600, color: overBudget?C.red:C.dim }}>{total}h / 10h</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:22 }}>
        {Q10_BUCKETS.map((b,i)=>(
          <div key={b.id}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, color:C.dim, lineHeight:1.4 }}>{b.label}</span>
              <span style={{ fontSize:12, fontWeight:600, color:C.accent, minWidth:24 }}>{hours[i]}h</span>
            </div>
            <input type="range" min="0" max="8" step="0.5" value={hours[i]}
              onChange={e=>{const n=[...hours];n[i]=+e.target.value;setHours(n);}}
              style={{ width:"100%", accentColor: overBudget?C.red:C.accent }} />
          </div>
        ))}
      </div>
      {overBudget && <p style={{ fontSize:12, color:C.red, marginBottom:12 }}>Over budget by {total-10}h — reduce some sliders.</p>}
      <Btn onClick={submit} disabled={overBudget||total===0} style={{ width:"100%" }}>Confirm allocation</Btn>
    </QShell>
  );
}

// ─── Q11: INFORMATION DIET (HARDER) ──────────────────────────────────────────
const Q11_HEADLINES = [
  { id:"a", text:"Bayesian updating in portfolio construction: a practitioner's guide", traits:{Technical:25,Precision:15} },
  { id:"b", text:"How three GPs navigated LP conflicts in a $2B fund close", traits:{Narrative:20,Social:15,Risk:10} },
  { id:"c", text:"Municipal bond market: $48B infrastructure gap in rust-belt states", traits:{Stability:20,Narrative:10} },
  { id:"d", text:"The Fed's reverse-repo facility at $2.4T: what it signals for 2025", traits:{Technical:15,Stability:15,Calibration:10} },
  { id:"e", text:"Debt restructuring inside the $5B Oil Co. refinancing — term sheet analysis", traits:{Risk:20,Endurance:10} },
  { id:"f", text:"Tail-risk hedging with variance swaps vs. VIX calls: a quant comparison", traits:{Technical:20,Risk:15,Calibration:15} },
  { id:"g", text:"Founder psychology: why 60% of Series C CEOs get replaced", traits:{Narrative:20,Social:15} },
  { id:"h", text:"Pension fund liability-driven investing in a 5% rate environment", traits:{Stability:20,Precision:15} },
];

function Q11({ onAnswer }) {
  const [sel, setSel] = useState([]);

  function toggle(id) { setSel(s=>s.includes(id)?s.filter(x=>x!==id):s.length<3?[...s,id]:s); }

  function submit() {
    const traits = {Technical:40,Social:40,Risk:40,Stability:40,Narrative:40,Endurance:40,Speed:50,Precision:50,WorkingMemory:50,Calibration:40};
    sel.forEach(id=>{
      const h=Q11_HEADLINES.find(x=>x.id===id);
      Object.entries(h.traits).forEach(([t,v])=>{if(traits[t]!==undefined)traits[t]=Math.min(95,traits[t]+v);});
    });
    onAnswer(traits);
  }

  return (
    <QShell label="Information Diet" title="Pick your 3 reads for the next 10 minutes"
      desc="8 headlines. Choose 3. Your selection fingerprints your intellectual appetite.">
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:22 }}>
        {Q11_HEADLINES.map(h=>{
          const active=sel.includes(h.id);
          return (
            <div key={h.id} onClick={()=>toggle(h.id)} style={{
              display:"flex", alignItems:"flex-start", gap:12, padding:"11px 14px",
              background: active?`${C.accent}12`:C.card, border:`0.5px solid ${active?C.accent+"60":C.border}`,
              borderRadius:8, cursor:"pointer", transition:"all 0.15s",
            }}>
              <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${active?C.accent:C.muted}`, background:active?C.accent:"transparent", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {active&&<svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize:13, color:active?C.hi:C.dim, fontWeight:active?500:400, lineHeight:1.5 }}>{h.text}</span>
            </div>
          );
        })}
      </div>
      <Btn onClick={submit} disabled={sel.length===0} style={{ width:"100%" }}>Continue</Btn>
    </QShell>
  );
}

// ─── Q12: STEELMANNING ────────────────────────────────────────────────────────
// User is given 4 controversial finance positions. For each, rate how strongly they can argue the opposing view.
const Q12_POSITIONS = [
  { pos:"Passive index funds are better for 95% of retail investors than active management", counter:"Active management generates superior risk-adjusted returns for certain market segments" },
  { pos:"ESG investing necessarily sacrifices returns", counter:"ESG factors are valid alpha signals with long-term outperformance" },
  { pos:"Hedge fund fees (2&20) are unjustifiable given average net performance", counter:"Hedge funds provide genuine portfolio diversification value that justifies the fee premium" },
  { pos:"VC as an asset class is structurally inaccessible and unfair to non-institutional investors", counter:"VC democratisation through SPACs and retail funds creates more harm than good" },
];

function Q12({ onAnswer }) {
  const [ratings, setRatings] = useState(Q12_POSITIONS.map(()=>3));

  function submit() {
    const avg = ratings.reduce((a,v)=>a+v,0)/ratings.length;
    // High steelmanning ability → Narrative, Social, Calibration
    const narrativeScore = Math.round((avg/5)*100);
    const calibScore = Math.round((avg/5)*90);
    onAnswer({ Narrative: narrativeScore, Social: Math.round(narrativeScore*0.8), Calibration: calibScore, Technical: Math.round(narrativeScore*0.5) });
  }

  return (
    <QShell label="Intellectual Flexibility" title="Steelman the opposing view"
      desc="For each statement, rate how convincingly you could argue AGAINST it — even if you agree with it. 1 = I can't argue the other side, 5 = I can argue it compellingly.">
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:22 }}>
        {Q12_POSITIONS.map((p,i)=>(
          <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"14px 16px" }}>
            <p style={{ fontSize:12, color:C.dim, marginBottom:4, fontStyle:"italic" }}>Statement:</p>
            <p style={{ fontSize:13, color:C.text, marginBottom:10, lineHeight:1.5 }}>"{p.pos}"</p>
            <p style={{ fontSize:11, color:C.muted, marginBottom:8 }}>How well could you argue: "{p.counter}"</p>
            <div style={{ display:"flex", justifyContent:"space-between", gap:6 }}>
              {[1,2,3,4,5].map(v=>(
                <button key={v} onClick={()=>{const n=[...ratings];n[i]=v;setRatings(n);}} style={{
                  flex:1, padding:"7px 0", borderRadius:6, border:`0.5px solid ${ratings[i]===v?C.accent:"rgba(255,255,255,0.08)"}`,
                  background: ratings[i]===v?`${C.accent}25`:"transparent",
                  color: ratings[i]===v?C.accent:C.muted, fontSize:12, fontWeight:600, cursor:"pointer",
                }}>{v}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={submit} style={{ width:"100%" }}>Continue</Btn>
    </QShell>
  );
}

// ─── Q13: SPEED-PRECISION TRADEOFF ───────────────────────────────────────────
// 8 arithmetic questions, 3 seconds each. Measures speed/accuracy under time pressure
function Q13({ onAnswer }) {
  const questions = useMemo(()=>Array.from({length:8},()=>{
    const a=Math.floor(Math.random()*50)+10, b=Math.floor(Math.random()*40)+5;
    const ops=[
      {sym:"+",ans:a+b},
      {sym:"×",ans:a*b%1000}, // modulo to keep manageable
      {sym:"−",ans:Math.abs(a-b)},
    ];
    const op=ops[Math.floor(Math.random()*2)]; // only + and −
    return {a,b,sym:op.sym,ans:op.ans};
  }),[]);

  const [qIdx, setQIdx] = useState(0);
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [timeLeft, setTimeLeft] = useState(4);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{
    if(done)return;
    clearInterval(timerRef.current);
    setTimeLeft(4);
    timerRef.current=setInterval(()=>setTimeLeft(t=>{
      if(t<=1){clearInterval(timerRef.current);advance(false,null);return 0;}
      return t-1;
    }),1000);
    inputRef.current?.focus();
    return ()=>clearInterval(timerRef.current);
  },[qIdx,done]);

  function advance(answered, userAns) {
    clearInterval(timerRef.current);
    const correct = answered && userAns===questions[qIdx].ans;
    const timeTaken = 4 - timeLeft;
    const next=[...results,{correct,timeTaken:Math.max(1,timeTaken)}];
    setResults(next);
    setInput("");
    if(qIdx+1>=questions.length){
      setDone(true);
      const correctCount=next.filter(r=>r.correct).length;
      const avgTime=next.reduce((a,r)=>a+r.timeTaken,0)/next.length;
      const speedScore=Math.round(Math.max(10,100-avgTime*15));
      const precScore=Math.round((correctCount/questions.length)*100);
      onAnswer({Speed:speedScore,Precision:precScore,Endurance:Math.round((speedScore+precScore)/2)});
    } else {
      setQIdx(i=>i+1);
    }
  }

  function handleKey(e){
    if(e.key==="Enter"&&input){advance(true,parseInt(input,10));}
  }

  if(done) return <QShell label="Speed Test" title="Calculating…" />;
  const q=questions[qIdx];

  return (
    <QShell label="Speed-Accuracy" title="Mental arithmetic under pressure"
      desc={`Question ${qIdx+1} of ${questions.length}. 4 seconds each. Press Enter to submit.`}>
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, marginBottom:16 }}>
          <div style={{ height:"100%", width:`${(timeLeft/4)*100}%`, background:timeLeft>2?C.green:C.red, borderRadius:2, transition:"width 1s linear" }} />
        </div>
        <div style={{ fontSize:42, fontWeight:700, color:C.hi, fontFamily:"monospace", marginBottom:20, letterSpacing:"0.05em" }}>
          {q.a} {q.sym} {q.b} = ?
        </div>
        <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.replace(/[^0-9]/g,""))}
          onKeyDown={handleKey} placeholder="?" type="number"
          style={{
            fontSize:28, fontWeight:700, textAlign:"center", width:"100%", padding:"14px",
            background:C.card, border:`2px solid ${C.accent}60`, borderRadius:10,
            color:C.hi, outline:"none", fontFamily:"monospace",
          }} />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
          <span style={{ fontSize:11, color:C.muted }}>{results.filter(r=>r.correct).length} correct so far</span>
          <span style={{ fontSize:11, color:timeLeft<=1?C.red:C.muted }}>{timeLeft}s</span>
        </div>
      </div>
      <Btn onClick={()=>{if(input)advance(true,parseInt(input,10));}} disabled={!input} style={{ width:"100%" }}>Submit (Enter)</Btn>
    </QShell>
  );
}

// ─── Q14: PRESSURE SEQUENCING ─────────────────────────────────────────────────
// Assign 5 concurrent tasks to one of 4 time slots in a crisis week
const Q14_TASKS = [
  { id:"a", text:"Finalise client IM — MD review at 5pm today", urgency:5, importance:5 },
  { id:"b", text:"Fix model error flagged by risk desk — live positions at stake", urgency:5, importance:4 },
  { id:"c", text:"Draft Q3 board pack — deadline in 3 days", urgency:3, importance:5 },
  { id:"d", text:"Reply to 40 unread emails — some need same-day response", urgency:3, importance:2 },
  { id:"e", text:"1-on-1 with junior analyst — they're struggling with VLOOKUP", urgency:1, importance:3 },
  { id:"f", text:"Weekly self-review of deal pipeline — no external deadline", urgency:1, importance:4 },
];
const Q14_SLOTS = ["Do now","Do today","Delegate","Drop / defer"];

function Q14({ onAnswer }) {
  const [assignments, setAssignments] = useState({});
  const allAssigned = Q14_TASKS.every(t=>assignments[t.id]!==undefined);

  function assign(taskId, slot) {
    setAssignments(a=>({...a,[taskId]:slot}));
  }

  function submit() {
    // Measure: do urgent+important tasks go to "Do now"?
    // Measure: do low-urgency tasks get deferred?
    let precScore = 50;
    Q14_TASKS.forEach(task=>{
      const slot=assignments[task.id];
      if(!slot) return;
      const ideal = task.urgency>=4&&task.importance>=4?"Do now"
        : task.urgency>=3||task.importance>=4?"Do today"
        : task.urgency<=1&&task.importance<=2?"Drop / defer"
        : "Delegate";
      if(slot===ideal) precScore+=8;
      else if(slot==="Do now"&&(task.urgency<3&&task.importance<3)) precScore-=12; // over-prioritising trivial
    });
    const finalPrec = Math.max(10, Math.min(100, precScore));
    onAnswer({ Precision: finalPrec, Speed: Math.round(finalPrec*0.8), Endurance: Math.round(finalPrec*0.9), Technical: Math.round(finalPrec*0.6) });
  }

  const slotColors = {"Do now":C.red,"Do today":C.amber,"Delegate":C.green,"Drop / defer":C.muted};

  return (
    <QShell label="Prioritisation" title="Assign each task to a time slot"
      desc="Crisis week. You cannot do everything. Place each task in the most appropriate slot.">
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6, marginBottom:10 }}>
        {Q14_SLOTS.map(s=>(
          <div key={s} style={{ padding:"6px 10px", borderRadius:6, background:`${slotColors[s]}15`, border:`0.5px solid ${slotColors[s]}40`, textAlign:"center", fontSize:11, fontWeight:600, color:slotColors[s] }}>{s}</div>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {Q14_TASKS.map(task=>(
          <div key={task.id} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
            <p style={{ fontSize:13, color:C.text, marginBottom:10, lineHeight:1.4 }}>{task.text}</p>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Q14_SLOTS.map(sl=>{
                const active=assignments[task.id]===sl;
                return <button key={sl} onClick={()=>assign(task.id,sl)} style={{
                  padding:"5px 10px", borderRadius:6, fontSize:11,
                  background:active?`${slotColors[sl]}25`:"transparent",
                  border:`0.5px solid ${active?slotColors[sl]:C.border}`,
                  color:active?slotColors[sl]:C.muted, cursor:"pointer", fontWeight:active?600:400,
                }}>{sl}</button>;
              })}
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={submit} disabled={!allAssigned} style={{ width:"100%" }}>Submit plan</Btn>
    </QShell>
  );
}

// ─── Q15: IDENTITY ANCHORING ─────────────────────────────────────────────────
// Force-ranked identity statements — which one would you sacrifice last?
const Q15_IDENTITIES = [
  { id:"a", text:"The person who finds the edge in a dataset nobody else thought to query", core:"Technical" },
  { id:"b", text:"The person clients call when they're scared and need a voice of calm", core:"Social" },
  { id:"c", text:"The person who thrives when the thesis takes years to play out", core:"Endurance" },
  { id:"d", text:"The person whose model is the one the firm trusts under audit", core:"Precision" },
  { id:"e", text:"The person who backs founders when the world thinks they're delusional", core:"Narrative" },
  { id:"f", text:"The person who knows exactly how much risk is too much — before anyone else does", core:"Risk" },
];

function Q15({ onAnswer }) {
  const [order, setOrder] = useState(Q15_IDENTITIES.map(x=>x.id));
  const [dragId, setDragId] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  function handleDrop(toIdx) {
    if(dragId===null)return;
    const fromIdx=order.indexOf(dragId);
    if(fromIdx===toIdx)return;
    const next=[...order];next.splice(fromIdx,1);next.splice(toIdx,0,dragId);
    setOrder(next);setDragId(null);setOverIdx(null);
  }

  function submit() {
    const traits={};
    order.forEach((id,rank)=>{
      const item=Q15_IDENTITIES.find(x=>x.id===id);
      // Rank 0 = most important = high score
      traits[item.core]=Math.round(Math.max(20,100-rank*14));
    });
    onAnswer(traits);
  }

  return (
    <QShell label="Identity Anchoring" title="Who are you, professionally?"
      desc="Drag to rank these professional identities from most (top) to least essential to who you are. The bottom reveals what you'd sacrifice. The top reveals your core.">
      <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:20 }}>
        {order.map((id,idx)=>{
          const item=Q15_IDENTITIES.find(x=>x.id===id);
          const pct=100-Math.round((idx/(order.length-1))*100);
          const barColor=pct>65?C.green:pct>35?C.amber:C.red;
          return (
            <div key={id} draggable
              onDragStart={()=>setDragId(id)}
              onDragOver={e=>{e.preventDefault();setOverIdx(idx);}}
              onDragLeave={()=>setOverIdx(null)}
              onDrop={()=>handleDrop(idx)}
              onDragEnd={()=>{setDragId(null);setOverIdx(null);}}
              style={{
                display:"flex", alignItems:"center", gap:12, padding:"13px 14px",
                background: overIdx===idx?`${C.accent}12`:dragId===id?"rgba(255,255,255,0.02)":C.card,
                border:`0.5px solid ${overIdx===idx?C.accent+"60":C.border}`,
                borderLeft:`3px solid ${barColor}`, borderRadius:8,
                cursor:"grab", opacity:dragId===id?.5:1, transition:"background 0.1s", userSelect:"none",
              }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:14, fontFamily:"monospace" }}>{idx+1}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity:.3, flexShrink:0 }}>
                <rect y="1" width="12" height="1.5" rx=".75" fill="white"/>
                <rect y="5" width="12" height="1.5" rx=".75" fill="white"/>
                <rect y="9" width="12" height="1.5" rx=".75" fill="white"/>
              </svg>
              <span style={{ fontSize:13, color:C.text, flex:1, lineHeight:1.4 }}>{item.text}</span>
            </div>
          );
        })}
      </div>
      <Btn onClick={submit} style={{ width:"100%" }}>Lock in my identity</Btn>
    </QShell>
  );
}

// ─── RESULTS SCREEN ──────────────────────────────────────────────────────────
function Results({ scores, traits }) {
  const winner = FIELDS[scores[0].key];
  const runnerUp = FIELDS[scores[1].key];

  // Build trait radar data
  const traitKeys = ["Speed","Precision","Risk","Social","Technical","Narrative","Stability","Endurance"];

  return (
    <div>
      {/* Winner card */}
      <div style={{
        background:`linear-gradient(135deg, ${winner.color}18 0%, ${winner.color}08 100%)`,
        border:`1px solid ${winner.color}40`, borderRadius:14, padding:"28px 24px", marginBottom:20, textAlign:"center",
      }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.18em", color:winner.color, marginBottom:6 }}>YOUR FIELD</div>
        <div style={{ fontSize:26, fontWeight:700, color:C.hi, marginBottom:4 }}>{winner.label}</div>
        <div style={{ fontSize:14, color:winner.color, fontWeight:500, marginBottom:16 }}>{winner.arch}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <div style={{ background:`${winner.color}20`, border:`0.5px solid ${winner.color}50`, borderRadius:8, padding:"8px 14px" }}>
            <div style={{ fontSize:10, color:winner.color, letterSpacing:"0.1em" }}>MATCH</div>
            <div style={{ fontSize:18, fontWeight:700, color:winner.color }}>{scores[0].pct}%</div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.04)", border:`0.5px solid ${C.border}`, borderRadius:8, padding:"8px 14px" }}>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.1em" }}>RUNNER-UP</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dim }}>{runnerUp.label}</div>
          </div>
        </div>
      </div>

      {/* Trait breakdown */}
      <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:"18px 20px", marginBottom:20 }}>
        <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.12em", marginBottom:14, fontWeight:600 }}>TRAIT PROFILE</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 20px" }}>
          {traitKeys.map(t=>(
            <div key={t}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, color:C.dim }}>{t}</span>
                <span style={{ fontSize:11, fontWeight:600, color:C.text, fontFamily:"monospace" }}>{traits[t]}</span>
              </div>
              <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:1 }}>
                <div style={{ height:"100%", width:`${traits[t]}%`, background: traits[t]>70?C.green:traits[t]>40?C.accent:C.muted, borderRadius:1, transition:"width 0.6s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full ranking */}
      <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.12em", marginBottom:10, fontWeight:600 }}>FULL RANKING</div>
      <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:24 }}>
        {scores.map((sc,i)=>{
          const f=FIELDS[sc.key];
          const isBest=i===0;
          return (
            <div key={sc.key} style={{
              display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
              background:isBest?`${f.color}12`:C.card, border:`0.5px solid ${isBest?f.color+"40":C.border}`,
              borderRadius:8,
            }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:14, fontFamily:"monospace" }}>{i+1}</span>
              <div style={{ width:8, height:8, borderRadius:"50%", background:f.color, flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13, fontWeight:isBest?600:400, color:isBest?C.hi:C.dim }}>{f.label}</span>
              <span style={{ fontSize:11, color:isBest?f.color:C.muted, fontFamily:"monospace" }}>{f.arch}</span>
              <div style={{ width:50, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                <div style={{ height:"100%", width:`${sc.pct}%`, background:isBest?f.color:C.muted+"80", borderRadius:2 }} />
              </div>
              <span style={{ fontSize:11, color:isBest?f.color:C.muted, fontFamily:"monospace", minWidth:28, textAlign:"right" }}>{sc.pct}%</span>
            </div>
          );
        })}
      </div>
      <Btn onClick={()=>{ if(typeof sendPrompt!=="undefined") sendPrompt(`My Finance Archetype Diagnostic result: ${winner.label} (${winner.arch}), ${scores[0].pct}% match. Runner-up: ${runnerUp.label} at ${scores[1].pct}%. What does a realistic career path in ${winner.label} look like and what should I do in the next 12 months to break in?`); }} style={{ width:"100%" }}>Map my path into {winner.label} ↗</Btn>
    </div>
  );
}

// ─── INTRO ────────────────────────────────────────────────────────────────────
function Intro({ onStart }) {
  return (
    <div style={{ textAlign:"center", paddingTop:12 }}>
      <div style={{ width:56, height:56, borderRadius:14, background:`${C.accent}20`, border:`1px solid ${C.accent}40`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", fontSize:26 }}>◈</div>
      <h1 style={{ fontSize:22, fontWeight:700, color:C.hi, marginBottom:8 }}>Finance Archetype Diagnostic</h1>
      <p style={{ fontSize:14, color:C.dim, lineHeight:1.7, marginBottom:28, maxWidth:380, margin:"0 auto 28px" }}>
        15 questions. Psychometrically scored across 10 traits. No vanity results — your fit percentages will genuinely vary between fields.
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:28, textAlign:"left" }}>
        {[
          ["Crisis triage","Priority ordering under pressure"],
          ["Pattern recognition","Anomaly detection in numerical data"],
          ["Working memory","Sequence recall under time pressure"],
          ["Calibration","Probability estimation accuracy"],
          ["Risk appetite","Kelly-criterion bet sizing"],
          ["Identity anchoring","Core professional self-concept"],
        ].map(([t,d])=>(
          <div key={t} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:"12px 14px" }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.accent, marginBottom:3 }}>{t}</div>
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.4 }}>{d}</div>
          </div>
        ))}
      </div>
      <Btn onClick={onStart} style={{ width:"100%", padding:"14px" }}>Begin diagnostic</Btn>
    </div>
  );
}

// ─── ORCHESTRATOR ─────────────────────────────────────────────────────────────
const QUESTIONS = [Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9,Q10,Q11,Q12,Q13,Q14,Q15];
const Q_LABELS = [
  "Crisis triage","Pattern recognition","Working memory","Tolerance mapping","Audit eye",
  "Motivation profile","Calibration test","Risk appetite","Ambiguity tolerance","Daily design",
  "Information diet","Steelmanning","Speed-accuracy","Prioritisation","Identity anchoring",
];
const TOTAL = 15;

export default function ArchetypeDiagnostic() {
  const [phase, setPhase] = useState("intro"); // intro | quiz | results
  const [step, setStep] = useState(0);
  const [traits, setTraits] = useState({ ...DEFAULT_TRAITS });
  const [result, setResult] = useState(null);

  function handleAnswer(update) {
    const next = mergeTraits(traits, update);
    setTraits(next);
    if (step < TOTAL - 1) {
      setStep(s => s+1);
    } else {
      setResult(computeResult(next));
      setPhase("results");
    }
  }

  function restart() { setPhase("intro"); setStep(0); setTraits({...DEFAULT_TRAITS}); setResult(null); }

  if (phase === "intro") return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 16px", fontFamily:"system-ui,sans-serif", color:C.text }}>
      <Intro onStart={()=>setPhase("quiz")} />
    </div>
  );

  if (phase === "results") return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 16px", fontFamily:"system-ui,sans-serif", color:C.text }}>
      <Results scores={result} traits={traits} />
      <button onClick={restart} style={{ width:"100%", padding:"10px", background:"transparent", border:`0.5px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", marginTop:10, fontSize:13 }}>Retake</button>
    </div>
  );

  const CurrentQ = QUESTIONS[step];
  return (
    <div style={{ maxWidth:520, margin:"0 auto", padding:"24px 16px", fontFamily:"system-ui,sans-serif", color:C.text }}>
      <ProgressBar step={step} total={TOTAL} />
      <div style={{ fontSize:10, color:C.muted, letterSpacing:"0.12em", marginBottom:20, textAlign:"right", fontWeight:600 }}>
        {Q_LABELS[step].toUpperCase()}
      </div>
      <CurrentQ onAnswer={handleAnswer} />
    </div>
  );
}
