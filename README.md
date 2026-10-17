# Free Website Health Check

A lead-generation tool: a business owner enters their website, gets a free health report in ~60 seconds, and unlocks the full fix list by leaving their email. You get notified about every lead.

**What it checks**
- Google PageSpeed (mobile): Speed, SEO, Accessibility, Best practices + Core Web Vitals (LCP, FCP, TBT, CLS)
- HTTPS, mobile viewport, page title, meta description, H1
- Contact / quote / booking form (incl. embedded Calendly, Typeform, HubSpot, Jotform…)
- Tap-to-call link, placeholder email links (e.g. `info@mysite.com`)
- Leftover template text (`[post_title]`, lorem ipsum…), hacked/spam content
- Outdated footer year, social preview image, insecure `http://` files
- Broken internal links (samples up to 12)

**Safety:** SSRF protection (blocks localhost/private IPs, re-checks every redirect), size and time limits, simple per-IP rate limiting.

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in what you want
npm run dev                  # http://localhost:3000
```

## Deploy (Vercel, ~10 minutes)
1. Push this folder to a new GitHub repo (e.g. `site-health-check`).
2. Vercel → **Add New Project** → import the repo → Deploy.
3. **Settings → Environment Variables** (all optional, but recommended):
   - `PAGESPEED_API_KEY` — free key from Google Cloud (enable "PageSpeed Insights API"). Without it, Google rate-limits you quickly.
   - `RESEND_API_KEY` + `LEAD_NOTIFY_EMAIL` — get an email for every lead (Resend free tier; without a verified domain it can only send to your own Resend account email, so sign up to Resend with the inbox you want leads in).
   - `LEADS_WEBHOOK_URL` — optional: also send leads to a Google Sheet via an Apps Script web app.
   - `NEXT_PUBLIC_CTA_URL` — your booking link (Calendly / Cal.com free) or `mailto:`.
4. **Settings → Domains** → add `check.hamzaabubakar.dev` and add the CNAME record Vercel shows at your DNS provider.
5. Redeploy after adding env vars.

> On Vercel Hobby, API routes can run up to 60s; the analysis usually takes 20–40s (Google's speed test is the slow part).

## Use it in outreach
Link straight to a prospect's report — it runs automatically:

```
https://check.hamzaabubakar.dev/?url=theirbusiness.com
```

Example line for a cold email:
> I ran a free health check on your site — here's the report: https://check.hamzaabubakar.dev/?url=theirbusiness.com

## Where to put it
- Portfolio nav: "Free Website Check"
- Email signature
- Clutch / directory profiles, LinkedIn featured section, Facebook group posts (when someone asks for website feedback)
