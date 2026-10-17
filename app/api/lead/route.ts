import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadBody = {
  email?: unknown;
  name?: unknown;
  url?: unknown;
  overall?: unknown;
  critical?: unknown;
  warnings?: unknown;
  topIssues?: unknown;
};

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const clean = (v: unknown, max = 300) => String(v ?? "").replace(/[\r\n<>"]/g, " ").trim().slice(0, max);

export async function POST(req: Request) {
  if (!rateLimit(`lead:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = clean(body.email, 200);
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });

  const lead = {
    email,
    name: clean(body.name, 100),
    url: clean(body.url, 300),
    overall: Number(body.overall) || 0,
    critical: Number(body.critical) || 0,
    warnings: Number(body.warnings) || 0,
    topIssues: Array.isArray(body.topIssues) ? body.topIssues.slice(0, 8).map((t) => clean(t, 200)) : [],
    at: new Date().toISOString(),
  };

  const tasks: Promise<unknown>[] = [];

  // 1) Email notification to Hamza via Resend (optional)
  if (process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_EMAIL) {
    const html = `
      <h2>New Website Health Check lead</h2>
      <p><b>Email:</b> ${lead.email}<br><b>Name:</b> ${lead.name || "—"}<br>
      <b>Website:</b> <a href="${lead.url}">${lead.url}</a><br>
      <b>Overall score:</b> ${lead.overall}/100 · ${lead.critical} critical · ${lead.warnings} warnings</p>
      <p><b>Top issues:</b></p><ul>${lead.topIssues.map((t) => `<li>${t}</li>`).join("")}</ul>
      <p>Reply fast — they just looked at their report.</p>`;
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.LEAD_FROM_EMAIL || "Health Check <onboarding@resend.dev>",
          to: [process.env.LEAD_NOTIFY_EMAIL],
          reply_to: lead.email,
          subject: `New lead: ${lead.url} (score ${lead.overall})`,
          html,
        }),
      }).then(async (r) => {
        if (!r.ok) console.error("resend failed", r.status, await r.text());
      }),
    );
  }

  // 2) Optional webhook (e.g. Google Apps Script -> Google Sheet)
  if (process.env.LEADS_WEBHOOK_URL) {
    tasks.push(
      fetch(process.env.LEADS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      }).catch((e) => console.error("webhook failed", e)),
    );
  }

  if (!tasks.length) console.log("LEAD (no notifier configured):", JSON.stringify(lead));
  await Promise.allSettled(tasks);

  return NextResponse.json({ ok: true });
}
