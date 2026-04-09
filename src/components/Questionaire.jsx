import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const FIELDS = {
  QuantFin: { label: "Quant Finance", archetype: "The Architect", icon: "", traits: { Speed: 70, Precision: 95, Risk: 60, Social: 20, Technical: 95, Narrative: 30, Stability: 55, Endurance: 75 }, color: "#534AB7", light: "#EEEDFE", text: "#26215C", desc: "You thrive in mathematical abstraction. Markets are equations, not stories." },
  IB:       { label: "Investment Banking", archetype: "The Gladiator", icon: "", traits: { Speed: 80, Precision: 65, Risk: 70, Social: 90, Technical: 40, Narrative: 75, Stability: 30, Endurance: 95 }, color: "#993C1D", light: "#FAECE7", text: "#4A1B0C", desc: "You live for the deal. Pressure is fuel. Sleep is optional." },
  VC:       { label: "Venture Capital", archetype: "The Visionary", icon: "", traits: { Speed: 65, Precision: 40, Risk: 80, Social: 75, Technical: 50, Narrative: 90, Stability: 25, Endurance: 60 }, color: "#1D9E75", light: "#E1F5EE", text: "#04342C", desc: "You bet on people and ideas before numbers. The future is your asset class." },
  RiskM:    { label: "Risk Management", archetype: "The Sentry", icon: "", traits: { Speed: 45, Precision: 90, Risk: 20, Social: 40, Technical: 80, Narrative: 40, Stability: 95, Endurance: 65 }, color: "#185FA5", light: "#E6F1FB", text: "#042C53", desc: "You are the last line of defence. You find the tail risk everyone else ignores." },
  HedgeFund: { label: "Hedge Funds", archetype: "The Gambler", icon: "", traits: { Speed: 95, Precision: 70, Risk: 95, Social: 50, Technical: 75, Narrative: 55, Stability: 20, Endurance: 80 }, color: "#D85A30", light: "#FAECE7", text: "#4A1B0C", desc: "You eat volatility for breakfast. Conviction and speed are your edge." },
  FPA:      { label: "FP&A", archetype: "The Navigator", icon: "", traits: { Speed: 40, Precision: 85, Risk: 30, Social: 55, Technical: 80, Narrative: 50, Stability: 85, Endurance: 60 }, color: "#854F0B", light: "#FAEEDA", text: "#412402", desc: "You map the company's future with rigour. The model is always open." },
  AssetMgmt: { label: "Asset Management", archetype: "The Guardian", icon: "", traits: { Speed: 50, Precision: 70, Risk: 45, Social: 80, Technical: 60, Narrative: 65, Stability: 80, Endurance: 55 }, color: "#3B6D11", light: "#EAF3DE", text: "#173404", desc: "You grow and protect wealth across decades. Trust is the product." },
  PublicFin: { label: "Public Finance", archetype: "The Diplomat", icon: "", traits: { Speed: 35, Precision: 60, Risk: 20, Social: 70, Technical: 45, Narrative: 85, Stability: 90, Endurance: 50 }, color: "#5F5E5A", light: "#F1EFE8", text: "#2C2C2A", desc: "You finance infrastructure and policy. Your portfolio is civilisation." },
  PE:       { label: "Private Equity", archetype: "The Surgeon", icon: "", traits: { Speed: 60, Precision: 80, Risk: 75, Social: 65, Technical: 65, Narrative: 85, Stability: 40, Endurance: 95 }, color: "#993556", light: "#FBEAF0", text: "#4B1528", desc: "You buy broken things and fix them. Precision surgery on balance sheets." },
};

