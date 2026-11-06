import type { APIRoute } from "astro";

// The lowest-priority route: an address with no prebuilt file and no other
// route. Without it Astro answered such a request with the 404 page directly,
// skipping the middleware. On Cloudflare the middleware answers public GET and
// HEAD requests here before this runs (src/server/platform/staticFallback.ts:
// a city's other spelling → 301, an unpublished product → "not on sale", else
// the 404 page). What still reaches this handler (an unknown admin or API
// address, another method) gets a plain 404 without rendering anything.
export const prerender = false;

export const ALL: APIRoute = () =>
  new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
