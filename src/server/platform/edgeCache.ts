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
//   - the key is the path plus the query parameters a public page reads
//     (KEY_PARAMS below), so filters and pagination keep their own copies
//     while parameters no page reads (utm_source, gclid, a crawler's ?ref=…)
//     share one copy;
//   - `Vercel-Cache-Tag` is translated to Cloudflare's `Cache-Tag`, so an
//     admin save purges the same pages (refreshWebsite → zone purge by tag);
//   - the lifetime is the response's own s-maxage, so a failed purge is
//     bounded exactly as before.
//
// The Cache API is per data centre. It does store responses on *.workers.dev
// (the staging Worker returned x-fp-edge-cache: HIT with Age on 6 Nov 2026),
// but a workers.dev Worker has no zone to purge, so there an admin save reaches
// the cached public pages only when their s-maxage runs out (120 s for garland
// pages and sitemaps). A request with a new query string is a new key and
// renders fresh.

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
 * The only query parameters an on-demand public response reads on the server:
 * filter groups and intent (src/utils/shopFilters.ts), the city shop's
 * collection and page, the garland list's "unavailable" notice, the garland
 * section's view and occasion, and the journey/enquiry context. Anything else
 * (advertising tags such as utm_source or gclid, a crawler's invented
 * ?ref=…, a cache-buster) cannot change the page, so it is left out of the
 * cache key: on 6 Nov 2026 each distinct unknown parameter on staging forced a
 * fresh render costing 60–150 KB of database results and 35–75 ms of CPU.
 * The page itself still receives the full URL. Kept parameters are sorted, so
 * their order doesn't make a new key either. Add a name here whenever a public
 * on-demand page starts reading a new parameter.
 */
const KEY_PARAMS = new Set(["occasion", "budget", "colour", "for", "collection", "page", "unavailable", "occ", "from", "city", "code", "qty", "opt"]);

export function cacheKeyUrl(url: string): string {
  const parsed = new URL(url);
  const kept = [...parsed.searchParams].filter(([name]) => KEY_PARAMS.has(name));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  parsed.search = new URLSearchParams(kept).toString();
  return parsed.toString();
}

function cacheKey(request: Request): Request {
  return new Request(cacheKeyUrl(request.url), { method: "GET" });
}

/**
 * Redirects can echo the query (an old filter link keeps its utm_source in
 * Location, src/utils/shopFilters.ts), so a redirect is shared only between
 * requests whose URLs are identical: never stored for, or served to, a
 * request that carries a parameter the key leaves out (or a different order).
 */
const hasUnkeyedParams = (url: string) => cacheKeyUrl(url) !== new URL(url).toString();
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
  if (isRedirect(hit.status) && hasUnkeyedParams(request.url)) return undefined;
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
    !(isRedirect(response.status) && hasUnkeyedParams(request.url));
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