const WEIGHTS = {
  QuantFin:  { Speed:0.6, Precision:1.0, Risk:0.5, Social:0.3, Technical:1.0, Narrative:0.3, Stability:0.5, Endurance:0.6 },
  IB:        { Speed:0.7, Precision:0.5, Risk:0.6, Social:1.0, Technical:0.3, Narrative:0.7, Stability:0.3, Endurance:1.0 },
  VC:        { Speed:0.5, Precision:0.3, Risk:0.8, Social:0.7, Technical:0.4, Narrative:1.0, Stability:0.2, Endurance:0.5 },
  RiskM:     { Speed:0.4, Precision:1.0, Risk:0.3, Social:0.4, Technical:0.8, Narrative:0.3, Stability:1.0, Endurance:0.6 },
  HedgeFund: { Speed:1.0, Precision:0.6, Risk:1.0, Social:0.4, Technical:0.7, Narrative:0.5, Stability:0.2, Endurance:0.7 },
  FPA:       { Speed:0.3, Precision:0.9, Risk:0.3, Social:0.5, Technical:0.9, Narrative:0.4, Stability:0.9, Endurance:0.5 },
  AssetMgmt: { Speed:0.4, Precision:0.6, Risk:0.4, Social:0.9, Technical:0.5, Narrative:0.6, Stability:0.9, Endurance:0.4 },
  PublicFin: { Speed:0.3, Precision:0.5, Risk:0.2, Social:0.7, Technical:0.4, Narrative:1.0, Stability:1.0, Endurance:0.4 },
  PE:        { Speed:0.5, Precision:0.8, Risk:0.7, Social:0.6, Technical:0.6, Narrative:0.9, Stability:0.4, Endurance:1.0 },
};

function computeResult(userTraits) {
  const scores = Object.entries(FIELDS).map(([key, field]) => {
    const w = WEIGHTS[key];
    const dist = Math.sqrt(
      Object.keys(userTraits).reduce((acc, t) => acc + w[t] * Math.pow(userTraits[t] - field.traits[t], 2), 0)
    );
    return { key, dist };
  });
  scores.sort((a, b) => a.dist - b.dist);
  return scores;
}

const TOTAL = 7;

// ── Q1 Chaos Threshold Slider ────────────────────────────────────────────
function Q1({ onAnswer }) {
  const [val, setVal] = useState(50);
  return (
    <div>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
        Imagine you are in a cockpit. Alarms blare. Two engines are out.
      </p>
      <p style={{ fontWeight: 500, marginBottom: 24 }}>
        How long do you wait before pulling the emergency lever?
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#64748b", width: 130, flexShrink: 0 }}>Need full diagnostic first</span>
        <input type="range" min="0" max="100" step="1" value={val} onChange={e => setVal(+e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "#64748b", width: 130, flexShrink: 0, textAlign: "right" }}>Pull it — trust the gut</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <span style={{ background: "rgba(148, 163, 184, 0.2)", borderRadius: 8, padding: "4px 14px", fontSize: 13, fontWeight: 500 }}>{val}</span>
      </div>
      <button onClick={() => onAnswer(val)} style={{ width: "100%" }}>Continue</button>
    </div>
  );
}

// ── Q2 Persistence Grid ──────────────────────────────────────────────────
function Q2({ onAnswer }) {
  const ODD = Math.floor(Math.random() * 25);
  const [found, setFound] = useState(false);
  const [clicked, setClicked] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => {
      if (e >= 29) { clearInterval(timerRef.current); setDone(true); return 30; }
      return e + 1;
    }), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  function handleClick(i) {
    if (done || found) return;
    setClicked(i);
    if (i === ODD) { setFound(true); clearInterval(timerRef.current); }
  }

  function submit(foundIt) {
    const precision = foundIt ? 100 : Math.max(0, 100 - elapsed * 3);
    onAnswer(precision);
  }

  const timeLeft = 30 - elapsed;
  const pct = timeLeft / 30;

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>Find the odd one out — you have 30 seconds</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
        If time runs out, do you feel compelled to keep looking?
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 4, background: "rgba(148, 163, 184, 0.2)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: pct > 0.4 ? "#1D9E75" : pct > 0.2 ? "#BA7517" : "#E24B4A", transition: "width 1s linear, background 0.3s" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, minWidth: 28, color: pct > 0.4 ? "#f7f9ff" : "#A32D2D" }}>{timeLeft}s</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
        {Array.from({ length: 25 }, (_, i) => (
          <div key={i} onClick={() => handleClick(i)} style={{
            aspectRatio: "1", borderRadius: 8, border: "0.5px solid rgba(148, 163, 184, 0.2)",
            background: clicked === i ? (i === ODD ? "#E1F5EE" : "#FCEBEB") : "rgba(148, 163, 184, 0.1)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            transition: "background 0.15s",
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              {i === ODD
                ? <polygon points="9,2 16,14 2,14" fill="none" stroke="#64748b" strokeWidth="1.5" />
                : <rect x="3" y="3" width="12" height="12" rx="2" fill="none" stroke="#64748b" strokeWidth="1.5" />}
            </svg>
          </div>
        ))}
      </div>
      {found && <p style={{ color: "#0F6E56", fontWeight: 500, marginBottom: 12, fontSize: 14 }}>Found it in {elapsed}s</p>}
      {(found || done) && (
        <div style={{ display: "flex", gap: 8 }}>
          {found && <button onClick={() => submit(true)} style={{ flex: 1 }}>Continue</button>}
          {done && !found && <button onClick={() => submit(false)} style={{ flex: 1 }}>Move on</button>}
          {done && !found && <button onClick={() => submit(true)} style={{ flex: 1, background: "rgba(148, 163, 184, 0.1)" }}>Stay until I find it</button>}
        </div>
      )}
      {!found && !done && <div style={{ height: 40 }} />}
    </div>
  );
}

