import type { APIRoute } from "astro";
import { OCCASION_PAGES } from "../data/occasionPages";
import { occasionPageProducts } from "../data/occasionJourneys";
import { loadPublicCatalogue } from "../server/services/PublicCatalogue";
import { CEREMONY_INDEXABLE_OCCASIONS, NOINDEX_OCCASION_SLUGS } from "../data/seoLanding";
import { isListedGarland, loadGarlands } from "../data/garlands";
import { loadOccasionMembership } from "../server/services/OccasionMembership";
import { GARLAND_CACHE_TAG, OCCASION_INDEX_TAG, occasionCacheHeaders } from "../server/services/GarlandWebsite";

// The occasion pages, rendered on request from the admin's occasion
// assignments (src/pages/occasions/[slug].astro). A page is listed only while
// it lists products — the same rule that decides whether the page itself is
// indexable (OccasionPage.astro). Listed in robots.txt next to sitemap.xml.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const publicCatalogue = await loadPublicCatalogue();
  const membership = await loadOccasionMembership(publicCatalogue.map((product) => product.slug));
  // The same rule as the page's own robots tag (OccasionPage.astro).
  const garlands = (await loadGarlands()).filter((product) => isListedGarland(product.garland));
  const ceremony = (slug: string) => CEREMONY_INDEXABLE_OCCASIONS.has(slug) && garlands.some((product) => product.occasionTags?.includes(slug));
  const entries = OCCASION_PAGES.filter((occasion) => !NOINDEX_OCCASION_SLUGS.has(occasion.slug) && (occasionPageProducts(occasion, membership, publicCatalogue).length > 0 || ceremony(occasion.slug)))
    .map((occasion) => `  <url><loc>${new URL(`/occasions/${occasion.slug}`, site ?? url).toString()}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", ...occasionCacheHeaders([OCCASION_INDEX_TAG, GARLAND_CACHE_TAG]) } });
};
