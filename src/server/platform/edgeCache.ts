// Shared cache for on-demand public pages on Cloudflare Workers.
//
// On Vercel the platform CDN caches any public response that sends
// `s-maxage`, keyed by full URL, and src/server/services/GarlandWebsite.ts
// purges it by `Vercel-Cache-Tag`. A Worker's own responses are not cached by
// Cloudflare, so the same contract is kept here with the Cache API:
//
//   - only GET/HEAD to non-admin, non-API paths, with no request cookies
//     that could personalise the page, and only responses that opt in with
//     `s-maxage` and carry no Set-Cookie;
//   - the key is the full URL (path and query string), as on Vercel, so
//     filters and pagination keep their own copies (only advertising/analytics
//     parameters such as utm_source and gclid are left out of the key);
//   - `Vercel-Cache-Tag` is translated to Cloudflare's `Cache-Tag`, so an
//     admin save purges the same pages (refreshWebsite → zone purge by tag);
//   - the lifetime is the response's own s-maxage, so a failed purge is
//     bounded exactly as before.
//
// The Cache API is per data centre and does nothing on *.workers.dev
// (previews), which then simply render every request.

const SKIP_PREFIXES = ["/admin", "/api/", "/_image", "/media/"];

function sMaxAge(cacheControl: string | null): number | null {
  if (!cacheControl || /(^|,)\s*(private|no-store)\b/i.test(cacheControl)) return null;
  const match = cacheControl.match(/(?:^|,)\s*s-maxage=(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function edgeCacheable(request: Request, path: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (SKIP_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix))) return false;
  // A visitor with an admin session must never be served or seed a shared copy.
  const cookie = request.headers.get("cookie") ?? "";
  if (/(^|;\s*)sb-[^=]*-auth-token/.test(cookie)) return false;
  return true;
}

/**
 * Advertising/analytics parameters that no page reads. Each distinct value
 * would otherwise force a fresh render and database read, so they are left out
 * of the cache key only (the page itself still receives the full URL).
 * Filters, pagination and every other parameter stay part of the key.
 */
const TRACKING_PARAMS = /^(utm_[a-z_]+|gclid|gbraid|wbraid|dclid|fbclid|msclkid|igshid|mc_cid|mc_eid|_ga|_gl|srsltid)$/i;

export function cacheKeyUrl(url: string): string {
  const parsed = new URL(url);
  for (const name of [...parsed.searchParams.keys()]) if (TRACKING_PARAMS.test(name)) parsed.searchParams.delete(name);
  return parsed.toString();
}

function cacheKey(request: Request): Request {
  return new Request(cacheKeyUrl(request.url), { method: "GET" });
}

/**
 * Redirects can echo the query (an old filter link keeps its utm_source in
 * Location, src/utils/shopFilters.ts), so a redirect is shared only between
 * requests whose URLs are identical: never stored for, or served to, a
 * request that carries tracking parameters.
 */
const hasTrackingParams = (url: string) => cacheKeyUrl(url) !== new URL(url).toString();
const isRedirect = (status: number) => status >= 300 && status < 400;

function defaultCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

/** A cached copy for this request, or undefined. */
export async function edgeCacheMatch(request: Request): Promise<Response | undefined> {
  const cache = defaultCache();
  if (!cache) return undefined;
  const hit = await cache.match(cacheKey(request));
  if (!hit) return undefined;
  if (isRedirect(hit.status) && hasTrackingParams(request.url)) return undefined;
  // The stored copy's own lifetime is enforced here too, whatever the runtime
  // does with Cache-Control, so a failed purge stays bounded by s-maxage.
  const storedAt = Number(hit.headers.get("x-fp-stored-at"));
  const ttl = Number(hit.headers.get("x-fp-ttl"));
  if (!storedAt || !ttl || Date.now() - storedAt > ttl * 1000) return undefined;
  const response = new Response(request.method === "HEAD" ? null : hit.body, hit);
  response.headers.delete("cache-tag");
  response.headers.delete("x-fp-stored-at");
  response.headers.delete("x-fp-ttl");
  if (response.headers.has("x-fp-browser-cache-control")) {
    response.headers.set("cache-control", response.headers.get("x-fp-browser-cache-control")!);
    response.headers.delete("x-fp-browser-cache-control");
  }
  response.headers.set("x-fp-edge-cache", "HIT");
  return response;
}

/**
 * Stores a cacheable response and returns the one to send to the visitor.
 * `waitUntil` keeps the Worker alive until the cache write finishes.
 */
export function edgeCacheStore(request: Request, response: Response, waitUntil?: (promise: Promise<unknown>) => void): Response {
  const vercelTags = response.headers.get("vercel-cache-tag");
  const ttl = sMaxAge(response.headers.get("cache-control"));
  const cacheable =
    ttl !== null &&
    ttl > 0 &&
    !response.headers.has("set-cookie") &&
    [200, 301, 308, 404, 410].includes(response.status) &&
    !(isRedirect(response.status) && hasTrackingParams(request.url));
  const out = new Response(response.body, response);
  out.headers.delete("vercel-cache-tag");
  const cache = defaultCache();
  if (!cacheable || !cache || request.method !== "GET") {
    if (cacheable) out.headers.set("x-fp-edge-cache", "BYPASS");
    return out;
  }
  out.headers.set("x-fp-edge-cache", "MISS");
  const stored = out.clone();
  if (vercelTags) stored.headers.set("cache-tag", vercelTags);
  // Cache API lifetime from s-maxage as a plain max-age; visitors still get the original header.
  stored.headers.set("x-fp-browser-cache-control", response.headers.get("cache-control") ?? "");
  stored.headers.set("cache-control", `public, max-age=${ttl}`);
  stored.headers.set("x-fp-stored-at", String(Date.now()));
  stored.headers.set("x-fp-ttl", String(ttl));
  const write = cache.put(cacheKey(request), stored).catch((error: unknown) => {
    console.error(`[edge-cache] store failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  if (waitUntil) waitUntil(write);
  return out;
}
