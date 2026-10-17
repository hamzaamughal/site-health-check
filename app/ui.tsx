"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- Background: drifting blobs + floating check-up crosses ---------- */

const CROSSES = [
  { l: "6%", t: "18%", s: 18, d: 0 },
  { l: "88%", t: "12%", s: 24, d: -4 },
  { l: "78%", t: "46%", s: 14, d: -9 },
  { l: "12%", t: "62%", s: 22, d: -2 },
  { l: "50%", t: "84%", s: 16, d: -6 },
  { l: "94%", t: "78%", s: 20, d: -11 },
  { l: "30%", t: "8%", s: 12, d: -7 },
];

export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="grid" />
      {CROSSES.map((c, i) => (
        <svg
          key={i}
          className="cross"
          style={{ left: c.l, top: c.t, width: c.s, height: c.s, animationDelay: `${c.d}s` }}
          viewBox="0 0 24 24"
        >
          <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
        </svg>
      ))}
    </div>
  );
}

/* ---------- Heartbeat line (the signature motif) ---------- */

const BEAT = "h40 l6 -8 l6 8 h10 l5 -36 l7 62 l6 -34 l5 8 h44";
function ecgPath(beats: number) {
  return `M0 40 ${Array.from({ length: beats }, () => BEAT).join(" ")}`;
}

export function Ecg({ beats = 6, className = "" }: { beats?: number; className?: string }) {
  const width = beats * 129;
  return (
    <svg className={`ecg ${className}`} viewBox={`0 0 ${width} 80`} preserveAspectRatio="none" aria-hidden="true">
      <path className="ecg-base" d={ecgPath(beats)} />
      <path className="ecg-live" d={ecgPath(beats)} pathLength={1000} />
    </svg>
  );
}

/* ---------- The patient: a little browser window having a check-up ---------- */

export function Patient({ mood }: { mood: "nervous" | "ok" | "sleepy" }) {
  return (
    <svg className={`patient ${mood}`} viewBox="0 0 220 170" aria-hidden="true">
      <g className="patient-body">
        <rect x="20" y="20" width="180" height="128" rx="18" className="p-frame" />
        <path d="M20 38a18 18 0 0 1 18-18h144a18 18 0 0 1 18 18v10H20z" className="p-bar" />
        <circle cx="38" cy="34" r="4" className="p-dot r" />
        <circle cx="52" cy="34" r="4" className="p-dot y" />
        <circle cx="66" cy="34" r="4" className="p-dot g" />
        <g className="p-eyes">
          <ellipse cx="86" cy="88" rx="8" ry="10" className="p-eye" />
          <ellipse cx="134" cy="88" rx="8" ry="10" className="p-eye" />
          <circle cx="88" cy="85" r="3" className="p-shine" />
          <circle cx="136" cy="85" r="3" className="p-shine" />
        </g>
        <ellipse cx="70" cy="108" rx="9" ry="5" className="p-cheek" />
        <ellipse cx="150" cy="108" rx="9" ry="5" className="p-cheek" />
        <path d="M100 116 q10 8 20 0" className="p-mouth" />
        {/* thermometer */}
        <g className="p-thermo">
          <rect x="114" y="112" width="58" height="7" rx="3.5" className="p-thermo-glass" />
          <circle cx="172" cy="115.5" r="6" className="p-thermo-bulb" />
          <rect x="140" y="114" width="30" height="3" rx="1.5" className="p-thermo-mercury" />
        </g>
        {/* sweat drop */}
        <path d="M176 64 q6 9 0 14 q-6 -5 0 -14z" className="p-sweat" />
      </g>
      <ellipse cx="110" cy="162" rx="70" ry="6" className="p-shadow" />
    </svg>
  );
}

/* ---------- Loader ---------- */

const STEPS = [
  { at: 0, label: "Opening your website" },
  { at: 12, label: "Checking mobile layout and security" },
  { at: 28, label: "Testing buttons and links" },
  { at: 42, label: "Running Google's speed test on a slow phone" },
  { at: 88, label: "Writing up your report" },
];

const QUIPS = [
  "Putting on the stethoscope…",
  "Poking every button to see if it squeaks…",
  "Counting your pixels. There are a lot.",
  "Asking Google nicely to hurry up…",
  "Checking under the footer for dust…",
  "Reading your meta tags with tiny glasses…",
  "Pretending to be a customer on a slow phone…",
  "Making sure the contact form isn't decorative…",
  "Taking your homepage's temperature…",
  "Asking your images to lose a little weight…",
  "Still faster than most websites we test.",
  "Saying 'ahh'. Your site said 'ahh' back.",
];

const SLOW_QUIPS = [
  "Google's speed test is taking its time today. Nearly there.",
  "This one's a thorough check-up. Hang tight.",
];

export function Loader({ site }: { site: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [quip, setQuip] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    start.current = Date.now();
    setQuip(Math.floor(Math.random() * QUIPS.length));
    const t = setInterval(() => setElapsed((Date.now() - start.current) / 1000), 200);
    const q = setInterval(() => setQuip((i) => i + 1), 3400);
    return () => {
      clearInterval(t);
      clearInterval(q);
    };
  }, []);

  // Eases toward 96% — real timing varies, so never pretend to be done.
  const progress = Math.min(96, 96 * (1 - Math.exp(-elapsed / 17)));
  const current = STEPS.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0);
  const slow = elapsed > 48;
  const text = slow ? SLOW_QUIPS[quip % SLOW_QUIPS.length] : QUIPS[quip % QUIPS.length];
  const mood = elapsed < 10 ? "nervous" : slow ? "sleepy" : "ok";

  return (
    <section className="exam" aria-live="polite" aria-busy="true">
      <div className="exam-stage">
        <Patient mood={mood} />
        <Ecg beats={4} className="exam-ecg" />
      </div>
      <div className="exam-info">
        <p className="exam-site">Checking up on <strong>{site}</strong></p>
        <p className="quip" key={text}>{text}</p>
        <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="bar-meta">
          <span>{Math.round(progress)}%</span>
          <span>Usually 30–60 seconds</span>
        </div>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.label} className={i < current ? "done" : i === current ? "now" : ""}>
              <span className="step-mark" aria-hidden="true">{i < current ? "✓" : i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- Score dial with count-up ---------- */

export function useCountUp(target: number | null, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return target === null ? null : v;
}

export function tone(v: number | null) {
  if (v === null) return "none";
  return v >= 90 ? "good" : v >= 50 ? "avg" : "bad";
}

export function Dial({ value, size = "lg", label }: { value: number | null; size?: "lg" | "sm"; label?: string }) {
  const shown = useCountUp(value, size === "lg" ? 1600 : 1200);
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = shown === null ? 0 : shown / 100;
  return (
    <div className={`dial ${size} ${tone(value)}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="dial-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="dial-arc"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="dial-num" aria-label={value === null ? "not available" : `${value} out of 100`}>
        {shown ?? "–"}
      </span>
      {label && <span className="dial-label">{label}</span>}
    </div>
  );
}

/* ---------- Confetti (only after the user unlocks the fix list) ---------- */

const COLORS = ["var(--scrub)", "var(--pulse)", "var(--amber)", "var(--sky)"];

export function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    dur: 1.4 + Math.random() * 1.1,
    rot: Math.random() * 360,
    drift: (Math.random() - 0.5) * 160,
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? "50%" : "2px",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              ["--rot" as string]: `${p.rot}deg`,
              ["--drift" as string]: `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
