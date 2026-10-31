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
//
// Filtered listings (/categories/<slug>?occasion=…&colour=…&budget=…,
// /occasions/<slug>?…) are disallowed. Every filter chip is a link to another
// combination, so crawlers following them reach an effectively unlimited set
// of URLs; each one misses the CDN cache (the cache key includes the query)
// and renders the full ~380 KB list in a Vercel Function. Measured 30–31 Oct
// 2026: about 56k such renders a day on /categories/bouquets alone. Each
// filtered page already declares the unfiltered path as its canonical, so
// nothing indexable is lost; the unfiltered pages stay crawlable.
export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL("sitemap.xml", site).toString();
  // Garland product pages change without a deployment; their sitemap is live.
  const garlandSitemapUrl = new URL("sitemap-garlands.xml", site).toString();
  // Occasion pages follow the admin's occasion assignments; listed by a live sitemap too.
  const occasionSitemapUrl = new URL("sitemap-occasions.xml", site).toString();

  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Disallow: /categories/*?
Disallow: /occasions/*?

Sitemap: ${sitemapUrl}
Sitemap: ${garlandSitemapUrl}
Sitemap: ${occasionSitemapUrl}
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
