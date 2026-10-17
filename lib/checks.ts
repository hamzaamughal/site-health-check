import { safeFetch } from "./ssrf";
import type { Check } from "./types";

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&copy;/gi, "©")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const metaContent = (html: string, attr: "name" | "property", value: string) => {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? null;
};

const hrefs = (html: string) =>
  Array.from(html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#][^"']*)["']/gi)).map((m) => m[1].trim());

const PLACEHOLDER_EMAILS = /mailto:\s*([^"'?\s]*@(?:mysite\.com|example\.(?:com|org)|yourdomain\.com|domain\.com|email\.com|yoursite\.com|company\.com))/i;
const PLACEHOLDER_TEXT = /(lorem ipsum|\[post_title\]|\[site_name\]|your company name|add your text here|insert text here|this is a sample page|just another wordpress site)/i;
const SPAM_TEXT = /\b(online casino|casino bonus|free spins|viagra|cialis|payday loans?|porn|escort service|betting site)\b/i;

function check(
  id: string,
  label: string,
  status: Check["status"],
  detail: string,
  impact: string,
  fix: string,
): Check {
  return { id, label, status, detail, impact, fix };
}

export async function runHtmlChecks(finalUrl: URL, html: string): Promise<Check[]> {
  const checks: Check[] = [];
  const text = stripTags(html);

  // 1. HTTPS
  checks.push(
    finalUrl.protocol === "https:"
      ? check("https", "Secure connection (HTTPS)", "pass", "Your site loads over HTTPS.", "Browsers trust the site.", "Nothing to do.")
      : check(
          "https",
          "Secure connection (HTTPS)",
          "fail",
          "Your site loads without HTTPS — browsers show “Not secure”.",
          "Many visitors leave when Chrome warns the site isn't secure, and Google ranks it lower.",
          "Install a free SSL certificate and redirect all http:// traffic to https://.",
        ),
  );

  // 2. Mobile viewport
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  checks.push(
    hasViewport
      ? check("viewport", "Mobile-friendly setup", "pass", "The page is set up for mobile screens.", "", "")
      : check(
          "viewport",
          "Mobile-friendly setup",
          "fail",
          "No mobile viewport tag — the page likely shows zoomed-out on phones.",
          "Over 60% of local searches happen on phones; a desktop-only layout loses most of them.",
          "Add a responsive viewport tag and make the layout responsive.",
        ),
  );

  // 3. Title
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (!title) {
    checks.push(check("title", "Page title", "fail", "The page has no title.", "Google shows the title in search results — without one, fewer people click.", "Add a clear title like “Service in City | Business Name”."));
  } else if (title.length < 10 || title.length > 65) {
    checks.push(check("title", "Page title", "warn", `Title is ${title.length} characters: “${title.slice(0, 80)}”.`, "Titles that are too short or get cut off in Google get fewer clicks.", "Keep the title between 30 and 60 characters and include your main service and city."));
  } else {
    checks.push(check("title", "Page title", "pass", `“${title}”`, "", ""));
  }

  // 4. Meta description
  const desc = metaContent(html, "name", "description");
  checks.push(
    desc
      ? check("description", "Search description", "pass", "A search description is set.", "", "")
      : check(
          "description",
          "Search description",
          "warn",
          "No meta description — Google will pick random text from the page.",
          "A good description is your free ad in Google results; random text gets fewer clicks.",
          "Write a 140–160 character description with your service, area and a reason to call.",
        ),
  );

  // 5. H1
  const hasH1 = /<h1\b/i.test(html);
  checks.push(
    hasH1
      ? check("h1", "Main heading", "pass", "The page has a main heading.", "", "")
      : check("h1", "Main heading", "warn", "No main (H1) heading found.", "Visitors and Google both use the main heading to understand what you do.", "Add one clear H1 heading, e.g. “Kitchen Remodeling in Dallas”."),
  );

  // 6. Contact / quote form
  const formBlocks = Array.from(html.matchAll(/<form\b[\s\S]*?<\/form>/gi)).map((m) => m[0]);
  const hasLeadForm = formBlocks.some((f) => /type=["']?(email|tel)|<textarea/i.test(f));
  const hasEmbeddedForm = /(typeform\.com|jotform|hsforms|hubspot|calendly\.com|cal\.com|forms\.gle|google\.com\/forms|wufoo|formstack|tally\.so|acuityscheduling|square\.site\/book)/i.test(html);
  checks.push(
    hasLeadForm || hasEmbeddedForm
      ? check("form", "Contact / quote form", "pass", "Visitors can send you an enquiry from this page.", "", "")
      : check(
          "form",
          "Contact / quote form",
          "warn",
          "No contact, quote or booking form on this page.",
          "Many people won't call — they want to send details or book online. Without a form, those leads go to competitors.",
          "Add a short quote/booking form (name, phone, what they need, optional photo) that emails you instantly.",
        ),
  );

  // 7. Click-to-call
  const hasTel = /href=["']tel:/i.test(html);
  checks.push(
    hasTel
      ? check("tel", "Tap-to-call button", "pass", "Phone numbers are tappable on mobile.", "", "")
      : check("tel", "Tap-to-call button", "warn", "No tap-to-call link found.", "On phones, people expect to tap your number to call. Making them copy it loses calls.", "Wrap your phone number in a tel: link and add a sticky “Call now” button on mobile."),
  );

  // 8. Email links
  const badMail = html.match(PLACEHOLDER_EMAILS)?.[1];
  if (badMail) {
    checks.push(check("mailto", "Email link", "fail", `An email link points to a placeholder address (${badMail}).`, "Customers who click it are emailing nobody — you never see those enquiries.", "Point every email link to your real inbox and test it."));
  }

  // 9. Placeholder text
  const placeholder = text.match(PLACEHOLDER_TEXT)?.[1];
  checks.push(
    placeholder
      ? check("placeholder", "Leftover template text", "fail", `Found template text on the page: “${placeholder}”.`, "Leftover template text makes the business look unfinished or abandoned.", "Replace all template/demo text with your real content.")
      : check("placeholder", "Leftover template text", "pass", "No leftover template text found.", "", ""),
  );

  // 10. Spam / hacked content
  const spam = text.match(SPAM_TEXT)?.[1];
  checks.push(
    spam
      ? check("spam", "Hacked / spam content", "fail", `Found suspicious text on the page: “${spam}”. This often means the site was hacked.`, "Google can flag or demote hacked sites, and visitors lose trust instantly.", "Clean the injected content, update the CMS and plugins, change passwords, and request a review in Google Search Console.")
      : check("spam", "Hacked / spam content", "pass", "No signs of injected spam.", "", ""),
  );

  // 11. Copyright year
  const years = Array.from(text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)).map((m) => Number(m[1]));
  const thisYear = new Date().getFullYear();
  if (years.length) {
    const latest = Math.max(...years);
    checks.push(
      latest < thisYear - 1
        ? check("copyright", "Site looks up to date", "warn", `Footer still says © ${latest}.`, "An old year makes visitors wonder if the business is still active.", "Update the footer year (or make it update automatically).")
        : check("copyright", "Site looks up to date", "pass", `Footer year is ${latest}.`, "", ""),
    );
  }

  // 12. Social preview
  const ogImage = metaContent(html, "property", "og:image");
  checks.push(
    ogImage
      ? check("og", "Social sharing preview", "pass", "Links shared on WhatsApp/Facebook show a preview image.", "", "")
      : check("og", "Social sharing preview", "warn", "No social preview image set.", "When your link is shared on WhatsApp, Facebook or LinkedIn, it shows up plain and gets fewer clicks.", "Add an og:image and og:title so shared links show a branded preview."),
  );

  // 13. Mixed content
  if (finalUrl.protocol === "https:") {
    const mixed = (html.match(/\s(?:src)=["']http:\/\//gi) ?? []).length;
    if (mixed > 0) {
      checks.push(check("mixed", "Insecure files on a secure page", "warn", `${mixed} image(s)/script(s) load over insecure http://.`, "Browsers may block these files or show a security warning.", "Load every image and script over https://."));
    }
  }

  // 14. Broken internal links (sample)
  const internal = Array.from(
    new Set(
      hrefs(html)
        .filter((h) => !/^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(h))
        .map((h) => {
          try {
            return new URL(h, finalUrl);
          } catch {
            return null;
          }
        })
        .filter((u): u is URL => !!u && u.hostname === finalUrl.hostname && /^https?:$/.test(u.protocol))
        .map((u) => {
          u.hash = "";
          return u.toString();
        }),
    ),
  ).slice(0, 12);

  if (internal.length) {
    const results = await mapLimit(internal, 6, async (href) => {
      try {
        let r = await safeFetch(new URL(href), { method: "HEAD", timeoutMs: 6000, maxRedirects: 3 });
        if (r.status === 405 || r.status === 403) r = await safeFetch(new URL(href), { timeoutMs: 6000, maxBytes: 50_000, maxRedirects: 3 });
        return { href, status: r.status };
      } catch {
        return { href, status: 0 };
      }
    });
    const broken = results.filter((r) => r.status >= 400 || r.status === 0);
    checks.push(
      broken.length === 0
        ? check("links", "Broken links", "pass", `Checked ${results.length} links on the page — all working.`, "", "")
        : check(
            "links",
            "Broken links",
            broken.length >= 2 ? "fail" : "warn",
            `${broken.length} of ${results.length} links checked are broken (e.g. ${new URL(broken[0].href).pathname}).`,
            "Broken links and buttons stop visitors right when they're trying to contact or buy.",
            "Fix or remove the broken links, and check menus and buttons after every update.",
          ),
    );
  }

  return checks;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