// ── Q3 Ethical Ranker ────────────────────────────────────────────────────
const SCENARIOS = [
  { id: "hours",   label: "100-hour weeks for 2 years", trait: "Endurance" },
  { id: "layoffs", label: "Decision causing 500 layoffs", trait: "Narrative" },
  { id: "loss",    label: "Losing $1M of client money in one day", trait: "Risk" },
  { id: "alone",   label: "8 hours a day alone at a terminal", trait: "Social" },
];

function Q3({ onAnswer }) {
  const [order, setOrder] = useState(SCENARIOS.map(s => s.id));
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  function handleDragStart(id) { setDragging(id); }
  function handleDragOver(e, id) { e.preventDefault(); setDragOver(id); }
  function handleDrop(id) {
    if (!dragging || dragging === id) return;
    const next = [...order];
    const from = next.indexOf(dragging), to = next.indexOf(id);
    next.splice(from, 1); next.splice(to, 0, dragging);
    setOrder(next); setDragging(null); setDragOver(null);
  }

  function submit() {
    const traits = {};
    order.forEach((id, rank) => {
      const s = SCENARIOS.find(x => x.id === id);
      traits[s.trait] = Math.round(100 - rank * 22);
    });
    onAnswer(traits);
  }

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>Rank from most tolerable (top) to least tolerable</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Drag to reorder these professional "necessary evils"</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {order.map((id, rank) => {
          const s = SCENARIOS.find(x => x.id === id);
          return (
            <div key={id} draggable onDragStart={() => handleDragStart(id)} onDragOver={e => handleDragOver(e, id)} onDrop={() => handleDrop(id)} onDragEnd={() => { setDragging(null); setDragOver(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: dragOver === id ? "rgba(148, 163, 184, 0.2)" : "rgba(148, 163, 184, 0.1)",
                border: `0.5px solid ${dragging === id ? "#185FA5" : "rgba(148, 163, 184, 0.2)"}`,
                borderRadius: 10, cursor: "grab", opacity: dragging === id ? 0.5 : 1, transition: "background 0.15s",
              }}>
              <span style={{ fontSize: 12, color: "#64748b", minWidth: 16, textAlign: "center" }}>{rank + 1}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0, opacity: 0.4 }}>
                <rect y="2" width="14" height="1.5" rx="1" fill="#64748b" />
                <rect y="6" width="14" height="1.5" rx="1" fill="#64748b" />
                <rect y="10" width="14" height="1.5" rx="1" fill="#64748b" />
              </svg>
              <span style={{ fontSize: 14 }}>{s.label}</span>
            </div>
          );
        })}
      </div>
      <button onClick={submit} style={{ width: "100%" }}>Continue</button>
    </div>
  );
}

