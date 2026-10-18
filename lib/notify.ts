/** Small helpers for emailing Hamza through Resend. All optional: no keys → nothing is sent. */

export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function notifyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.LEAD_NOTIFY_EMAIL);
}

export async function sendOwnerEmail(opts: { subject: string; html: string; replyTo?: string }): Promise<void> {
  if (!notifyConfigured()) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.LEAD_FROM_EMAIL || "Health Check <onboarding@resend.dev>",
        to: [process.env.LEAD_NOTIFY_EMAIL],
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        subject: opts.subject.replace(/[\r\n]/g, " ").slice(0, 200),
        html: opts.html,
      }),
    });
    if (!r.ok) console.error("resend failed", r.status, await r.text());
  } catch (e) {
    console.error("resend error", e);
  }
}

/** Pakistan time, e.g. "18 Oct, 9:42 PM". */
export function pkTime(d = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

// One "report opened" alert per site per 12 hours (per server instance).
const recentAlerts = new Map<string, number>();
const ALERT_WINDOW_MS = 12 * 60 * 60 * 1000;

export function shouldAlert(host: string, now = Date.now()): boolean {
  for (const [k, t] of recentAlerts) if (now - t > ALERT_WINDOW_MS) recentAlerts.delete(k);
  if (recentAlerts.has(host)) return false;
  recentAlerts.set(host, now);
  return true;
}
