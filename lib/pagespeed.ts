import type { Metric, Opportunity, Scores } from "./types";

type PsiAudit = {
  id: string;
  title: string;
  score: number | null;
  displayValue?: string;
  numericValue?: number;
  details?: { type?: string; overallSavingsMs?: number };
};

type PsiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null }>;
    audits?: Record<string, PsiAudit>;
  };
  error?: { message?: string };
};

export type PageSpeedResult = {
  scores: Scores;
  metrics: Metric[];
  opportunities: Opportunity[];
};

const METRICS: { id: string; label: string; good: number; poor: number }[] = [
  { id: "largest-contentful-paint", label: "Main content loads (LCP)", good: 2500, poor: 4000 },
  { id: "first-contentful-paint", label: "First content appears (FCP)", good: 1800, poor: 3000 },
  { id: "total-blocking-time", label: "Page is frozen for (TBT)", good: 200, poor: 600 },
  { id: "cumulative-layout-shift", label: "Layout jumps (CLS)", good: 0.1, poor: 0.25 },
  { id: "speed-index", label: "Speed Index", good: 3400, poor: 5800 },
];

const pct = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n * 100) : null);

/** Runs Google PageSpeed Insights (mobile) for a URL. */
export async function runPageSpeed(url: string, timeoutMs = 50_000): Promise<PageSpeedResult> {
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", "mobile");
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) api.searchParams.append("category", c);
  if (process.env.PAGESPEED_API_KEY) api.searchParams.set("key", process.env.PAGESPEED_API_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let data: PsiResponse;
  try {
    const res = await fetch(api, { signal: controller.signal, cache: "no-store" });
    data = (await res.json()) as PsiResponse;
    if (!res.ok) throw new Error(data.error?.message || `PageSpeed returned ${res.status}`);
  } finally {
    clearTimeout(timer);
  }

  const lh = data.lighthouseResult;
  const cats = lh?.categories ?? {};
  const audits = lh?.audits ?? {};

  const scores: Scores = {
    performance: pct(cats.performance?.score),
    accessibility: pct(cats.accessibility?.score),
    bestPractices: pct(cats["best-practices"]?.score),
    seo: pct(cats.seo?.score),
  };

  const metrics: Metric[] = METRICS.map((m) => {
    const a = audits[m.id];
    const v = a?.numericValue;
    let rating: Metric["rating"] = "unknown";
    if (typeof v === "number") rating = v <= m.good ? "good" : v <= m.poor ? "average" : "poor";
    return { id: m.id, label: m.label, value: a?.displayValue ?? "—", rating };
  });

  const opportunities: Opportunity[] = Object.values(audits)
    .filter((a) => a.details?.type === "opportunity" && typeof a.score === "number" && a.score < 0.9)
    .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
    .slice(0, 6)
    .map((a) => ({
      title: a.title,
      savings: a.details?.overallSavingsMs ? `~${(a.details.overallSavingsMs / 1000).toFixed(1)}s faster` : null,
    }));

  return { scores, metrics, opportunities };
}