// ── Q4 Narrative Builder ─────────────────────────────────────────────────
const CHIPS = {
  Action:  [{ v: "Analyzing", t: "Technical" }, { v: "Negotiating", t: "Social" }, { v: "Hedging", t: "Risk" }, { v: "Governing", t: "Stability" }],
  Subject: [{ v: "a Startup", t: "Narrative" }, { v: "a Corporation", t: "Endurance" }, { v: "a Math Model", t: "Technical" }, { v: "Public Infrastructure", t: "Stability" }],
  Outcome: [{ v: "changes the world", t: "Narrative" }, { v: "beats the market", t: "Risk" }, { v: "ensures stability", t: "Stability" }, { v: "closes the deal", t: "Social" }],
};

function Q4({ onAnswer }) {
  const [sel, setSel] = useState({ Action: null, Subject: null, Outcome: null });

  function pick(cat, chip) { setSel(s => ({ ...s, [cat]: chip })); }
  const ready = sel.Action && sel.Subject && sel.Outcome;

  function submit() {
    const traits = { Technical: 50, Social: 50, Risk: 50, Stability: 50, Narrative: 50, Endurance: 50, Speed: 50, Precision: 50 };
    [sel.Action, sel.Subject, sel.Outcome].forEach(c => { if (c && traits[c.t] !== undefined) traits[c.t] = Math.min(100, traits[c.t] + 25); });
    onAnswer(traits);
  }

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>Complete the sentence that resonates most</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Select one chip from each row</p>
      <div style={{
        background: "rgba(148, 163, 184, 0.2)", borderRadius: 12, padding: "16px 18px", marginBottom: 24,
        fontSize: 15, lineHeight: 2.2, fontStyle: "italic", color: "#f7f9ff"
      }}>
        {"I find the most satisfaction when I am "}
        <Slot val={sel.Action?.v} />{" "}
        <Slot val={sel.Subject?.v} />{" that "}
        <Slot val={sel.Outcome?.v} />{"."}
      </div>
      {Object.entries(CHIPS).map(([cat, chips]) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 500, letterSpacing: "0.05em" }}>{cat.toUpperCase()}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {chips.map(c => (
              <button key={c.v} onClick={() => pick(cat, c)} style={{
                padding: "6px 14px", fontSize: 13, borderRadius: 20,
                background: sel[cat]?.v === c.v ? "#3b82f6" : "rgba(148, 163, 184, 0.1)",
                border: `0.5px solid ${sel[cat]?.v === c.v ? "#3b82f6" : "rgba(148, 163, 184, 0.2)"}`,
                color: sel[cat]?.v === c.v ? "#f7f9ff" : "#64748b",
                fontWeight: sel[cat]?.v === c.v ? 500 : 400,
              }}>{c.v}</button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: 20 }}>
        <button onClick={submit} disabled={!ready} style={{ width: "100%", opacity: ready ? 1 : 0.4 }}>Continue</button>
      </div>
    </div>
  );
}

function Slot({ val }) {
  return (
    <span style={{
      display: "inline-block", minWidth: 80, borderBottom: "1.5px solid rgba(148, 163, 184, 0.2)",
      padding: "0 6px", color: val ? "#3b82f6" : "#64748b",
      fontStyle: "normal", fontWeight: val ? 500 : 400,
    }}>{val || "___"}</span>
  );
}

// ── Q5 Information Diet ──────────────────────────────────────────────────
const HEADLINES = [
  { id: "A", text: "The math behind a perfect poker hand", traits: { Technical: 20, Risk: 15 } },
  { id: "B", text: "Founder of $X Startup gets ousted in board coup", traits: { Narrative: 20, Social: 15 } },
  { id: "C", text: "New municipal bond for a bridge in Ohio", traits: { Stability: 20, Narrative: 10 } },
  { id: "D", text: "How the Fed's latest move affects milk prices", traits: { Stability: 15, Technical: 10, Endurance: 5 } },
  { id: "E", text: "Inside the $50B merger of two oil giants", traits: { Social: 15, Risk: 10, Endurance: 10 } },
];

