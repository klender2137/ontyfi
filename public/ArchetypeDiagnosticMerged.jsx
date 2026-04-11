// ArchetypeDiagnosticMerged.jsx - Hybrid V1+V2 with 70/30 split
// 15 questions total: ~10 from V2 (70%), ~4-5 from V1 (30%)
// Prevents similar question types from repeating

(function() {
  const { useState, useEffect, useRef, useMemo } = window.React;

  // ============ PALETTE ============
  const C = {
    bg: "#080B14", panel: "#0D1220", card: "#111827",
    border: "rgba(255,255,255,0.07)", muted: "#4B5563", dim: "#9CA3AF",
    text: "#E5E7EB", hi: "#F9FAFB", accent: "#6366F1",
    accentL: "rgba(99,102,241,0.15)", green: "#10B981", red: "#EF4444", amber: "#F59E0B",
    // Legacy colors for V1 questions
    v1accent: "#3b82f6", v1muted: "#64748b", v1text: "#f7f9ff"
  };

  // ============ V2 FIELD DEFINITIONS (with Calibration + WorkingMemory) ============
  const FIELDS = {
    QuantFin:  { label:"Quant Finance",    arch:"The Architect",   color:"#6366F1", icon:"📐", traits:{ Speed:70, Precision:95, Risk:60, Social:20, Technical:95, Narrative:30, Stability:55, Endurance:75, Calibration:85, WorkingMemory:90 }},
    IB:        { label:"Investment Banking",arch:"The Gladiator",   color:"#EF4444", icon:"⚔️", traits:{ Speed:85, Precision:65, Risk:70, Social:90, Technical:40, Narrative:75, Stability:30, Endurance:95, Calibration:55, WorkingMemory:65 }},
    VC:        { label:"Venture Capital",  arch:"The Visionary",   color:"#10B981", icon:"🔮", traits:{ Speed:65, Precision:35, Risk:85, Social:75, Technical:50, Narrative:95, Stability:20, Endurance:60, Calibration:45, WorkingMemory:55 }},
    RiskM:     { label:"Risk Management",  arch:"The Sentry",      color:"#3B82F6", icon:"🛡️", traits:{ Speed:40, Precision:92, Risk:15, Social:40, Technical:82, Narrative:35, Stability:95, Endurance:65, Calibration:90, WorkingMemory:80 }},
    HedgeFund: { label:"Hedge Funds",      arch:"The Gambler",     color:"#F59E0B", icon:"🎲", traits:{ Speed:95, Precision:70, Risk:92, Social:50, Technical:78, Narrative:55, Stability:18, Endurance:82, Calibration:75, WorkingMemory:70 }},
    FPA:       { label:"FP&A",             arch:"The Navigator",   color:"#8B5CF6", icon:"🧭", traits:{ Speed:38, Precision:88, Risk:28, Social:55, Technical:82, Narrative:50, Stability:88, Endurance:60, Calibration:80, WorkingMemory:85 }},
    AssetMgmt: { label:"Asset Management", arch:"The Guardian",    color:"#06B6D4", icon:"🏛️", traits:{ Speed:48, Precision:70, Risk:42, Social:82, Technical:60, Narrative:68, Stability:82, Endurance:55, Calibration:65, WorkingMemory:60 }},
    PublicFin: { label:"Public Finance",   arch:"The Diplomat",    color:"#64748B", icon:"🤝", traits:{ Speed:32, Precision:58, Risk:18, Social:72, Technical:42, Narrative:88, Stability:92, Endurance:48, Calibration:55, WorkingMemory:50 }},
    PE:        { label:"Private Equity",   arch:"The Surgeon",     color:"#EC4899", icon:"🔪", traits:{ Speed:62, Precision:82, Risk:78, Social:68, Technical:65, Narrative:88, Stability:38, Endurance:95, Calibration:70, WorkingMemory:72 }},
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

  // ============ V2 SCORING ENGINE (handles all 10 traits) ============
  function computeResult(rawTraits) {
    const traitKeys = Object.keys(rawTraits);
    const uNorm = {}; traitKeys.forEach(t => { uNorm[t] = rawTraits[t] / 100; });

    const scores = Object.entries(FIELDS).map(([key, field]) => {
      const w = WEIGHTS[key];
      let dot = 0, uMag = 0, fMag = 0;
      traitKeys.forEach(t => {
        const wt = w[t] || 0; const u = uNorm[t]; const f = field.traits[t] / 100;
        dot += wt * u * f; uMag += wt * u * u; fMag += wt * f * f;
      });
      const cosSim = dot / (Math.sqrt(uMag) * Math.sqrt(fMag) + 1e-9);
      const rmse = Math.sqrt(traitKeys.reduce((acc, t) => acc + (w[t]||0) * Math.pow((uNorm[t] - field.traits[t]/100), 2), 0) / traitKeys.length);
      const combined = cosSim * (1 - 0.6 * rmse);
      return { key, combined, cosSim, rmse };
    });

    scores.sort((a, b) => b.combined - a.combined);
    const top = scores[0].combined, bottom = scores[scores.length - 1].combined, range = top - bottom;
    return scores.map(s => ({ ...s, pct: Math.round(((s.combined - bottom) / (range + 1e-9)) * 65 + 20) }));
  }

  // ============ TRAIT MERGER (V2 style - exponential moving average) ============
  const DEFAULT_TRAITS = { Speed:50, Precision:50, Risk:50, Social:50, Technical:50, Narrative:50, Stability:50, Endurance:50, Calibration:50, WorkingMemory:50 };

  function mergeTraits(base, update) {
    const next = { ...base };
    Object.entries(update).forEach(([k, v]) => {
      if (next[k] !== undefined) next[k] = Math.round(next[k] * 0.45 + v * 0.55);
    });
    return next;
  }

  // ============ QUESTION POOL DEFINITIONS ============
  // V1 Questions (Legacy - 30% mix = ~4-5 questions)
  // These are the V1 questions that complement V2 without duplication

  // V1-Q1: Chaos Threshold Slider - Speed/Precision (unique, no V2 equivalent)
  function V1_Q1({ onAnswer }) {
    const [val, setVal] = useState(50);
    return (
      <V1Shell label="Crisis Response" title="The cockpit scenario" desc="Imagine alarms blare. Two engines are out. How long before you pull the emergency lever?">
        <p style={{ fontSize:13, color:C.v1muted, marginBottom:24 }}>1 = Need full diagnostic first | 100 = Pull immediately — trust the gut</p>
        <input type="range" min="0" max="100" step="1" value={val} onChange={e => setVal(+e.target.value)} style={{ width:"100%", marginBottom:12, accentColor:C.v1accent }} />
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:28, fontSize:12, color:C.v1muted }}>
          <span>Analytical</span><span style={{ color:C.v1accent, fontWeight:600 }}>{val}</span><span>Instinctive</span>
        </div>
        <V1Btn onClick={() => onAnswer({ Speed: 100 - val, Precision: val })}>Continue</V1Btn>
      </V1Shell>
    );
  }

  // V1-Q6: Social Battery Clock - Social preference (unique slider)
  function V1_Q6({ onAnswer }) {
    const [social, setSocial] = useState(4);
    function submit() {
      const socialScore = Math.round((social / 16) * 100);
      onAnswer({ Social: socialScore, Stability: Math.round(100 - socialScore * 0.4), Endurance: 60 });
    }
    return (
      <V1Shell label="Social Battery" title="Performance hours per day" desc="How many hours do you want to spend talking, selling, presenting, relationship-building?">
        <div style={{ display:"flex", gap:16, alignItems:"center", marginBottom:20 }}>
          <input type="range" min="0" max="16" step="1" value={social} onChange={e => setSocial(+e.target.value)} style={{ flex:1, accentColor:C.v1accent }} />
          <span style={{ fontWeight:700, fontSize:24, color:C.v1accent, minWidth:40 }}>{social}h</span>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:28 }}>
          {[{ label:"Analyst", range:"0–2h", active: social <= 2 }, { label:"Hybrid", range:"3–7h", active: social >= 3 && social <= 7 }, { label:"Front office", range:"8h+", active: social >= 8 }].map(t => (
            <div key={t.label} style={{ flex:1, padding:"10px", borderRadius:8, textAlign:"center", background: t.active ? C.v1accent : "rgba(148,163,184,0.1)", border: `0.5px solid ${t.active ? C.v1accent : "rgba(148,163,184,0.2)"}` }}>
              <div style={{ fontSize:12, fontWeight:500, color: t.active ? "#fff" : C.v1muted }}>{t.label}</div>
              <div style={{ fontSize:11, color: C.v1muted }}>{t.range}</div>
            </div>
          ))}
        </div>
        <V1Btn onClick={submit}>Continue</V1Btn>
      </V1Shell>
    );
  }

  // V1-Q4: Narrative Builder - Sentence completion (complements V2-Q6)
  const V1_CHIPS = {
    Action:  [{ v:"Analyzing", t:"Technical" }, { v:"Negotiating", t:"Social" }, { v:"Hedging", t:"Risk" }, { v:"Governing", t:"Stability" }],
    Subject: [{ v:"a Startup", t:"Narrative" }, { v:"a Corporation", t:"Endurance" }, { v:"a Math Model", t:"Technical" }, { v:"Public Infrastructure", t:"Stability" }],
    Outcome: [{ v:"changes the world", t:"Narrative" }, { v:"beats the market", t:"Risk" }, { v:"ensures stability", t:"Stability" }, { v:"closes the deal", t:"Social" }],
  };
  function V1_Q4({ onAnswer }) {
    const [sel, setSel] = useState({ Action:null, Subject:null, Outcome:null });
    const ready = sel.Action && sel.Subject && sel.Outcome;
    function submit() {
      const traits = { Technical:45, Social:45, Risk:45, Stability:45, Narrative:45, Endurance:45, Speed:50, Precision:50, WorkingMemory:50, Calibration:45 };
      [sel.Action, sel.Subject, sel.Outcome].forEach(c => { if(c && traits[c.t]!==undefined) traits[c.t] = Math.min(100, traits[c.t] + 25); });
      onAnswer(traits);
    }
    return (
      <V1Shell label="Motivation" title="Complete your sentence" desc="Select one chip from each row to build the sentence that resonates most.">
        <div style={{ background:"rgba(148,163,184,0.15)", borderRadius:10, padding:"14px 16px", marginBottom:20, fontSize:14, lineHeight:2.2, fontStyle:"italic", color:C.v1text }}>
          {"I find satisfaction when I am "}<V1Slot val={sel.Action?.v} />{" "}<V1Slot val={sel.Subject?.v} />{" that "}<V1Slot val={sel.Outcome?.v} />{"."}
        </div>
        {Object.entries(V1_CHIPS).map(([cat,chips]) => (
          <div key={cat} style={{ marginBottom:14 }}>
            <p style={{ fontSize:11, color:C.v1muted, marginBottom:6, fontWeight:500 }}>{cat.toUpperCase()}</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {chips.map(c => (
                <button key={c.v} onClick={()=>setSel(s=>({...s,[cat]:c}))} style={{
                  padding:"5px 12px", fontSize:12, borderRadius:16,
                  background: sel[cat]?.v===c.v ? C.v1accent : "rgba(148,163,184,0.1)",
                  border: `0.5px solid ${sel[cat]?.v===c.v ? C.v1accent : "rgba(148,163,184,0.2)"}`,
                  color: sel[cat]?.v===c.v ? "#fff" : C.v1muted,
                }}>{c.v}</button>
              ))}
            </div>
          </div>
        ))}
        <V1Btn onClick={submit} disabled={!ready}>Continue</V1Btn>
      </V1Shell>
    );
  }

  // V1-Q5: Information Diet - Headline selection (complements V2-Q11)
  const V1_HEADLINES = [
    { id:"A", text:"The math behind a perfect poker hand", traits:{Technical:20, Risk:15} },
    { id:"B", text:"Founder ousted in board coup", traits:{Narrative:20, Social:15} },
    { id:"C", text:"Municipal bond for Ohio bridge", traits:{Stability:20, Narrative:10} },
    { id:"D", text:"Fed's move affects milk prices", traits:{Stability:15, Technical:10} },
    { id:"E", text:"$50B merger of oil giants", traits:{Social:15, Risk:10, Endurance:10} },
  ];
  function V1_Q5({ onAnswer }) {
    const [sel, setSel] = useState([]);
    function toggle(id) { setSel(s => s.includes(id) ? s.filter(x=>x!==id) : s.length<3 ? [...s,id] : s); }
    function submit() {
      const traits = {Technical:40, Social:40, Risk:40, Stability:40, Narrative:40, Endurance:40, Speed:50, Precision:50, WorkingMemory:50, Calibration:40};
      sel.forEach(id => { const h=V1_HEADLINES.find(x=>x.id===id); Object.entries(h.traits).forEach(([t,v])=>{ if(traits[t]!==undefined) traits[t]=Math.min(95,traits[t]+v); }); });
      onAnswer(traits);
    }
    return (
      <V1Shell label="Curiosity" title="Your 10-minute reading diet" desc="Pick up to 3 headlines you'd actually read.">
        <p style={{ fontSize:12, color:C.v1muted, marginBottom:16 }}>Selected: {sel.length}/3</p>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {V1_HEADLINES.map(h => {
            const active=sel.includes(h.id);
            return (
              <div key={h.id} onClick={()=>toggle(h.id)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
                background: active ? C.v1accent : "rgba(148,163,184,0.1)",
                border: `0.5px solid ${active ? C.v1accent : "rgba(148,163,184,0.2)"}`,
                borderRadius:8, cursor:"pointer"
              }}>
                <div style={{ width:16, height:16, borderRadius:3, border:`1.5px solid ${active ? "#fff" : C.v1muted}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {active && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.5" fill="none" /></svg>}
                </div>
                <span style={{ fontSize:12, color: active ? "#fff" : C.v1muted }}><b style={{ marginRight:6 }}>{h.id}.</b>{h.text}</span>
              </div>
            );
          })}
        </div>
        <V1Btn onClick={submit} disabled={sel.length===0}>Continue</V1Btn>
      </V1Shell>
    );
  }

  // V1 UI Helpers
  function V1Shell({ label, title, desc, children }) {
    return (
      <div>
        <div style={{ fontSize:10, color:C.v1accent, letterSpacing:"0.1em", fontWeight:600, marginBottom:4, textTransform:"uppercase" }}>{label}</div>
        <h2 style={{ fontSize:16, fontWeight:600, color:C.v1text, marginBottom: desc?6:20 }}>{title}</h2>
        {desc && <p style={{ fontSize:12, color:C.v1muted, marginBottom:20, lineHeight:1.5 }}>{desc}</p>}
        {children}
      </div>
    );
  }
  function V1Btn({ onClick, disabled, children }) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        width:"100%", padding:"11px", background:C.v1accent, color:"#fff", border:"none", borderRadius:8,
        cursor: disabled?"not-allowed":"pointer", opacity: disabled?0.4:1, fontWeight:500
      }}>{children}</button>
    );
  }
  function V1Slot({ val }) {
    return <span style={{ borderBottom:`1.5px solid ${val?C.v1accent:"rgba(148,163,184,0.3)"}`, padding:"0 4px", color:val?C.v1accent:C.v1muted, fontWeight:val?600:400 }}>{val||"___"}</span>;
  }

  // ============ V2 QUESTIONS (All 15 - we select randomly excluding conflicts) ============
  
  // V2-Q1: Crisis Triage (priority ordering) - KEEP, no V1 equivalent
  const V2_CRISIS = [
    { id:"a", sev:5, text:"Client calling re: $40M misallocated funds — live call", boost:{Speed:18,Social:12} },
    { id:"b", sev:4, text:"Compliance filing deadline in 12 min — system access lost", boost:{Precision:18,Stability:12} },
    { id:"c", sev:3, text:"Junior analyst spreadsheet error — £2M understatement in deck", boost:{Precision:12,Technical:12} },
    { id:"d", sev:2, text:"MD waiting for updated model — meeting in 30 min", boost:{Endurance:8,Speed:8} },
    { id:"e", sev:1, text:"Reuters journalist emailed — wants comment on deal rumour", boost:{Narrative:8,Social:8} },
    { id:"f", sev:2, text:"Server threw 500 error on pricing API — portfolio at stale data", boost:{Technical:12,Risk:8} },
  ];
  const V2_IDEAL = ["a","b","c","f","d","e"];
  function V2_Q1({ onAnswer }) {
    const [dismissed, setDismissed] = useState([]);
    const [startTime] = useState(Date.now());
    const done = dismissed.length === V2_CRISIS.length;
    function dismiss(id) {
      if (dismissed.includes(id) || done) return;
      setDismissed([...dismissed, id]);
    }
    function submit() {
      const elapsed = (Date.now() - startTime) / 1000;
      let concordant=0, discordant=0;
      for (let i=0; i<dismissed.length; i++) for (let j=i+1; j<dismissed.length; j++) {
        const ui=V2_IDEAL.indexOf(dismissed[i]), uj=V2_IDEAL.indexOf(dismissed[j]);
        if (ui<uj) concordant++; else discordant++;
      }
      const tau = (concordant-discordant)/(concordant+discordant+1e-9);
      const orderScore = Math.round((tau+1)/2*100);
      const speedScore = Math.max(10, Math.min(100, Math.round(110-elapsed*1.5)));
      const traits = { Speed:speedScore, Precision:orderScore, Endurance:Math.round((orderScore+speedScore)/2) };
      [dismissed[0], dismissed[1]].forEach(id => { const ev=V2_CRISIS.find(e=>e.id===id); if(ev) Object.entries(ev.boost).forEach(([t,v])=>{ traits[t]=Math.min(100,(traits[t]||50)+v*0.35); }); });
      onAnswer(traits);
    }
    const sevColors={5:C.red,4:C.amber,3:C.accent,2:C.green,1:C.muted};
    return (
      <V2Shell label="Stress Response" title="Inbox on fire — triage these alerts" desc="Click to dismiss each alert in your preferred order.">
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
          {V2_CRISIS.map(ev => {
            const isDone=dismissed.includes(ev.id), rank=dismissed.indexOf(ev.id)+1;
            return (
              <div key={ev.id} onClick={()=>dismiss(ev.id)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
                background:isDone?"rgba(255,255,255,0.03)":C.card, border:`0.5px solid ${isDone?"rgba(255,255,255,0.05)":sevColors[ev.sev]+"40"}`,
                borderLeft:`2px solid ${isDone?"rgba(255,255,255,0.1)":sevColors[ev.sev]}`,
                borderRadius:6, cursor:isDone?"default":"pointer", opacity:isDone?0.35:1
              }}>
                <div style={{ width:18, height:18, borderRadius:"50%", border:`1.5px solid ${isDone?C.muted:sevColors[ev.sev]}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:isDone?C.muted:sevColors[ev.sev] }}>{isDone?rank:ev.sev}</div>
                <span style={{ fontSize:12, color:isDone?C.muted:C.text, textDecoration:isDone?"line-through":"none" }}>{ev.text}</span>
              </div>
            );
          })}
        </div>
        <V2Btn onClick={submit} disabled={!done}>Submit triage order</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q2: Pattern Under Noise (grid) - KEEP, different from V1-Q2 pattern grid
  function V2_Q2({ onAnswer }) {
    const SIZE=8;
    const { grid, answerRow, answerCol } = useMemo(() => {
      const g = Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>Math.floor(Math.random()*9)+1));
      const ar=Math.floor(Math.random()*(SIZE-2)), ac=Math.floor(Math.random()*(SIZE-2));
      for(let r=ar;r<ar+3;r++) for(let c=ac;c<ac+3;c++) g[r][c]=Math.min(9,g[r][c]+3);
      return { grid:g, answerRow:ar, answerCol:ac };
    }, []);
    const [sel, setSel]=useState(null), [elapsed, setElapsed]=useState(0), [done, setDone]=useState(false);
    const timerRef=useRef(null);
    useEffect(() => { timerRef.current=setInterval(()=>setElapsed(e=>{ if(e>=59){clearInterval(timerRef.current); setDone(true); return 60;} return e+1; }),1000); return ()=>clearInterval(timerRef.current); }, []);
    function selectRegion(r,c){ if(done&&sel)return; setSel({r,c}); clearInterval(timerRef.current); setDone(true); }
    function submit() {
      const correct=sel&&sel.r===answerRow&&sel.c===answerCol;
      const timeBonus=Math.max(0,60-elapsed);
      const precScore=correct?Math.round(50+timeBonus*0.8):15;
      const techScore=correct?Math.round(50+timeBonus*0.6):20;
      const wmScore=correct?Math.round(45+timeBonus*0.7):18;
      onAnswer({ Precision:precScore, Technical:techScore, WorkingMemory:wmScore });
    }
    const timeLeft=60-elapsed, pct=timeLeft/60;
    function inRegion(r,c,reg){ return reg&&r>=reg.r&&r<reg.r+3&&c>=reg.c&&c<reg.c+3; }
    return (
      <V2Shell label="Pattern Recognition" title="Find the anomalous region" desc="One 3×3 block has a different pattern. Click any cell within it.">
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.06)", borderRadius:1 }}>
            <div style={{ height:"100%", width:`${pct*100}%`, background:pct>0.5?C.green:pct>0.25?C.amber:C.red, borderRadius:1 }} />
          </div>
          <span style={{ fontSize:11, color:pct>0.25?C.dim:C.red }}>{timeLeft}s</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${SIZE},1fr)`, gap:2, marginBottom:14, fontFamily:"monospace" }}>
          {grid.map((row,r)=>row.map((val,c)=>{
            const highlighted=inRegion(r,c,sel), isAnswer=done&&r>=answerRow&&r<answerRow+3&&c>=answerCol&&c<answerCol+3, isWrong=done&&highlighted&&!isAnswer;
            return (
              <div key={`${r}-${c}`} onClick={()=>!done&&selectRegion(r-(r%3),c-(c%3))} style={{
                aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600,
                background: isAnswer?"#10B98115":isWrong?"#EF444415":highlighted?`${C.accent}25`:"rgba(255,255,255,0.04)",
                border: `0.5px solid ${isAnswer?C.green:isWrong?C.red:highlighted?C.accent+"60":"rgba(255,255,255,0.05)"}`, borderRadius:2,
                color: val>7?C.amber:val<4?C.accent:C.dim, cursor:done?"default":"pointer"
              }}>{val}</div>
            );
          }))}
        </div>
        {(done||sel)&&<V2Btn onClick={submit} style={{ width:"100%" }}>Submit</V2Btn>}
        {!done&&!sel&&<div style={{ height:36 }} />}
      </V2Shell>
    );
  }

  // V2-Q3: Working Memory - Sequence recall (unique to V2)
  function V2_Q3({ onAnswer }) {
    const seq=useMemo(()=>Array.from({length:9},()=>Math.floor(Math.random()*9)+1), []);
    const [phase,setPhase]=useState("show"), [input,setInput]=useState(""), [timeLeft,setTimeLeft]=useState(4);
    const timerRef=useRef(null);
    useEffect(() => { if(phase!=="show")return; timerRef.current=setInterval(()=>setTimeLeft(t=>{ if(t<=1){clearInterval(timerRef.current); setPhase("recall"); return 0;} return t-1; }),1000); return ()=>clearInterval(timerRef.current); }, [phase]);
    function submit() {
      const userDigits=input.replace(/\s/g,"").split("").map(Number), reversed=[...seq].reverse();
      let correct=0; reversed.forEach((d,i)=>{ if(userDigits[i]===d) correct++; });
      const score=Math.round((correct/seq.length)*100);
      onAnswer({ WorkingMemory:score, Precision:Math.round(score*0.9), Technical:Math.round(score*0.7) });
    }
    return (
      <V2Shell label="Working Memory" title="Memorise and reverse" desc={phase==="show"?"Memorise this 9-digit sequence. You will type it backwards.":"Type the sequence backwards (right to left)."}>
        {phase==="show"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:16, flexWrap:"wrap" }}>
              {seq.map((d,i)=>(
                <div key={i} style={{ width:36, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:C.card, border:`1px solid ${C.accent}50`, borderRadius:6, fontSize:18, fontWeight:700, color:C.hi, fontFamily:"monospace" }}>{d}</div>
              ))}
            </div>
            <div style={{ textAlign:"center", color:C.amber, fontSize:12 }}>Disappearing in {timeLeft}s…</div>
          </div>
        )}
        {phase==="recall"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:16, flexWrap:"wrap" }}>
              {seq.map((_,i)=>(<div key={i} style={{ width:36, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.08)`, borderRadius:6, fontSize:18, color:C.muted, fontFamily:"monospace" }}>?</div>))}
            </div>
            <input value={input} onChange={e=>setInput(e.target.value)} maxLength={9} placeholder="Type 9 digits reversed…" autoFocus
              style={{ width:"100%", padding:"10px", background:C.card, border:`1px solid ${C.border}`, borderRadius:6, color:C.hi, fontSize:16, fontFamily:"monospace", letterSpacing:"0.15em", textAlign:"center", outline:"none", marginBottom:12 }} />
            <V2Btn onClick={submit} disabled={input.replace(/\s/g,"").length<seq.length} style={{ width:"100%" }}>Submit</V2Btn>
          </div>
        )}
      </V2Shell>
    );
  }

  // V2-Q4: Tolerance Mapping - Ethical ranker (similar to V1-Q3, prefer this V2 version)
  const V2_SCENARIOS = [
    { id:"a", label:"Tell a client their mandate lost 18% due to your model error", trait:"Risk" },
    { id:"b", label:"Sign off on a deal that eliminates 1,200 jobs — legally sound", trait:"Narrative" },
    { id:"c", label:"Work every weekend for 3 years to make MD", trait:"Endurance" },
    { id:"d", label:"Entire career in a role with no external visibility", trait:"Social" },
    { id:"e", label:"Approve a product priced to extract from retail investors", trait:"Stability" },
    { id:"f", label:"Relocate to a city you dislike for highest pay", trait:"Speed" },
  ];
  function V2_Q4({ onAnswer }) {
    const [order,setOrder]=useState(V2_SCENARIOS.map(s=>s.id)), [dragId,setDragId]=useState(null), [overIdx,setOverIdx]=useState(null);
    function handleDrop(toIdx){ if(dragId===null)return; const fromIdx=order.indexOf(dragId); if(fromIdx===toIdx)return; const next=[...order]; next.splice(fromIdx,1); next.splice(toIdx,0,dragId); setOrder(next); setDragId(null); setOverIdx(null); }
    function submit() { const traits={}; order.forEach((id,rank)=>{ const s=V2_SCENARIOS.find(x=>x.id===id); traits[s.trait]=Math.round(Math.max(15,100-rank*14)); }); onAnswer(traits); }
    return (
      <V2Shell label="Tolerance Mapping" title="Rank these professional trade-offs" desc="Drag from most tolerable (top) to absolutely unacceptable (bottom).">
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:16 }}>
          {order.map((id,idx)=>{
            const sc=V2_SCENARIOS.find(x=>x.id===id), isOver=overIdx===idx;
            return (
              <div key={id} draggable onDragStart={()=>setDragId(id)} onDragOver={e=>{e.preventDefault();setOverIdx(idx);}} onDragLeave={()=>setOverIdx(null)} onDrop={()=>handleDrop(idx)} onDragEnd={()=>{setDragId(null);setOverIdx(null);}}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", background:isOver?`${C.accent}15`:dragId===id?"rgba(255,255,255,0.02)":C.card, border:`0.5px solid ${isOver?C.accent+"80":"rgba(255,255,255,0.07)"}`, borderRadius:6, cursor:"grab", opacity:dragId===id?0.5:1 }}>
                <span style={{ fontSize:10, color:C.muted, minWidth:12 }}>{idx+1}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity:0.3 }}><rect y="1" width="12" height="1.5" rx="0.75" fill="white"/><rect y="5" width="12" height="1.5" rx="0.75" fill="white"/><rect y="9" width="12" height="1.5" rx="0.75" fill="white"/></svg>
                <span style={{ fontSize:12, color:C.text }}>{sc.label}</span>
              </div>
            );
          })}
        </div>
        <V2Btn onClick={submit} style={{ width:"100%" }}>Confirm ranking</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q5: Audit Eye - Data table (unique to V2)
  function V2_Q5({ onAnswer }) {
    const rows=useMemo(()=>{
      const base=[{dept:"Equities",rev:142,cost:89,margin:null,hc:34,revPerHC:null},{dept:"FICC",rev:218,cost:156,margin:null,hc:52,revPerHC:null},{dept:"IBD",rev:98,cost:71,margin:null,hc:28,revPerHC:null},{dept:"AM",rev:76,cost:38,margin:null,hc:19,revPerHC:null},{dept:"Prime",rev:184,cost:109,margin:null,hc:41,revPerHC:null},{dept:"Research",rev:44,cost:36,margin:null,hc:18,revPerHC:null}];
      base.forEach(r=>{ r.margin=Math.round((r.rev-r.cost)/r.rev*100); r.revPerHC=Math.round(r.rev/r.hc*10)/10; });
      const errorCells=new Set(); while(errorCells.size<2) errorCells.add(Math.floor(Math.random()*6));
      const errArr=[...errorCells], correctMargins=base.map(r=>r.margin), correctRevPerHC=base.map(r=>r.revPerHC);
      base[errArr[0]].margin=correctMargins[errArr[0]]+(Math.random()<0.5?-12:15);
      base[errArr[1]].revPerHC=Math.round((correctRevPerHC[errArr[1]]*1.38)*10)/10;
      return { rows:base, errorRows:errArr, correctMargins, correctRevPerHC };
    }, []);
    const [clicked,setClicked]=useState([]), [submitted,setSubmitted]=useState(false), [elapsed,setElapsed]=useState(0);
    const timerRef=useRef(null);
    useEffect(()=>{ timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000); return ()=>clearInterval(timerRef.current); }, []);
    function toggleCell(cellId){ if(submitted)return; setClicked(prev=>prev.includes(cellId)?prev.filter(x=>x!==cellId):prev.length<2?[...prev,cellId]:prev); }
    function submit() { clearInterval(timerRef.current); setSubmitted(true); const errorCellIds=[`${rows.errorRows[0]}-margin`,`${rows.errorRows[1]}-revPerHC`]; const correctFound=clicked.filter(c=>errorCellIds.includes(c)).length, wrongClicked=clicked.filter(c=>!errorCellIds.includes(c)).length; const netScore=Math.round(((correctFound*50)-(wrongClicked*20))*(1-elapsed*0.004)); const finalScore=Math.max(5,Math.min(100,netScore)); onAnswer({ Precision:finalScore, Technical:Math.round(finalScore*0.9), WorkingMemory:Math.round(finalScore*0.8) }); }
    const cellKey=(ri,col)=>`${ri}-${col}`;
    return (
      <V2Shell label="Audit Eye" title="Two cells contain errors" desc="Click exactly 2 cells. Margin % = (Rev−Cost)/Rev. Rev/HC = Rev÷HC.">
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <span style={{ fontSize:10, color:C.muted }}>Time: {elapsed}s</span>
          <span style={{ marginLeft:"auto", fontSize:10, color:C.dim }}>Selected: {clicked.length}/2</span>
        </div>
        <div style={{ overflowX:"auto", marginBottom:12 }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, fontFamily:"monospace" }}>
            <thead><tr>{["Dept","Rev","Cost","Margin%","HC","Rev/HC"].map(c=>(<th key={c} style={{ padding:"6px 8px", color:C.muted, fontWeight:500, borderBottom:`1px solid ${C.border}`, textAlign:"left" }}>{c}</th>))}</tr></thead>
            <tbody>
              {rows.rows.map((row,ri)=>(
                <tr key={ri}>
                  <td style={{ padding:"6px 8px", color:C.dim }}>{row.dept}</td>
                  <td style={{ padding:"6px 8px", color:C.text }}>{row.rev}</td>
                  <td style={{ padding:"6px 8px", color:C.text }}>{row.cost}</td>
                  {["margin","revPerHC"].map(col=>{
                    const cid=cellKey(ri,col), isClicked=clicked.includes(cid), isError=submitted&&rows.errorRows.includes(ri)&&((col==="margin"&&ri===rows.errorRows[0])||(col==="revPerHC"&&ri===rows.errorRows[1])), isWrong=submitted&&isClicked&&!isError;
                    return (
                      <td key={col} onClick={()=>toggleCell(cid)} style={{
                        padding:"6px 8px", cursor:submitted?"default":"pointer",
                        background: isError&&submitted?"#10B98115":isWrong?"#EF444415":isClicked?`${C.accent}20`:"transparent",
                        border: `0.5px solid ${isClicked?submitted?(isError?C.green:C.red):C.accent:"transparent"}`, borderRadius:3,
                        color: isClicked?C.hi:C.text, fontWeight:isClicked?600:400
                      }}>{col==="margin"?`${row.margin}%`:row.revPerHC}</td>
                    );
                  })}
                  <td style={{ padding:"6px 8px", color:C.text }}>{row.hc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!submitted?<V2Btn onClick={submit} disabled={clicked.length!==2} style={{ width:"100%" }}>Submit audit</V2Btn>:<V2Btn onClick={()=>submit()} style={{ width:"100%" }}>Continue</V2Btn>}
      </V2Shell>
    );
  }

  // V2-Q6: Narrative Builder (replaces V1-Q4, this V2 version is richer)
  const V2_CHIPS = {
    Verb:    [{v:"Deconstructing",t:"Technical"},{v:"Brokering",t:"Social"},{v:"Hedging",t:"Risk"},{v:"Institutionalising",t:"Stability"},{v:"Disrupting",t:"Narrative"}],
    Subject: [{v:"illiquid credit",t:"Risk"},{v:"a hostile takeover",t:"Endurance"},{v:"a regulatory framework",t:"Stability"},{v:"an early-stage thesis",t:"Narrative"},{v:"a derivative structure",t:"Technical"}],
    Outcome: [{v:"generates alpha no-one else sees",t:"Technical"},{v:"closes in 48 hours",t:"Speed"},{v:"outlasts market cycles",t:"Stability"},{v:"redefines an industry",t:"Narrative"},{v:"protects the downside",t:"Risk"}],
  };
  function V2_Q6({ onAnswer }) {
    const [sel,setSel]=useState({Verb:null,Subject:null,Outcome:null}), ready=sel.Verb&&sel.Subject&&sel.Outcome;
    function submit() { const traits={Technical:45,Social:45,Risk:45,Stability:45,Narrative:45,Endurance:45,Speed:45,Precision:50,WorkingMemory:50,Calibration:45}; [sel.Verb,sel.Subject,sel.Outcome].forEach(c=>{if(c&&traits[c.t]!==undefined)traits[c.t]=Math.min(100,traits[c.t]+28);}); onAnswer(traits); }
    return (
      <V2Shell label="Motivation Profile" title="Build your professional sentence" desc="Choose one from each row. The combination reveals your intrinsic drive.">
        <div style={{ background:`${C.accent}08`, border:`1px solid ${C.accent}30`, borderRadius:8, padding:"12px 14px", marginBottom:18, fontSize:13, lineHeight:2.4, fontStyle:"italic", color:C.text }}>
          {"I get satisfaction from "}<Chip2 val={sel.Verb?.v} />{" "}<Chip2 val={sel.Subject?.v} />{" that "}<Chip2 val={sel.Outcome?.v} />{"."}
        </div>
        {Object.entries(V2_CHIPS).map(([cat,chips])=>(
          <div key={cat} style={{ marginBottom:14 }}>
            <p style={{ fontSize:9, color:C.muted, marginBottom:6, fontWeight:600, letterSpacing:"0.1em" }}>{cat.toUpperCase()}</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {chips.map(c=>{
                const active=sel[cat]?.v===c.v;
                return <button key={c.v} onClick={()=>setSel(s=>({...s,[cat]:c}))} style={{ padding:"5px 11px", fontSize:11, borderRadius:16, background:active?C.accent:"rgba(255,255,255,0.05)", border:`0.5px solid ${active?C.accent:"rgba(255,255,255,0.1)"}`, color:active?"#fff":C.dim, cursor:"pointer" }}>{c.v}</button>;
              })}
            </div>
          </div>
        ))}
        <V2Btn onClick={submit} disabled={!ready} style={{ width:"100%", marginTop:6 }}>Confirm</V2Btn>
      </V2Shell>
    );
  }
  function Chip2({ val }) { return <span style={{ borderBottom:`1.5px solid ${val?C.accent:"rgba(255,255,255,0.15)"}`, padding:"0 4px", color:val?C.accent:C.muted, fontWeight:val?600:400 }}>{val||"___"}</span>; }

  // V2-Q7: Calibration (unique to V2)
  const V2_EVENTS = [
    { q:"A randomly selected S&P 500 stock beats the index over 12 months", truth:38 },
    { q:"A Series A startup founded today reaches a $1B valuation", truth:1 },
    { q:"A 10-year US Treasury held to maturity defaults", truth:1 },
    { q:"An IB analyst promoted to associate within 3 years", truth:55 },
    { q:"A hedge fund that outperformed last year outperforms again", truth:47 },
  ];
  function V2_Q7({ onAnswer }) {
    const [vals,setVals]=useState(V2_EVENTS.map(()=>50));
    function submit() {
      const brier = V2_EVENTS.reduce((acc,ev,i)=>{ const diff=(vals[i]/100)-(ev.truth/100); return acc+diff*diff; },0)/V2_EVENTS.length;
      const calibScore = Math.round(Math.max(5, (1-brier*3)*100));
      onAnswer({ Calibration:calibScore, Precision:Math.round(calibScore*0.8), Risk:Math.round(calibScore*0.7) });
    }
    return (
      <V2Shell label="Calibration Test" title="Estimate these probabilities" desc="Rate your confidence (0-100%). Measures how well your confidence matches reality.">
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:18 }}>
          {V2_EVENTS.map((ev,i)=>(
            <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
              <p style={{ fontSize:12, color:C.text, marginBottom:8 }}>{ev.q}</p>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <input type="range" min="0" max="100" step="1" value={vals[i]} onChange={e=>{const n=[...vals];n[i]=+e.target.value;setVals(n);}} style={{ flex:1, accentColor:C.accent }} />
                <span style={{ fontFamily:"monospace", fontWeight:600, fontSize:12, color:C.accent, minWidth:36 }}>{vals[i]}%</span>
              </div>
            </div>
          ))}
        </div>
        <V2Btn onClick={submit} style={{ width:"100%" }}>Submit estimates</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q8: Risk Appetite (improved coin flip - replaces V1-Q7)
  function V2_Q8({ onAnswer }) {
    const [flips,setFlips]=useState(0), [wallet,setWallet]=useState(1000), [history,setHistory]=useState([]), [flipping,setFlipping]=useState(false), [stopped,setStopped]=useState(false), [betPct,setBetPct]=useState(20);
    function flip() {
      if(flipping||stopped)return; setFlipping(true);
      const betAmt=Math.round(wallet*betPct/100);
      setTimeout(()=>{
        const win=Math.random()<0.55, newWallet=win?wallet+Math.round(betAmt*1.5):Math.max(0,wallet-betAmt);
        setHistory(h=>[...h,{flip:flips+1,bet:betPct,win,wallet:newWallet}]); setWallet(newWallet); setFlips(f=>f+1);
        if(newWallet===0)setStopped(true); setFlipping(false);
      }, 450);
    }
    function submit() {
      const avgBet=history.length?history.reduce((a,h)=>a+h.bet,0)/history.length:betPct, kellyDev=Math.abs(avgBet-10);
      const riskScore=Math.min(95,Math.round(flips*12+(wallet>1000?10:0))), calibScore=Math.max(10,Math.round(100-kellyDev*2.5)), speedScore=Math.min(90,flips*8);
      onAnswer({ Risk:riskScore, Calibration:calibScore, Speed:speedScore, Endurance:Math.min(85,flips*10) });
    }
    const kellyOptimal=Math.round(wallet*0.10);
    return (
      <V2Shell label="Risk Appetite" title="Variable-stake coin flip" desc="55% win chance, 1.5× payout. Choose bet size. Kelly optimal ≈ 10% of bankroll.">
        <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ flex:1, background:C.card, borderRadius:6, padding:"10px", minWidth:80 }}>
            <div style={{ fontSize:10, color:C.muted }}>Wallet</div>
            <div style={{ fontSize:18, fontWeight:700, color:wallet>1000?C.green:wallet<600?C.red:C.hi, fontFamily:"monospace" }}>${wallet.toLocaleString()}</div>
          </div>
          <div style={{ flex:1, background:C.card, borderRadius:6, padding:"10px", minWidth:80 }}>
            <div style={{ fontSize:10, color:C.muted }}>Flips</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dim, fontFamily:"monospace" }}>{flips}</div>
          </div>
          <div style={{ flex:1, background:C.card, borderRadius:6, padding:"10px", minWidth:80 }}>
            <div style={{ fontSize:10, color:C.muted }}>Kelly</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.amber, fontFamily:"monospace" }}>${kellyOptimal}</div>
          </div>
        </div>
        {!stopped&&(
          <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px", marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:11, color:C.dim }}>Bet: {betPct}%</span>
              <span style={{ fontSize:11, color:C.amber }}>${Math.round(wallet*betPct/100)}</span>
            </div>
            <input type="range" min="5" max="100" step="5" value={betPct} onChange={e=>setBetPct(+e.target.value)} style={{ width:"100%", accentColor:C.accent }} />
          </div>
        )}
        {history.length>0&&(
          <div style={{ display:"flex", gap:2, marginBottom:12, flexWrap:"wrap" }}>
            {history.slice(-12).map((h,i)=>(<div key={i} style={{ width:20, height:20, borderRadius:3, background:h.win?`${C.green}30`:`${C.red}30`, border:`0.5px solid ${h.win?C.green+"60":C.red+"60"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:h.win?C.green:C.red }}>{h.win?"W":"L"}</div>))}
          </div>
        )}
        {!stopped?(
          <div style={{ display:"flex", gap:6 }}>
            <V2Btn onClick={flip} disabled={flipping||wallet===0} style={{ flex:1 }}>{flipping?"Flipping…":"Flip"}</V2Btn>
            {flips>=2&&<V2Btn onClick={()=>setStopped(true)} secondary style={{ flex:1 }}>Walk away</V2Btn>}
          </div>
        ):<V2Btn onClick={submit} style={{ width:"100%" }}>See results</V2Btn>}
        {flips===0&&!stopped&&<V2Btn onClick={()=>setStopped(true)} secondary style={{ width:"100%", marginTop:6, fontSize:11 }}>Skip this game</V2Btn>}
      </V2Shell>
    );
  }

  // V2-Q9: Ambiguity Tolerance (unique to V2)
  const V2_AMBIGUITY = [
    { text:"Your MD gives vague direction. No clarity for 2 weeks.", trait:"Stability" },
    { text:"A deal you've worked on for 6 months falls apart at signing.", trait:"Endurance" },
    { text:"Model a scenario with no historical precedent.", trait:"Technical" },
    { text:"Your thesis is right but the market disagrees for 18 months.", trait:"Risk" },
    { text:"Manage a client relationship with no defined mandate.", trait:"Social" },
  ];
  function V2_Q9({ onAnswer }) {
    const [ratings,setRatings]=useState(V2_AMBIGUITY.map(()=>3));
    function submit() {
      const traits={}; V2_AMBIGUITY.forEach((sc,i)=>{ traits[sc.trait]=Math.round((ratings[i]/5)*100); });
      const avg=ratings.reduce((a,v)=>a+v,0)/ratings.length; traits.Stability=Math.round(100-avg*12);
      onAnswer(traits);
    }
    return (
      <V2Shell label="Ambiguity Tolerance" title="Rate your comfort with each scenario" desc="1 = deeply uncomfortable, 5 = thrives in this.">
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {V2_AMBIGUITY.map((sc,i)=> (
            <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
              <p style={{ fontSize:12, color:C.text, marginBottom:8 }}>{sc.text}</p>
              <div style={{ display:"flex", justifyContent:"space-between", gap:4 }}>
                {[1,2,3,4,5].map(v=>(
                  <button key={v} onClick={()=>{const n=[...ratings];n[i]=v;setRatings(n);}} style={{
                    flex:1, padding:"6px 0", borderRadius:4, border:`0.5px solid ${ratings[i]>=v?C.accent:"rgba(255,255,255,0.08)"}`,
                    background: ratings[i]>=v?`${C.accent}20`:"transparent", color:ratings[i]>=v?C.accent:C.muted, fontSize:11, fontWeight:600, cursor:"pointer"
                  }}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <V2Btn onClick={submit} style={{ width:"100%" }}>Continue</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q10: Time Budget (unique to V2)
  const V2_BUCKETS = [
    { id:"deep", label:"Deep analytical work (modelling, code)", trait:"Technical", defaultH:4 },
    { id:"comms", label:"Client calls, pitches, relationships", trait:"Social", defaultH:2 },
    { id:"meetings", label:"Internal meetings, strategy sessions", trait:"Narrative", defaultH:2 },
    { id:"admin", label:"Reporting, compliance, documentation", trait:"Stability", defaultH:1 },
    { id:"learning", label:"Reading, market monitoring", trait:"Precision", defaultH:1 },
  ];
  function V2_Q10({ onAnswer }) {
    const [hours,setHours]=useState(V2_BUCKETS.map(b=>b.defaultH)), total=hours.reduce((a,v)=>a+v,0), overBudget=total>10;
    function submit() {
      const traits={}; V2_BUCKETS.forEach((b,i)=>{ traits[b.trait]=Math.round((hours[i]/10)*100); });
      traits.Social=Math.round((hours[1]/total)*100); traits.Technical=Math.round((hours[0]/total)*100); traits.Endurance=Math.min(95,total*5+50);
      onAnswer(traits);
    }
    return (
      <V2Shell label="Daily Design" title="Allocate your ideal 10-hour day" desc="Distribution reveals what you genuinely want to do.">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:600, color:overBudget?C.red:C.dim }}>{total}h / 10h</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {V2_BUCKETS.map((b,i)=> (
            <div key={b.id}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:C.dim }}>{b.label}</span>
                <span style={{ fontSize:11, fontWeight:600, color:C.accent }}>{hours[i]}h</span>
              </div>
              <input type="range" min="0" max="8" step="0.5" value={hours[i]} onChange={e=>{const n=[...hours];n[i]=+e.target.value;setHours(n);}} style={{ width:"100%", accentColor:overBudget?C.red:C.accent }} />
            </div>
          ))}
        </div>
        {overBudget&&<p style={{ fontSize:11, color:C.red, marginBottom:8 }}>Over budget by {total-10}h</p>}
        <V2Btn onClick={submit} disabled={overBudget||total===0} style={{ width:"100%" }}>Confirm allocation</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q11: Information Diet (harder version - replaces V1-Q5)
  const V2_HEADLINES = [
    { id:"a", text:"Bayesian updating in portfolio construction", traits:{Technical:22,Precision:15} },
    { id:"b", text:"How three GPs navigated LP conflicts in $2B fund close", traits:{Narrative:18,Social:12,Risk:10} },
    { id:"c", text:"Municipal bond market: $48B infrastructure gap", traits:{Stability:18,Narrative:10} },
    { id:"d", text:"Fed's reverse-repo at $2.4T: signals for 2025", traits:{Technical:12,Stability:12,Calibration:10} },
    { id:"e", text:"Debt restructuring inside $5B Oil Co. refinancing", traits:{Risk:18,Endurance:10} },
    { id:"f", text:"Tail-risk hedging: variance swaps vs VIX calls", traits:{Technical:18,Risk:12,Calibration:12} },
    { id:"g", text:"Founder psychology: why 60% of Series C CEOs get replaced", traits:{Narrative:18,Social:12} },
    { id:"h", text:"Pension fund LDI in 5% rate environment", traits:{Stability:18,Precision:12} },
  ];
  function V2_Q11({ onAnswer }) {
    const [sel,setSel]=useState([]);
    function toggle(id){ setSel(s=>s.includes(id)?s.filter(x=>x!==id):s.length<3?[...s,id]:s); }
    function submit() {
      const traits={Technical:38,Social:38,Risk:38,Stability:38,Narrative:38,Endurance:38,Speed:50,Precision:50,WorkingMemory:50,Calibration:38};
      sel.forEach(id=>{ const h=V2_HEADLINES.find(x=>x.id===id); Object.entries(h.traits).forEach(([t,v])=>{ if(traits[t]!==undefined)traits[t]=Math.min(95,traits[t]+v); }); });
      onAnswer(traits);
    }
    return (
      <V2Shell label="Information Diet" title="Pick your 3 reads for 10 minutes" desc="Your selection fingerprints your intellectual appetite.">
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
          {V2_HEADLINES.map(h=>{
            const active=sel.includes(h.id);
            return (
              <div key={h.id} onClick={()=>toggle(h.id)} style={{
                display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px",
                background:active?`${C.accent}12`:C.card, border:`0.5px solid ${active?C.accent+"60":C.border}`, borderRadius:6, cursor:"pointer"
              }}>
                <div style={{ width:14, height:14, borderRadius:3, border:`1.5px solid ${active?C.accent:C.muted}`, background:active?C.accent:"transparent", flexShrink:0, marginTop:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {active&&<svg width="9" height="7" viewBox="0 0 9 7"><path d="M1 3.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none"/></svg>}
                </div>
                <span style={{ fontSize:12, color:active?C.hi:C.dim, fontWeight:active?500:400 }}>{h.text}</span>
              </div>
            );
          })}
        </div>
        <V2Btn onClick={submit} disabled={sel.length===0} style={{ width:"100%" }}>Continue</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q12: Steelmanning (unique to V2)
  const V2_POSITIONS = [
    { pos:"Passive index funds are better for 95% of retail investors", counter:"Active management generates superior risk-adjusted returns" },
    { pos:"ESG investing necessarily sacrifices returns", counter:"ESG factors are valid alpha signals" },
    { pos:"Hedge fund fees (2&20) are unjustifiable", counter:"Hedge funds provide genuine diversification value" },
    { pos:"VC as an asset class is structurally unfair to non-institutional investors", counter:"VC democratisation creates more harm than good" },
  ];
  function V2_Q12({ onAnswer }) {
    const [ratings,setRatings]=useState(V2_POSITIONS.map(()=>3));
    function submit() {
      const avg=ratings.reduce((a,v)=>a+v,0)/ratings.length;
      const narrativeScore=Math.round((avg/5)*100), calibScore=Math.round((avg/5)*90);
      onAnswer({ Narrative:narrativeScore, Social:Math.round(narrativeScore*0.8), Calibration:calibScore, Technical:Math.round(narrativeScore*0.5) });
    }
    return (
      <V2Shell label="Intellectual Flexibility" title="Steelman the opposing view" desc="Rate how convincingly you could argue AGAINST each statement.">
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {V2_POSITIONS.map((p,i)=> (
            <div key={i} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
              <p style={{ fontSize:11, color:C.dim, marginBottom:3, fontStyle:"italic" }}>Statement:</p>
              <p style={{ fontSize:12, color:C.text, marginBottom:8 }}>"{p.pos}"</p>
              <p style={{ fontSize:10, color:C.muted, marginBottom:6 }}>Argue: "{p.counter}"</p>
              <div style={{ display:"flex", justifyContent:"space-between", gap:4 }}>
                {[1,2,3,4,5].map(v=>(
                  <button key={v} onClick={()=>{const n=[...ratings];n[i]=v;setRatings(n);}} style={{
                    flex:1, padding:"6px 0", borderRadius:4, border:`0.5px solid ${ratings[i]===v?C.accent:"rgba(255,255,255,0.08)"}`,
                    background: ratings[i]===v?`${C.accent}25`:"transparent", color:ratings[i]===v?C.accent:C.muted, fontSize:11, fontWeight:600, cursor:"pointer"
                  }}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <V2Btn onClick={submit} style={{ width:"100%" }}>Continue</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q13: Speed-Accuracy (unique to V2)
  function V2_Q13({ onAnswer }) {
    const questions=useMemo(()=>Array.from({length:8},()=>{
      const a=Math.floor(Math.random()*50)+10, b=Math.floor(Math.random()*40)+5;
      const ops=[{sym:"+",ans:a+b},{sym:"−",ans:Math.abs(a-b)}];
      const op=ops[Math.floor(Math.random()*2)];
      return {a,b,sym:op.sym,ans:op.ans};
    }), []);
    const [qIdx,setQIdx]=useState(0), [input,setInput]=useState(""), [results,setResults]=useState([]), [timeLeft,setTimeLeft]=useState(4), [done,setDone]=useState(false);
    const timerRef=useRef(null), inputRef=useRef(null);
    useEffect(()=>{ if(done)return; clearInterval(timerRef.current); setTimeLeft(4); timerRef.current=setInterval(()=>setTimeLeft(t=>{ if(t<=1){clearInterval(timerRef.current); advance(false,null); return 0;} return t-1; }),1000); inputRef.current?.focus(); return ()=>clearInterval(timerRef.current); }, [qIdx,done]);
    function advance(answered,userAns) {
      clearInterval(timerRef.current);
      const correct=answered&&userAns===questions[qIdx].ans, timeTaken=4-timeLeft;
      const next=[...results,{correct,timeTaken:Math.max(1,timeTaken)}]; setResults(next); setInput("");
      if(qIdx+1>=questions.length){ setDone(true); const correctCount=next.filter(r=>r.correct).length, avgTime=next.reduce((a,r)=>a+r.timeTaken,0)/next.length, speedScore=Math.round(Math.max(10,100-avgTime*15)), precScore=Math.round((correctCount/questions.length)*100); onAnswer({Speed:speedScore,Precision:precScore,Endurance:Math.round((speedScore+precScore)/2)}); }
      else setQIdx(i=>i+1);
    }
    function handleKey(e){ if(e.key==="Enter"&&input)advance(true,parseInt(input,10)); }
    if(done) return <V2Shell label="Speed Test" title="Calculating…" />;
    const q=questions[qIdx];
    return (
      <V2Shell label="Speed-Accuracy" title="Mental arithmetic under pressure" desc={`Question ${qIdx+1} of ${questions.length}. 4 seconds each.`}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ height:2, background:"rgba(255,255,255,0.06)", borderRadius:1, marginBottom:12 }}>
            <div style={{ height:"100%", width:`${(timeLeft/4)*100}%`, background:timeLeft>2?C.green:C.red, borderRadius:1 }} />
          </div>
          <div style={{ fontSize:32, fontWeight:700, color:C.hi, fontFamily:"monospace", marginBottom:12 }}>{q.a} {q.sym} {q.b} = ?</div>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value.replace(/[^0-9]/g,""))} onKeyDown={handleKey} placeholder="?" type="number"
            style={{ fontSize:24, fontWeight:700, textAlign:"center", width:"100%", padding:"10px", background:C.card, border:`2px solid ${C.accent}60`, borderRadius:8, color:C.hi, outline:"none", fontFamily:"monospace" }} />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ fontSize:10, color:C.muted }}>{results.filter(r=>r.correct).length} correct</span>
            <span style={{ fontSize:10, color:timeLeft<=1?C.red:C.muted }}>{timeLeft}s</span>
          </div>
        </div>
        <V2Btn onClick={()=>{if(input)advance(true,parseInt(input,10));}} disabled={!input} style={{ width:"100%" }}>Submit (Enter)</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q14: Prioritisation (unique to V2)
  const V2_TASKS = [
    { id:"a", text:"Finalise client IM — MD review at 5pm today", urgency:5, importance:5 },
    { id:"b", text:"Fix model error — live positions at stake", urgency:5, importance:4 },
    { id:"c", text:"Draft Q3 board pack — deadline in 3 days", urgency:3, importance:5 },
    { id:"d", text:"Reply to 40 unread emails", urgency:3, importance:2 },
    { id:"e", text:"1-on-1 with struggling junior analyst", urgency:1, importance:3 },
    { id:"f", text:"Weekly self-review of deal pipeline", urgency:1, importance:4 },
  ];
  const V2_SLOTS = ["Do now","Do today","Delegate","Drop / defer"];
  function V2_Q14({ onAnswer }) {
    const [assignments,setAssignments]=useState({}), allAssigned=V2_TASKS.every(t=>assignments[t.id]!==undefined);
    function assign(taskId,slot){ setAssignments(a=>({...a,[taskId]:slot})); }
    function submit() {
      let precScore=50;
      V2_TASKS.forEach(task=>{
        const slot=assignments[task.id]; if(!slot)return;
        const ideal = task.urgency>=4&&task.importance>=4?"Do now":task.urgency>=3||task.importance>=4?"Do today":task.urgency<=1&&task.importance<=2?"Drop / defer":"Delegate";
        if(slot===ideal)precScore+=8; else if(slot==="Do now"&&task.urgency<3&&task.importance<3)precScore-=12;
      });
      const finalPrec=Math.max(10,Math.min(100,precScore));
      onAnswer({ Precision:finalPrec, Speed:Math.round(finalPrec*0.8), Endurance:Math.round(finalPrec*0.9), Technical:Math.round(finalPrec*0.6) });
    }
    const slotColors={"Do now":C.red,"Do today":C.amber,"Delegate":C.green,"Drop / defer":C.muted};
    return (
      <V2Shell label="Prioritisation" title="Assign each task to a slot" desc="Crisis week. You cannot do everything.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:5, marginBottom:10 }}>
          {V2_SLOTS.map(s=>(<div key={s} style={{ padding:"5px 8px", borderRadius:4, background:`${slotColors[s]}15`, border:`0.5px solid ${slotColors[s]}40`, textAlign:"center", fontSize:10, fontWeight:600, color:slotColors[s] }}>{s}</div>))}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
          {V2_TASKS.map(task=> (
            <div key={task.id} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
              <p style={{ fontSize:12, color:C.text, marginBottom:8, lineHeight:1.4 }}>{task.text}</p>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {V2_SLOTS.map(sl=>{
                  const active=assignments[task.id]===sl;
                  return <button key={sl} onClick={()=>assign(task.id,sl)} style={{ padding:"4px 8px", borderRadius:4, fontSize:10, background:active?`${slotColors[sl]}25`:"transparent", border:`0.5px solid ${active?slotColors[sl]:C.border}`, color:active?slotColors[sl]:C.muted, cursor:"pointer" }}>{sl}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
        <V2Btn onClick={submit} disabled={!allAssigned} style={{ width:"100%" }}>Submit plan</V2Btn>
      </V2Shell>
    );
  }

  // V2-Q15: Identity Anchoring (unique to V2)
  const V2_IDENTITIES = [
    { id:"a", text:"The person who finds the edge in a dataset nobody else queries", core:"Technical" },
    { id:"b", text:"The person clients call when scared and need calm", core:"Social" },
    { id:"c", text:"The person who thrives when thesis takes years to play out", core:"Endurance" },
    { id:"d", text:"The person whose model the firm trusts under audit", core:"Precision" },
    { id:"e", text:"The person who backs founders when world thinks they're delusional", core:"Narrative" },
    { id:"f", text:"The person who knows exactly how much risk is too much", core:"Risk" },
  ];
  function V2_Q15({ onAnswer }) {
    const [order,setOrder]=useState(V2_IDENTITIES.map(x=>x.id)), [dragId,setDragId]=useState(null), [overIdx,setOverIdx]=useState(null);
    function handleDrop(toIdx){ if(dragId===null)return; const fromIdx=order.indexOf(dragId); if(fromIdx===toIdx)return; const next=[...order]; next.splice(fromIdx,1); next.splice(toIdx,0,dragId); setOrder(next); setDragId(null); setOverIdx(null); }
    function submit() {
      const traits={}; order.forEach((id,rank)=>{ const item=V2_IDENTITIES.find(x=>x.id===id); traits[item.core]=Math.round(Math.max(20,100-rank*14)); }); onAnswer(traits);
    }
    return (
      <V2Shell label="Identity Anchoring" title="Who are you, professionally?" desc="Drag to rank from most essential (top) to what you'd sacrifice (bottom).">
        <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:16 }}>
          {order.map((id,idx)=>{
            const item=V2_IDENTITIES.find(x=>x.id===id), pct=100-Math.round((idx/(order.length-1))*100), barColor=pct>65?C.green:pct>35?C.amber:C.red;
            return (
              <div key={id} draggable onDragStart={()=>setDragId(id)} onDragOver={e=>{e.preventDefault();setOverIdx(idx);}} onDragLeave={()=>setOverIdx(null)} onDrop={()=>handleDrop(idx)} onDragEnd={()=>{setDragId(null);setOverIdx(null);}}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:overIdx===idx?`${C.accent}12`:dragId===id?"rgba(255,255,255,0.02)":C.card, border:`0.5px solid ${overIdx===idx?C.accent+"60":C.border}`, borderLeft:`2px solid ${barColor}`, borderRadius:6, cursor:"grab", opacity:dragId===id?0.5:1 }}>
                <span style={{ fontSize:10, color:C.muted, minWidth:12 }}>{idx+1}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity:0.3 }}><rect y="1" width="12" height="1.5" rx=".75" fill="white"/><rect y="5" width="12" height="1.5" rx=".75" fill="white"/><rect y="9" width="12" height="1.5" rx=".75" fill="white"/></svg>
                <span style={{ fontSize:12, color:C.text, flex:1 }}>{item.text}</span>
              </div>
            );
          })}
        </div>
        <V2Btn onClick={submit} style={{ width:"100%" }}>Lock in identity</V2Btn>
      </V2Shell>
    );
  }

  // V2 UI Helpers
  function V2Shell({ label, title, desc, children }) {
    return (
      <div>
        <div style={{ fontSize:9, color:C.accent, letterSpacing:"0.12em", fontWeight:700, marginBottom:4, textTransform:"uppercase" }}>{label}</div>
        <h2 style={{ fontSize:15, fontWeight:600, color:C.hi, marginBottom: desc?6:18, lineHeight:1.3 }}>{title}</h2>
        {desc&&<p style={{ fontSize:12, color:C.dim, marginBottom:16, lineHeight:1.5 }}>{desc}</p>}
        {children}
      </div>
    );
  }
  function V2Btn({ onClick, disabled, children, secondary, style:extra }) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        padding:"10px 16px", borderRadius:6, border: secondary?`0.5px solid ${C.border}`:"none",
        background: secondary?"transparent":C.accent, color: secondary?C.dim:"#fff",
        fontSize:12, fontWeight:600, cursor: disabled?"not-allowed":"pointer",
        opacity: disabled?0.35:1, ...extra,
      }}>{children}</button>
    );
  }

  // ============ QUESTION SELECTION LOGIC ============
  // 15 total questions: ~10 V2 (70%), ~5 V1 (30%)
  // Conflict prevention: Don't select similar question types

  const V2_QUESTIONS = [
    { id:"V2_Q1", component:V2_Q1, label:"Crisis triage", exclude:[] },
    { id:"V2_Q2", component:V2_Q2, label:"Pattern recognition", exclude:["V1_Q2"] }, // Both are pattern grids
    { id:"V2_Q3", component:V2_Q3, label:"Working memory", exclude:[] },
    { id:"V2_Q4", component:V2_Q4, label:"Tolerance mapping", exclude:["V1_Q3"] }, // Both are drag-rankers
    { id:"V2_Q5", component:V2_Q5, label:"Audit eye", exclude:[] },
    { id:"V2_Q6", component:V2_Q6, label:"Motivation profile", exclude:["V1_Q4"] }, // Both are narrative builders
    { id:"V2_Q7", component:V2_Q7, label:"Calibration test", exclude:[] },
    { id:"V2_Q8", component:V2_Q8, label:"Risk appetite", exclude:["V1_Q7"] }, // Both are coin flips
    { id:"V2_Q9", component:V2_Q9, label:"Ambiguity tolerance", exclude:[] },
    { id:"V2_Q10", component:V2_Q10, label:"Daily design", exclude:["V1_Q6"] }, // V1_Q6 is simpler social battery
    { id:"V2_Q11", component:V2_Q11, label:"Information diet", exclude:["V1_Q5"] }, // Both are headline pickers
    { id:"V2_Q12", component:V2_Q12, label:"Steelmanning", exclude:[] },
    { id:"V2_Q13", component:V2_Q13, label:"Speed-accuracy", exclude:[] },
    { id:"V2_Q14", component:V2_Q14, label:"Prioritisation", exclude:[] },
    { id:"V2_Q15", component:V2_Q15, label:"Identity anchoring", exclude:[] },
  ];

  const V1_QUESTIONS = [
    { id:"V1_Q1", component:V1_Q1, label:"Crisis response", type:"speed_precision" },
    { id:"V1_Q2", component:null, label:"Pattern grid", type:"pattern" }, // Excluded - V2_Q2 is better
    { id:"V1_Q3", component:null, label:"Ethical ranker", type:"drag_rank" }, // Excluded - V2_Q4 is better
    { id:"V1_Q4", component:V1_Q4, label:"Narrative builder", type:"narrative" },
    { id:"V1_Q5", component:V1_Q5, label:"Headline picker", type:"headlines" },
    { id:"V1_Q6", component:V1_Q6, label:"Social battery", type:"social_slider" },
    { id:"V1_Q7", component:null, label:"Coin flip", type:"risk_game" }, // Excluded - V2_Q8 is better
  ];

  // Available V1 questions (filtered by conflicts with selected V2)
  function getAvailableV1(selectedV2Ids) {
    const excluded = new Set();
    selectedV2Ids.forEach(v2Id => {
      const q = V2_QUESTIONS.find(x => x.id === v2Id);
      if(q) q.exclude.forEach(e => {
        // Map V1 exclusions
        if(e === "V1_Q2") excluded.add("V1_Q2");
        if(e === "V1_Q3") excluded.add("V1_Q3");
        if(e === "V1_Q4") excluded.add("V1_Q4");
        if(e === "V1_Q7") excluded.add("V1_Q7");
        if(e === "V1_Q6") excluded.add("V1_Q6");
        if(e === "V1_Q5") excluded.add("V1_Q5");
      });
    });
    return V1_QUESTIONS.filter(q => q.component !== null && !excluded.has(q.id));
  }

  // Generate question set
  function generateQuestionSet() {
    // Shuffle V2
    const shuffledV2 = [...V2_QUESTIONS].sort(() => Math.random() - 0.5);
    
    // Select 10 V2 questions, ensuring we leave room for V1 variety
    const selectedV2 = shuffledV2.slice(0, 10);
    const selectedV2Ids = selectedV2.map(q => q.id);
    
    // Get available V1 questions (excluding conflicts)
    const availableV1 = getAvailableV1(selectedV2Ids);
    
    // Select 5 V1 questions (or fewer if conflicts reduce availability)
    const shuffledV1 = availableV1.sort(() => Math.random() - 0.5);
    const selectedV1 = shuffledV1.slice(0, 5);
    
    // Combine and shuffle
    const combined = [...selectedV2, ...selectedV1].sort(() => Math.random() - 0.5);
    
    return {
      questions: combined.map(q => q.component),
      labels: combined.map(q => q.label),
      total: combined.length,
      v2Count: selectedV2.length,
      v1Count: selectedV1.length
    };
  }

  // ============ MAIN SCREEN ============
  function ArchetypeDiagnosticMergedScreen({ onGoHome, onGoToTree }) {
    const [phase, setPhase] = useState("intro"); // intro | quiz | results
    const [step, setStep] = useState(0);
    const [traits, setTraits] = useState({ ...DEFAULT_TRAITS });
    const [result, setResult] = useState(null);
    const [questionSet, setQuestionSet] = useState(null);

    function startQuiz() {
      const qs = generateQuestionSet();
      setQuestionSet(qs);
      setPhase("quiz");
      setStep(0);
    }

    function handleAnswer(update) {
      const next = mergeTraits(traits, update);
      setTraits(next);
      if (step < questionSet.total - 1) {
        setStep(s => s + 1);
      } else {
        setResult(computeResult(next));
        setPhase("results");
        // Save to localStorage
        try {
          localStorage.setItem('archetypeResult', JSON.stringify({ scores: computeResult(next), traits: next, timestamp: Date.now() }));
        } catch {}
      }
    }

    function restart() { setPhase("intro"); setStep(0); setTraits({...DEFAULT_TRAITS}); setResult(null); setQuestionSet(null); }

    // Progress bar
    function ProgressBar() {
      const pct = Math.round((step / questionSet.total) * 100);
      return (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom: 6 }}>
            <span style={{ fontSize:10, color:C.muted }}>Q {step+1} / {questionSet.total}</span>
            <span style={{ fontSize:10, color:C.muted }}>{pct}%</span>
          </div>
          <div style={{ height:2, background:"rgba(255,255,255,0.06)", borderRadius:1 }}>
            <div style={{ height:"100%", width:`${pct}%`, background:C.accent, borderRadius:1, transition:"width 0.5s" }} />
          </div>
        </div>
      );
    }

    // Intro screen
    if (phase === "intro") {
      return (
        <div className="screen" style={{ padding: '2rem' }}>
          <div style={{ maxWidth:520, margin:"0 auto", padding:"20px 12px" }}>
            <div style={{ textAlign:"center", paddingTop:12 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:`${C.accent}20`, border:`1px solid ${C.accent}40`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:26 }}>◈</div>
              <h1 style={{ fontSize:20, fontWeight:700, color:C.hi, marginBottom:6 }}>Finance Archetype Diagnostic</h1>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.6, marginBottom:20 }}>
                15 questions. Psychometrically scored across 10 traits.
                <br/>Hybrid V1+V2 — 70% advanced diagnostics, 30% legacy questions.
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20, textAlign:"left" }}>
                {[["Crisis triage","Priority under pressure"],["Pattern recognition","Anomaly detection"],["Working memory","Sequence recall"],["Calibration","Probability estimation"],["Risk appetite","Kelly-criterion betting"],["Identity anchoring","Core professional self"]].map(([t,d])=>(
                  <div key={t} style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:6, padding:"10px 12px" }}>
                    <div style={{ fontSize:11, fontWeight:600, color:C.accent, marginBottom:2 }}>{t}</div>
                    <div style={{ fontSize:10, color:C.muted }}>{d}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
                <div style={{ background:`${C.accent}15`, border:`0.5px solid ${C.accent}40`, borderRadius:6, padding:"6px 12px" }}>
                  <span style={{ fontSize:10, color:C.accent }}>~70% V2 Questions</span>
                </div>
                <div style={{ background:"rgba(148,163,184,0.1)", border:`0.5px solid rgba(148,163,184,0.3)`, borderRadius:6, padding:"6px 12px" }}>
                  <span style={{ fontSize:10, color:C.muted }}>~30% V1 Questions</span>
                </div>
              </div>
              <V2Btn onClick={startQuiz} style={{ width:"100%", padding:"12px" }}>Begin diagnostic</V2Btn>
              <V2Btn onClick={onGoHome} secondary style={{ width:"100%", marginTop:8 }}>← Back to Home</V2Btn>
            </div>
          </div>
        </div>
      );
    }

    // Results screen
    if (phase === "results") {
      const winner = FIELDS[result[0].key];
      const runnerUp = FIELDS[result[1].key];
      return (
        <div className="screen" style={{ padding: '2rem' }}>
          <div style={{ maxWidth:520, margin:"0 auto", padding:"20px 12px" }}>
            <div style={{ background:`linear-gradient(135deg, ${winner.color}18 0%, ${winner.color}08 100%)`, border:`1px solid ${winner.color}40`, borderRadius:12, padding:"20px 16px", marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.15em", color:winner.color, marginBottom:4 }}>YOUR FIELD</div>
              <div style={{ fontSize:22, fontWeight:700, color:C.hi, marginBottom:2 }}>{winner.label}</div>
              <div style={{ fontSize:12, color:winner.color, fontWeight:500, marginBottom:10 }}>{winner.arch}</div>
              <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                <div style={{ background:`${winner.color}20`, border:`0.5px solid ${winner.color}50`, borderRadius:6, padding:"6px 12px" }}>
                  <div style={{ fontSize:9, color:winner.color }}>MATCH</div>
                  <div style={{ fontSize:16, fontWeight:700, color:winner.color }}>{result[0].pct}%</div>
                </div>
                <div style={{ background:"rgba(255,255,255,0.04)", border:`0.5px solid ${C.border}`, borderRadius:6, padding:"6px 12px" }}>
                  <div style={{ fontSize:9, color:C.muted }}>RUNNER-UP</div>
                  <div style={{ fontSize:14, fontWeight:600, color:C.dim }}>{runnerUp.label}</div>
                </div>
              </div>
            </div>

            <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:9, color:C.muted, letterSpacing:"0.1em", marginBottom:10, fontWeight:600 }}>TRAIT PROFILE</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px" }}>
                {["Speed","Precision","Risk","Social","Technical","Narrative","Stability","Endurance","Calibration","WorkingMemory"].map(t=> (
                  <div key={t}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ fontSize:10, color:C.dim }}>{t}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:C.text, fontFamily:"monospace" }}>{traits[t]}</span>
                    </div>
                    <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:1 }}>
                      <div style={{ height:"100%", width:`${traits[t]}%`, background:traits[t]>70?C.green:traits[t]>40?C.accent:C.muted, borderRadius:1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize:9, color:C.muted, letterSpacing:"0.1em", marginBottom:8, fontWeight:600 }}>FULL RANKING</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:16 }}>
              {result.map((sc,i)=>{
                const f=FIELDS[sc.key], isBest=i===0;
                return (
                  <div key={sc.key} style={{
                    display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                    background:isBest?`${f.color}10`:C.card, border:`0.5px solid ${isBest?f.color+"35":C.border}`, borderRadius:6,
                  }}>
                    <span style={{ fontSize:10, color:C.muted, minWidth:12 }}>{i+1}</span>
                    <span style={{ fontSize:11, color:C.text, flex:1 }}>{f.label}</span>
                    <span style={{ fontSize:9, color:isBest?f.color:C.muted }}>{f.arch}</span>
                    <span style={{ fontSize:10, color:isBest?f.color:C.muted, fontFamily:"monospace" }}>{sc.pct}%</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <V2Btn onClick={()=>onGoToTree()} style={{ flex:1 }}>Explore in TreeMap</V2Btn>
              <V2Btn onClick={restart} secondary style={{ flex:1 }}>Retake</V2Btn>
            </div>
            <V2Btn onClick={onGoHome} secondary style={{ width:"100%" }}>← Back to Home</V2Btn>
          </div>
        </div>
      );
    }

    // Quiz screen
    if (!questionSet) return null;
    const CurrentQ = questionSet.questions[step];
    return (
      <div className="screen" style={{ padding: '2rem' }}>
        <div style={{ maxWidth:520, margin:"0 auto", padding:"20px 12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <V2Btn onClick={onGoHome} secondary style={{ fontSize:11, padding:"6px 12px" }}>← Home</V2Btn>
            <span style={{ fontSize:10, color:C.muted }}>{questionSet.labels[step]}</span>
          </div>
          <ProgressBar />
          <CurrentQ onAnswer={handleAnswer} />
        </div>
      </div>
    );
  }

  // Expose globally
  window.ArchetypeDiagnosticScreen = ArchetypeDiagnosticMergedScreen;
  console.log('[ArchetypeDiagnosticMerged] Hybrid V1+V2 screen loaded. 70% V2 / 30% V1 mix with conflict prevention.');
})();
