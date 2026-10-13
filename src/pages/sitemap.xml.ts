import type { APIRoute } from "astro";
import { productCatalog, type Product } from "../data/productCatalog";
import { getStaticPaths as getCategoryStaticPaths } from "./categories/[slug].astro";
import { CANONICAL_CATEGORY, NOINDEX_CATEGORY_SLUGS, NOINDEX_STATIC_PAGES } from "../data/seoLanding";
import { LOCATIONS_PATH, hubPath, publishedHubs } from "../data/serviceCities";
import { CITY_HUBS, cityHub } from "../data/cityHubs";

// Prerendered — built once at build time from the exact same real data
// every other page already uses, not a second, parallel catalogue.
//
// Category slugs are NOT recomputed here: they're read straight from
// categories/[slug].astro's own getStaticPaths(), the single real source
// of truth for "what category pages actually exist" (product categories +
// collection tags + the manually-curated slug list). Duplicating that
// slug-derivation logic here would risk silently drifting out of sync —
// listing a category that no longer resolves, or missing one that does.
//
// Deliberately excluded (see robots.txt.ts and the SEO milestone's own
// "do not index private routes" rule): /admin, /api, /cart, /auth. None
// of those are storefront content, and /cart is explicitly per-customer
// browsing state, not a page with any content to index.
//
// Only indexable pages are listed, in the same slash-less form the
// canonical tags use: /search (a noindexed full-catalogue list), empty
// categories and the NOINDEX_* slugs in src/data/seoLanding.ts are left
// out. Occasion pages are rendered on request from the admin's occasion
// assignments, so the live sitemap-occasions.xml lists the ones that
// currently have products (also named in robots.txt).
//
// Garland designs are managed in the admin and change without a deployment,
// so their product pages are listed by the live sitemap-garlands.xml
// (also named in robots.txt). /categories/garlands, which is rendered on
// request and always lists the event-garland orders, is listed here.
export const prerender = true;

const staticPages = [
  "/",
  "/custom-orders",
  "/about",
  "/occasions",
  "/shipping",
  "/faqs",
  "/contact",
  "/privacy",
  "/terms",
  "/refunds",
  "/reviews",
  "/rewards",
  "/loyalty",
  "/refer-a-friend",
];

export const GET: APIRoute = async ({ site }) => {
  // categories/[slug].astro's getStaticPaths() became async as part of the
  // Catalog/Database Reconciliation milestone (it now fetches authoritative
  // pricing before generating each category's product list) -- this call
  // site needed to start awaiting it for the same reason, not a change to
  // what URLs are produced.
  const hasPublicProducts = (products: Product[]) => products.length > 0;
  const categoryPaths = (await getCategoryStaticPaths())
    .filter((entry) => hasPublicProducts(entry.props.products) && !NOINDEX_CATEGORY_SLUGS.has(entry.params.slug) && !CANONICAL_CATEGORY[entry.params.slug])
    .map((entry) => `/categories/${entry.params.slug}`);
  const productPaths = productCatalog.map((product) => `/products/${product.slug}`);

  // /categories/bouquets and /categories/garlands are rendered on request
  // and always list products; the occasion pages follow the admin's
  // assignments and are listed by the live sitemap-occasions.xml.
  // The garland listing, its flower collections and the garland guide follow
  // garland publication, so the live sitemap-garlands.xml lists them. No
  // <lastmod> for these: prebuilt pages carry no reliable modification date.
  const paths = [...staticPages.filter((path) => !NOINDEX_STATIC_PAGES.has(path)), "/categories/bouquets", ...categoryPaths, ...productPaths];

  // The city directory and the published city pages only: a city without a
  // page has no URL to list. Their <lastmod> is the date their content was
  // last written (src/data/cityHubs.ts), not the time of the build.
  const hubs = publishedHubs().flatMap((city) => {
    const hub = cityHub(city.slug);
    const path = hubPath(city);
    return hub && path ? [{ path, lastmod: hub.updated }] : [];
  });
  const latest = CITY_HUBS.map((hub) => hub.updated).sort().at(-1);
  const cityEntries = [{ path: LOCATIONS_PATH, lastmod: latest }, ...hubs];

  const urlEntries = [
    ...paths.map((path) => `  <url><loc>${new URL(path, site).toString()}</loc></url>`),
    ...cityEntries.map(({ path, lastmod }) => `  <url><loc>${new URL(path, site).toString()}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`),
  ].join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
