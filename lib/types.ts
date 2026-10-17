export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** What we found, in plain language. */
  detail: string;
  /** Why it matters to the business (shown in the full report). */
  impact: string;
  /** How to fix it (shown in the full report). */
  fix: string;
};

export type Scores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
};

export type Metric = { id: string; label: string; value: string; rating: "good" | "average" | "poor" | "unknown" };

export type Opportunity = { title: string; savings: string | null };

export type Report = {
  url: string;
  finalUrl: string;
  checkedAt: string;
  scores: Scores;
  metrics: Metric[];
  checks: Check[];
  opportunities: Opportunity[];
  summary: { critical: number; warnings: number; passed: number; overall: number };
  pagespeedError: string | null;
};
