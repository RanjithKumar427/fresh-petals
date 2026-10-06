import type { APIRoute } from "astro";
import { productCatalog, type Product } from "../data/productCatalog";
import { getStaticPaths as getCategoryStaticPaths } from "./categories/[slug].astro";
import { getStaticPaths as getOccasionStaticPaths } from "./occasions/[slug].astro";
import { NOINDEX_CATEGORY_SLUGS, NOINDEX_OCCASION_SLUGS } from "../data/seoLanding";

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
// categories/occasions and the NOINDEX_* slugs in src/data/seoLanding.ts
// are left out; occasion pages (birthday, anniversary, …) were previously
// missing entirely and are now included.
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
    .filter((entry) => hasPublicProducts(entry.props.products) && !NOINDEX_CATEGORY_SLUGS.has(entry.params.slug))
    .map((entry) => `/categories/${entry.params.slug}`);
  const occasionPaths = (await getOccasionStaticPaths())
    .filter((entry) => hasPublicProducts(entry.props.products) && !NOINDEX_OCCASION_SLUGS.has(entry.params.slug))
    .map((entry) => `/occasions/${entry.params.slug}`);
  const productPaths = productCatalog.map((product) => `/products/${product.slug}`);

  const paths = [...staticPages, ...categoryPaths, "/categories/garlands", ...occasionPaths, ...productPaths];

  const urlEntries = paths
    .map((path) => `  <url><loc>${new URL(path, site).toString()}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
