// What the Worker answers for public addresses on Cloudflare.
//
// The storefront is prebuilt. Workers static assets serve every file (page,
// sitemap, photo, script) before the Worker runs, so a public GET or HEAD that
// reaches the Worker has no file: an invented address, an unpublished
// product, an old spelling of a city. Those are answered here without
// rendering a page or reading the database:
//
//   - another spelling of a serviceable city (/locations/bangalore,
//     /locations/Bengaluru/shop) → 301 to its one address, as the city page did;
//   - /products/<slug> with no page → the prebuilt "not on sale" page with
//     status 404: the catalogue version for a catalogue product that isn't
//     published in this build, the garland version for anything else;
//   - anything else → the prebuilt 404 page with status 404.
//
// Only these paths still run on request: the admin and its API, the public
// APIs (enquiries, delivery checks), /garland-enquiry (the live WhatsApp
// check), stored-photo resizing (/_image) and media. /studio/* is a static
// redirect (_redirects).
import { LOCATIONS_PATH, findCity } from "../../data/serviceCities";
import { productCatalog } from "../../data/productCatalog";

const ON_DEMAND = /^\/(?:admin|api)(?:\/|$)|^\/(?:_image|garland-enquiry)\/?$|^\/media\//;

/** True when no prebuilt file can answer this public request, so the Worker answers it statically. */
export function servedStatically(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD") && !ON_DEMAND.test(path);
}

/** The one address of a city spelled another way, or null. */
export function cityRedirect(path: string): string | null {
  const match = /^\/locations\/([^/]+)(\/shop)?\/?$/.exec(path);
  if (!match) return null;
  let requested: string;
  try { requested = decodeURIComponent(match[1]); } catch { return null; }
  const city = findCity(requested);
  if (!city || !city.serviceable) return null;
  const target = `${LOCATIONS_PATH}/${city.slug}${match[2] ?? ""}`;
  return target === path ? null : target;
}

type Assets = { fetch(input: Request | string): Promise<Response> };

/** Which prebuilt page answers a path with no file. */
export function notFoundPage(path: string): string {
  const product = /^\/products\/([^/]+)\/?$/.exec(path)?.[1];
  if (!product) return "/404";
  return productCatalog.some((item) => item.slug === product) ? "/unavailable/catalogue" : "/unavailable/garland";
}

/** 301 for a city spelling, otherwise the prebuilt 404 page (status 404). `search` is kept on a redirect. */
export async function staticFallback(url: URL, method: string, assets: Assets | undefined, headers: Record<string, string>): Promise<Response> {
  const target = cityRedirect(url.pathname);
  if (target) return new Response(null, { status: 301, headers: { ...headers, location: target + url.search, "cache-control": "public, max-age=3600" } });
  const page = assets ? await assets.fetch(new Request(new URL(notFoundPage(url.pathname), url.origin))).catch(() => null) : null;
  const body = page && page.ok && method !== "HEAD" ? page.body : method === "HEAD" ? null : "Not found";
  return new Response(body, {
    status: 404,
    headers: { ...headers, "content-type": page?.headers.get("content-type") ?? "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
