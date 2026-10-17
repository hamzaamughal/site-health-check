import dns from "node:dns/promises";
import net from "node:net";

/** Returns true for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (/^fe[89ab]/.test(lower)) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // not an IP we understand -> treat as unsafe
}

export class UnsafeUrlError extends Error {}

/** Normalises user input into a URL and makes sure it points at a public host. */
export function normaliseUrl(raw: string): URL {
  let input = (raw || "").trim();
  if (!input) throw new UnsafeUrlError("Please enter a website address.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) {
    throw new UnsafeUrlError("Only http and https websites can be checked.");
  }
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid website address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https websites can be checked.");
  }
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials aren't allowed.");
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new UnsafeUrlError("Only standard web ports (80/443) are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("That address isn't a public website.");
  }
  if (!host.includes(".")) throw new UnsafeUrlError("Please enter a full domain, like example.com.");
  url.hash = "";
  return url;
}

/** Resolves the hostname and rejects it if any address is non-public. */
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("That address isn't a public website.");
    return;
  }
  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("We couldn't find that website. Check the spelling and try again.");
  }
  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw new UnsafeUrlError("That address isn't a public website.");
  }
}

export type SafeResponse = {
  finalUrl: URL;
  status: number;
  headers: Headers;
  body: string;
  redirects: number;
};

const UA =
  "Mozilla/5.0 (compatible; SiteHealthCheck/1.0; +https://hamzaabubakar.dev)";

/**
 * Fetches a public URL, re-validating every redirect hop against private
 * networks. Reads at most `maxBytes` of the body.
 */
export async function safeFetch(
  start: URL,
  opts: { method?: "GET" | "HEAD"; timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<SafeResponse> {
  const { method = "GET", timeoutMs = 10_000, maxBytes = 2_000_000, maxRedirects = 5 } = opts;
  let current = start;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, current);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new UnsafeUrlError("The website redirected to an unsupported address.");
      }
      current = next;
      continue;
    }
    const body = method === "HEAD" ? "" : await readLimited(res, maxBytes);
    return { finalUrl: current, status: res.status, headers: res.headers, body, redirects: hop };
  }
  throw new UnsafeUrlError("The website redirected too many times.");
}

async function readLimited(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}