function Q5({ onAnswer }) {
  const [sel, setSel] = useState([]);

  function toggle(id) {
    setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 3 ? [...s, id] : s);
  }

  function submit() {
    const traits = { Technical: 50, Social: 50, Risk: 50, Stability: 50, Narrative: 50, Endurance: 50, Speed: 50, Precision: 50 };
    sel.forEach(id => {
      const h = HEADLINES.find(x => x.id === id);
      Object.entries(h.traits).forEach(([t, v]) => { if (traits[t] !== undefined) traits[t] = Math.min(100, traits[t] + v); });
    });
    onAnswer(traits);
  }

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>You have 10 minutes to read. Pick up to 3 headlines.</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Selected: {sel.length}/3
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {HEADLINES.map(h => {
          const active = sel.includes(h.id);
          return (
            <div key={h.id} onClick={() => toggle(h.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
              border: `0.5px solid ${active ? "#3b82f6" : "rgba(148, 163, 184, 0.2)"}`,
              background: active ? "#3b82f6" : "rgba(148, 163, 184, 0.1)",
              borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${active ? "#185FA5" : "rgba(148, 163, 184, 0.2)"}`,
                background: active ? "#185FA5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {active && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#f7f9ff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <span style={{ fontSize: 13, color: active ? "#f7f9ff" : "#64748b", fontWeight: active ? 500 : 400 }}>
                <b style={{ fontWeight: 500, color: "#64748b" }}>{h.id}. </b>{h.text}
              </span>
            </div>
          );
        })}
      </div>
      <button onClick={submit} disabled={sel.length === 0} style={{ width: "100%", opacity: sel.length ? 1 : 0.4 }}>Continue</button>
    </div>
  );
}

// ── Q6 Social Battery Clock ──────────────────────────────────────────────
function Q6({ onAnswer }) {
  const [social, setSocial] = useState(4);

  function submit() {
    const s = social;
    const socialScore = Math.round((s / 16) * 100);
    onAnswer({ Social: socialScore, Stability: Math.round(100 - socialScore * 0.4), Endurance: 60 });
  }

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>How many hours per day do you want to spend "performing"?</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        Performing = talking, selling, presenting, relationship-building
      </p>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <input type="range" min="0" max="16" step="1" value={social} onChange={e => setSocial(+e.target.value)} style={{ flex: 1 }} />
        <span style={{ fontWeight: 500, fontSize: 20, minWidth: 32 }}>{social}h</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[
          { label: "Analyst", range: "0–2h", active: social <= 2 },
          { label: "Hybrid", range: "3–7h", active: social >= 3 && social <= 7 },
          { label: "Front office", range: "8h+", active: social >= 8 },
        ].map(t => (
          <div key={t.label} style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, textAlign: "center",
            background: t.active ? "#3b82f6" : "rgba(148, 163, 184, 0.1)",
            border: `0.5px solid ${t.active ? "#3b82f6" : "rgba(148, 163, 184, 0.2)"}`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: t.active ? "#f7f9ff" : "#64748b" }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{t.range}</div>
          </div>
        ))}
      </div>
      <button onClick={submit} style={{ width: "100%" }}>Continue</button>
    </div>
  );
}

// ── Q7 Loss Aversion Toss ────────────────────────────────────────────────
function Q7({ onAnswer }) {
  const [flips, setFlips] = useState(0);
  const [losses, setLosses] = useState(0);
  const [wallet, setWallet] = useState(1000);
  const [flipping, setFlipping] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [stopped, setStopped] = useState(false);

  function flip() {
    if (flipping || stopped) return;
    setFlipping(true);
    setLastResult(null);
    setTimeout(() => {
      const win = Math.random() < 0.51;
      const next = win ? Math.round(wallet * 2.1) : 0;
      setLastResult(win ? "win" : "loss");
      setWallet(next);
      setFlips(f => f + 1);
      if (!win) { setLosses(l => l + 1); setStopped(true); }
      setFlipping(false);
    }, 600);
  }

  function stop() { setStopped(true); }

  function submit() {
    const riskScore = Math.min(100, flips * 14 + (stopped && lastResult !== "loss" ? 0 : -5));
    const speedScore = Math.min(100, flips * 10);
    onAnswer({ Risk: riskScore, Speed: speedScore, Endurance: Math.min(100, flips * 12) });
  }

  const bust = lastResult === "loss";

  return (
    <div>
      <p style={{ fontWeight: 500, marginBottom: 4 }}>You have $1,000. Flip for a 51% chance at 2.1×.</p>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>
        If you lose, you lose it all. How many times do you play?
      </p>
      <div style={{ background: "rgba(148, 163, 184, 0.2)", borderRadius: 14, padding: "24px 20px", marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Wallet</div>
        <div style={{ fontSize: 32, fontWeight: 500, color: bust ? "#A32D2D" : "#f7f9ff", marginBottom: 16 }}>
          {bust ? "BUST" : `$${wallet.toLocaleString()}`}
        </div>
        {lastResult && !flipping && (
          <div style={{ fontSize: 13, fontWeight: 500, color: lastResult === "win" ? "#0F6E56" : "#A32D2D", marginBottom: 12 }}>
            {lastResult === "win" ? "+ Won!" : "- Lost everything"}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 13, color: "#64748b", marginBottom: 20 }}>
          <span>Flips: <b style={{ fontWeight: 500, color: "#f7f9ff" }}>{flips}</b></span>
          <span>Losses: <b style={{ fontWeight: 500, color: losses > 0 ? "#A32D2D" : "#f7f9ff" }}>{losses}</b></span>
        </div>
        {!stopped ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={flip} disabled={flipping} style={{ minWidth: 120 }}>
              {flipping ? "Flipping..." : "Flip the coin"}
            </button>
            <button onClick={stop} style={{ minWidth: 100, background: "rgba(148, 163, 184, 0.1)" }}>Walk away</button>
          </div>
        ) : (
          <button onClick={submit} style={{ minWidth: 140 }}>See my results</button>
        )}
      </div>
      {flips === 0 && !stopped && (
        <button onClick={stop} style={{ width: "100%", background: "transparent" }}>I would never play — skip</button>
      )}
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────
function Results({ scores, navigate }) {
  const top3 = scores.slice(0, 3);
  const winner = FIELDS[top3[0].key];
  const maxDist = Math.max(...scores.map(s => s.dist));

  const handleNavigateToTree = () => {
    const enrichedResult = scores.map(r => ({
      ...r,
      fieldData: FIELDS[r.key]
    }));
    navigate('/tree', {
      state: {
        archetypeResult: {
          topField: enrichedResult[0],
          allScores: enrichedResult,
          completedAt: new Date().toISOString()
        },
        highlightField: top3[0].key
      }
    });
  };

  return (
    <div>
      <div style={{
        background: `${winner.color}20`, border: `0.5px solid ${winner.color}50`,
        borderRadius: 16, padding: "28px 24px", marginBottom: 20, textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8, color: winner.color }}>{winner.icon}</div>
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: winner.color, marginBottom: 4 }}>YOUR DESTINY FIELD</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "#f7f9ff", marginBottom: 4 }}>{winner.label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: winner.color, marginBottom: 12 }}>{winner.archetype}</div>
        <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>{winner.desc}</p>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginBottom: 10, letterSpacing: "0.05em" }}>YOUR FULL RANKING</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {scores.map((s, i) => {
          const f = FIELDS[s.key];
          const fit = Math.round((1 - s.dist / maxDist) * 100);
          return (
            <div key={s.key} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
              background: i === 0 ? `${f.color}15` : "rgba(148, 163, 184, 0.1)",
              border: `0.5px solid ${i === 0 ? f.color + "40" : "rgba(148, 163, 184, 0.2)"}`,
              borderRadius: 10,
            }}>
              <span style={{ fontSize: 12, color: "#64748b", minWidth: 16, textAlign: "center" }}>{i + 1}</span>
              <span style={{ fontSize: 16, color: f.color }}>{f.icon}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: i === 0 ? 500 : 400, color: i === 0 ? "#f7f9ff" : "#94a3b8" }}>{f.label}</span>
              <div style={{ width: 80, height: 4, background: "rgba(15, 23, 42, 0.5)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${fit}%`, background: i === 0 ? f.color : "rgba(148, 163, 184, 0.3)", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: "#64748b", minWidth: 32, textAlign: "right" }}>{fit}%</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
        <button 
          onClick={handleNavigateToTree} 
          style={{ 
            width: "100%", 
            padding: "12px 24px", 
            background: "#3b82f6", 
            color: "#fff", 
            border: "none", 
            borderRadius: 12,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Explore in TreeMap →
        </button>
        <button 
          onClick={() => window.open(`https://chat.openai.com/?q=${encodeURIComponent(`I got "${winner.label} — ${winner.archetype}" on the Finance Archetype Diagnostic. Can you tell me more about what a career in ${winner.label} actually looks like day-to-day, and what I should do to break into it?`)}`, '_blank')}
          style={{ 
            width: "100%", 
            padding: "12px 24px", 
            background: "transparent", 
            color: "#94a3b8", 
            border: "1px solid rgba(148, 163, 184, 0.3)", 
            borderRadius: 12,
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          Tell me how to break into {winner.label} ↗
        </button>
      </div>
    </div>
  );
}

// ── Orchestrator ──────────────────────────────────────────────────────────
const QUESTIONS = [
  { id: "q1", title: "The chaos threshold", subtitle: "Decision speed under pressure", Component: Q1 },
  { id: "q2", title: "The persistence grid", subtitle: "Detail obsession vs big picture", Component: Q2 },
  { id: "q3", title: "The ethical grey-scale", subtitle: "Professional resilience map", Component: Q3 },
  { id: "q4", title: "The narrative builder", subtitle: "Intrinsic motivation", Component: Q4 },
  { id: "q5", title: "The information diet", subtitle: "Interest domain fingerprint", Component: Q5 },
  { id: "q6", title: "The social battery", subtitle: "Performer vs deep worker", Component: Q6 },
  { id: "q7", title: "The loss aversion toss", subtitle: "Risk tolerance stress test", Component: Q7 },
];

const TRAIT_DEFAULTS = { Speed: 50, Precision: 50, Risk: 50, Social: 50, Technical: 50, Narrative: 50, Stability: 50, Endurance: 50 };

export default function FinanceArchetypeDiagnostic({ onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [traits, setTraits] = useState({ ...TRAIT_DEFAULTS });
  const [result, setResult] = useState(null);

  function handleAnswer(data) {
    let update = {};
    if (typeof data === "number") {
      const q = QUESTIONS[step];
      if (q.id === "q1") { update = { Speed: data, Precision: 100 - data }; }
      else if (q.id === "q2") { update = { Precision: data, Technical: data * 0.8 }; }
    } else {
      update = data;
    }
    const next = { ...traits };
    Object.entries(update).forEach(([k, v]) => { if (next[k] !== undefined) next[k] = Math.round((next[k] + v) / 2); });
    setTraits(next);
    if (step < QUESTIONS.length - 1) { setStep(s => s + 1); }
    else { 
      const finalResult = computeResult(next);
      setResult(finalResult);
      if (onComplete) {
        const enrichedResult = finalResult.map(r => ({
          ...r,
          fieldData: FIELDS[r.key]
        }));
        onComplete(enrichedResult);
      }
    }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", background: "#0f172a", minHeight: "100vh" }}>
        <Results scores={result} navigate={navigate} />
      </div>
    );
  }

  const q = QUESTIONS[step];
  const { Component } = q;
  const pct = Math.round((step / TOTAL) * 100);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px", background: "#0f172a", minHeight: "100vh", color: "#f7f9ff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: "#64748b" }}>
          {step + 1} / {TOTAL}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{pct}% complete</span>
      </div>
      <div style={{ height: 3, background: "rgba(148, 163, 184, 0.2)", borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "#3b82f6", borderRadius: 2, transition: "width 0.4s ease" }} />
      </div>

      <div style={{ marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", color: "#64748b", marginBottom: 2 }}>
          {q.subtitle.toUpperCase()}
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 20px", color: "#f7f9ff" }}>{q.title}</h2>
      </div>

      <Component onAnswer={handleAnswer} />
    </div>
  );
}