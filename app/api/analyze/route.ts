import { NextResponse } from "next/server";
import { runHtmlChecks } from "@/lib/checks";
import { runPageSpeed, type PageSpeedResult } from "@/lib/pagespeed";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { normaliseUrl, safeFetch, UnsafeUrlError } from "@/lib/ssrf";
import type { Report } from "@/lib/types";
import { escapeHtml, pkTime, sendOwnerEmail, shouldAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`analyze:${clientIp(req)}`, 6, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many checks from your connection. Please try again in a few minutes." }, { status: 429 });
  }

  let raw = "";
  let src = "";
  let owner = false;
  try {
    const body = (await req.json()) as { url?: unknown; src?: unknown; owner?: unknown };
    raw = String(body.url ?? "");
    // Where the visit came from, e.g. "email" for outreach links (?src=email). Letters/digits/dash only.
    src = String(body.src ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20);
    owner = body.owner === true;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const url = normaliseUrl(raw);

    // Fetch the page ourselves and run PageSpeed in parallel.
    const [page, psi] = await Promise.all([
      safeFetch(url, { timeoutMs: 12_000 }),
      runPageSpeed(url.toString()).then(
        (r): PageSpeedResult | Error => r,
        (e: unknown): Error => (e instanceof Error ? e : new Error(String(e))),
      ),
    ]);

    if (page.status >= 400) {
      return NextResponse.json(
        { error: `The website responded with an error (${page.status}). Check the address and try again.` },
        { status: 422 },
      );
    }

    const checks = await runHtmlChecks(page.finalUrl, page.body);
    const psiOk = !(psi instanceof Error);

    const critical = checks.filter((c) => c.status === "fail").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    const passed = checks.filter((c) => c.status === "pass").length;
    const checksScore = Math.max(0, 100 - critical * 15 - warnings * 5);

    const psiValues = psiOk
      ? Object.values(psi.scores).filter((v): v is number => typeof v === "number")
      : [];
    const psiAvg = psiValues.length ? psiValues.reduce((a, b) => a + b, 0) / psiValues.length : null;
    const overall = Math.round(psiAvg === null ? checksScore : psiAvg * 0.5 + checksScore * 0.5);

    const report: Report = {
      url: url.toString(),
      finalUrl: page.finalUrl.toString(),
      checkedAt: new Date().toISOString(),
      scores: psiOk ? psi.scores : { performance: null, accessibility: null, bestPractices: null, seo: null },
      metrics: psiOk ? psi.metrics : [],
      checks,
      opportunities: psiOk ? psi.opportunities : [],
      summary: { critical, warnings, passed, overall },
      pagespeedError: psiOk ? null : "Google's speed test didn't respond in time, so speed scores are missing. The other checks are complete.",
    };

    // Alert Hamza when a prospect opens a tracked report link (not for his own test browsers).
    if (src && !owner) {
      const host = new URL(report.finalUrl).hostname.replace(/^www\./, "");
      if (shouldAlert(host)) await sendOpenAlert(report, host, src);
    }

    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof UnsafeUrlError) return NextResponse.json({ error: e.message }, { status: 400 });
    const msg = e instanceof Error && e.name === "AbortError" ? "The website took too long to respond." : "We couldn't reach that website. Check the address and try again.";
    console.error("analyze failed", e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

async function sendOpenAlert(report: Report, host: string, src: string) {
  const { overall, critical, warnings } = report.summary;
  const issues = [
    ...report.checks.filter((c) => c.status === "fail"),
    ...report.checks.filter((c) => c.status === "warn"),
  ];
  const top = issues.slice(0, 3).map((c) => `<li><b>${escapeHtml(c.label)}</b>: ${escapeHtml(c.detail)}</li>`).join("");
  const reportLink = `https://check.hamzaabubakar.dev/?url=${encodeURIComponent(host)}`;
  const html = `
    <h2>${escapeHtml(host)} just opened their report</h2>
    <p><b>Opened:</b> ${pkTime()} (Pakistan time)<br>
    <b>From:</b> ${escapeHtml(src)} link<br>
    <b>Score:</b> ${overall}/100 · ${critical} to fix first · ${warnings} to improve</p>
    ${top ? `<p><b>Top issues they saw:</b></p><ul>${top}</ul>` : "<p>No issues found.</p>"}
    <p><b>Suggested move:</b> reply in the same email thread today, e.g.<br>
    <i>"Saw you had a look at the report. Happy to walk you through the ${critical ? "top fixes" : "quick wins"} in 10 minutes. Does tomorrow work?"</i></p>
    <p><a href="${reportLink}">Open their report</a> (open it with your owner browser so it doesn't alert again)</p>`;
  await sendOwnerEmail({ subject: `Report opened: ${host} (score ${overall})`, html });
}
