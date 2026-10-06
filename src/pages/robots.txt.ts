import type { APIRoute } from "astro";

// Prerendered like every other storefront page — zero added runtime cost,
// same static-by-default architecture the rest of the site already uses.
//
// robots.txt is a crawler directive only, not a security boundary: the
// real protection for /admin is the session check in src/middleware.ts,
// unchanged by this file. Disallowing it here is just crawler hygiene —
// keeping admin/API/cart URLs out of search results — not a substitute
// for authentication. See sitemap.xml.ts's header for why the same three
// prefixes are excluded there too.
//
// /cart is no longer disallowed: it carries <meta name="robots"
// content="noindex">, and a disallowed URL can't be crawled, so Google
// would never see that noindex and could still index the bare URL from
// links. Crawlable + noindex is what keeps it out of results.
export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL("sitemap.xml", site).toString();
  // Garland product pages change without a deployment; their sitemap is live.
  const garlandSitemapUrl = new URL("sitemap-garlands.xml", site).toString();

  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${sitemapUrl}
Sitemap: ${garlandSitemapUrl}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
