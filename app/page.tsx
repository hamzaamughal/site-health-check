"use client";

import { useEffect, useRef, useState } from "react";
import type { Check, Report } from "@/lib/types";
import { Background, Confetti, Dial, Ecg, Loader, tone } from "./ui";

const CTA_URL = process.env.NEXT_PUBLIC_CTA_URL || "https://hamzaabubakar.dev/";
const OWNER = process.env.NEXT_PUBLIC_OWNER_NAME || "Hamza Abubakar";
const PORTFOLIO = process.env.NEXT_PUBLIC_PORTFOLIO_URL || "https://hamzaabubakar.dev/";

const ORDER = { fail: 0, warn: 1, pass: 2 } as const;

function diagnosis(score: number) {
  if (score >= 90) return { title: "Clean bill of health", line: "Your site is in great shape. A few small tweaks at most." };
  if (score >= 70) return { title: "Mostly healthy", line: "Good foundations, but a few issues are quietly costing you enquiries." };
  if (score >= 50) return { title: "Needs a check-up", line: "Visitors are hitting problems that make them leave before contacting you." };
  return { title: "Needs attention soon", line: "Several serious issues are likely turning customers away every day." };
}

function hostOf(u: string) {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function CheckItem({ c, unlocked, index }: { c: Check; unlocked: boolean; index: number }) {
  const [open, setOpen] = useState(false);
  const icon = c.status === "pass" ? "✓" : c.status === "warn" ? "!" : "✕";
  const hasMore = unlocked && c.status !== "pass" && (c.impact || c.fix);
  const locked = !unlocked && c.status !== "pass";
  useEffect(() => {
    if (unlocked && c.status === "fail") setOpen(true);
  }, [unlocked, c.status]);
  return (
    <li className={`check ${c.status}${open ? " open" : ""}`} style={{ animationDelay: `${index * 45}ms` }}>
      <span className="check-icon" aria-hidden="true">{icon}</span>
      <div className="check-body">
        <div className="check-head">
          <span className="check-title">{c.label}</span>
          <span className={`tag ${c.status}`}>{c.status === "pass" ? "Healthy" : c.status === "warn" ? "Improve" : "Fix first"}</span>
        </div>
        <p className={`check-detail${locked ? " locked" : ""}`}>{c.detail}</p>
        {hasMore && (
          <>
            <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide the fix" : "Show why it matters and how to fix it"}
            </button>
            <div className="check-more" hidden={!open}>
              {c.impact && <p><strong>Why it matters.</strong> {c.impact}</p>}
              {c.fix && <p><strong>How to fix it.</strong> {c.fix}</p>}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [sending, setSending] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fixesRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  const loading = checking !== null;

  function scrollToStage() {
    setTimeout(() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  async function analyze(target: string) {
    const clean = target.trim();
    if (!clean || loading) return;
    setChecking(hostOf(clean));
    setError(null);
    setReport(null);
    setUnlocked(false);
    setCelebrate(false);
    scrollToStage();
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The check didn't finish. Try again in a minute.");
      setReport(data as Report);
      scrollToStage();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check didn't finish. Try again in a minute.");
      setTimeout(() => inputRef.current?.focus(), 80);
    } finally {
      setChecking(null);
    }
  }

  // Links like /?url=example.com (used in outreach emails) run the check automatically.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const param = new URLSearchParams(window.location.search).get("url");
    if (param) {
      setUrl(param.replace(/^https?:\/\//i, ""));
      void analyze(param);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    setSending(true);
    setLeadError(null);
    try {
      const issues = report.checks.filter((c) => c.status !== "pass");
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          url: report.finalUrl,
          overall: report.summary.overall,
          critical: report.summary.critical,
          warnings: report.summary.warnings,
          topIssues: issues.map((c) => `${c.label}: ${c.detail}`),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "We couldn't save your email. Check it and try again.");
      setUnlocked(true);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 3000);
      setTimeout(() => fixesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : "We couldn't save your email. Check it and try again.");
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setReport(null);
    setUrl("");
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus(), 400);
  }

  const issues = report ? report.checks.filter((c) => c.status !== "pass") : [];
  const sorted = report ? [...report.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : [];
  const dx = report ? diagnosis(report.summary.overall) : null;

  return (
    <>
      <Background />
      {celebrate && <Confetti />}

      <header className="topbar wrap">
        <a className="brand" href="/" onClick={(e) => { if (report) { e.preventDefault(); reset(); } }}>
          <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="5" width="28" height="22" rx="6" /><path d="M6 18h5l2-5 3 9 2-4h8" /></svg>
          Website Health Check
        </a>
        <a className="topbar-link" href={PORTFOLIO} target="_blank" rel="noopener noreferrer">by {OWNER}</a>
      </header>

      <main>
        <section className={`hero wrap${report || loading ? " compact" : ""}`}>
          <p className="badge"><span className="pulse-dot" aria-hidden="true" />Free, no signup, about 60 seconds</p>
          <h1>Is your website quietly losing you customers?</h1>
          <p className="sub">
            A free check-up for your site: mobile speed, broken buttons and links, missing contact forms, security
            and Google basics. Explained in plain English.
          </p>
          <form
            className={`checker${error ? " has-error" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              void analyze(url);
            }}
          >
            <label className="sr-only" htmlFor="site">Website address</label>
            <span className="checker-prefix" aria-hidden="true">https://</span>
            <input
              id="site"
              ref={inputRef}
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yourbusiness.com"
              value={url}
              onChange={(e) => setUrl(e.target.value.replace(/^https?:\/\//i, ""))}
              required
              disabled={loading}
            />
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? <><span className="btn-spin" aria-hidden="true" />Checking</> : "Check my website"}
            </button>
          </form>
          {error ? (
            <p className="error" role="alert">{error}</p>
          ) : (
            <p className="trust">Uses Google&apos;s own speed test plus 14 real-world checks.</p>
          )}
          <Ecg beats={9} className="hero-ecg" />
        </section>

        <div className="stage wrap" ref={stageRef}>
          {loading && <Loader site={checking!} />}

          {report && dx && (
            <div className="results">
              <section className={`panel vitals ${tone(report.summary.overall)}`}>
                <Dial value={report.summary.overall} />
                <div className="vitals-text">
                  <p className="vitals-for">Health score for <strong>{hostOf(report.finalUrl)}</strong></p>
                  <h2>{dx.title}</h2>
                  <p className="vitals-line">{dx.line}</p>
                  <div className="counts">
                    {report.summary.critical > 0 && <span className="count fail"><b>{report.summary.critical}</b> to fix first</span>}
                    {report.summary.warnings > 0 && <span className="count warn"><b>{report.summary.warnings}</b> to improve</span>}
                    <span className="count pass"><b>{report.summary.passed}</b> healthy</span>
                  </div>
                </div>
              </section>

              <section className="panel">
                <h2>Google speed and quality, on a phone</h2>
                {report.pagespeedError ? (
                  <p className="muted">{report.pagespeedError}</p>
                ) : (
                  <>
                    <div className="dials">
                      <Dial size="sm" value={report.scores.performance} label="Speed" />
                      <Dial size="sm" value={report.scores.seo} label="Google SEO" />
                      <Dial size="sm" value={report.scores.accessibility} label="Accessibility" />
                      <Dial size="sm" value={report.scores.bestPractices} label="Best practices" />
                    </div>
                    <div className="metrics">
                      {report.metrics.map((m) => (
                        <div className={`metric ${m.rating}`} key={m.id}>
                          <span className="metric-v">{m.value}</span>
                          <span className="metric-k">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="panel" ref={fixesRef}>
                <h2>What we found</h2>
                <ul className="checks">
                  {sorted.map((c, i) => (
                    <CheckItem key={c.id} c={c} unlocked={unlocked} index={i} />
                  ))}
                </ul>
              </section>

              {!unlocked && issues.length > 0 && (
                <section className="panel gate">
                  <div className="gate-lock" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                  </div>
                  <h2>Get your fix list</h2>
                  <p>
                    {issues.length} issue{issues.length === 1 ? "" : "s"} found. See what each one is costing you and
                    exactly how to fix it, plus Google&apos;s top speed fixes for your site.
                  </p>
                  <form className="gate-form" onSubmit={unlock}>
                    <label className="sr-only" htmlFor="lead-name">Your name</label>
                    <input id="lead-name" type="text" autoComplete="name" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                    <label className="sr-only" htmlFor="lead-email">Email</label>
                    <input id="lead-email" type="email" autoComplete="email" placeholder="you@business.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <button className="btn primary" type="submit" disabled={sending}>
                      {sending ? <><span className="btn-spin" aria-hidden="true" />Unlocking</> : "Show my fix list"}
                    </button>
                  </form>
                  {leadError && <p className="error" role="alert">{leadError}</p>}
                  <p className="fine">No spam. {OWNER} may follow up once with a few ideas. Reply “no” and that&apos;s the end of it.</p>
                </section>
              )}

              {unlocked && (
                <p className="unlocked-note" role="status">Fix list unlocked. Open any issue above to see how to fix it.</p>
              )}

              {unlocked && report.opportunities.length > 0 && (
                <section className="panel">
                  <h2>Google&apos;s top speed fixes</h2>
                  <ul className="opps">
                    {report.opportunities.map((o) => (
                      <li key={o.title}>
                        <span>{o.title}</span>
                        {o.savings && <span className="opp-save">{o.savings}</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="cta">
                <div>
                  <h2>{issues.length ? "Want these fixed without the headache?" : "Your site is in good shape"}</h2>
                  <p>
                    {issues.length
                      ? `I'm ${OWNER}, a full-stack developer. I fix issues like these for small businesses at a fixed price, or build a faster new site or app if that makes more sense.`
                      : `Thinking about a redesign, a booking system or a mobile app? I'm ${OWNER}, and I build those for small businesses at a fixed price.`}
                  </p>
                </div>
                <div className="cta-actions">
                  <a className="btn light" href={CTA_URL} target="_blank" rel="noopener noreferrer">Book a free 15-minute call</a>
                  <button type="button" className="btn outline-light" onClick={reset}>Check another site</button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      <footer className="wrap">
        Built by <a href={PORTFOLIO} target="_blank" rel="noopener noreferrer">{OWNER}</a>, full-stack web and mobile developer.
      </footer>
    </>
  );
}
