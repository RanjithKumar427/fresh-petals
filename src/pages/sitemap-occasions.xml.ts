import type { APIRoute } from "astro";
import { OCCASION_PAGES } from "../data/occasionPages";
import { occasionIndexable } from "../data/occasionJourneys";
import { loadPublicCatalogue } from "../server/services/PublicCatalogue";
import { isListedGarland, loadGarlands } from "../data/garlands";
import { loadOccasionMembership } from "../server/services/OccasionMembership";
import { GARLAND_CACHE_TAG, OCCASION_INDEX_TAG, occasionCacheHeaders } from "../server/services/GarlandWebsite";

// The occasion pages, rendered on request from the admin's occasion
// assignments (src/pages/occasions/[slug].astro). A page is listed only while
// it lists products — the same rule that decides whether the page itself is
// indexable (OccasionPage.astro), shared with the /occasions directory
// (occasionIndexable). Listed in robots.txt next to sitemap.xml.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const publicCatalogue = await loadPublicCatalogue();
  const membership = await loadOccasionMembership(publicCatalogue.map((product) => product.slug));
  // The same rule as the page's own robots tag (OccasionPage.astro).
  const garlands = (await loadGarlands()).filter((product) => isListedGarland(product.garland));
  const entries = OCCASION_PAGES.filter((occasion) => occasionIndexable(occasion, membership, publicCatalogue, garlands))
    .map((occasion) => `  <url><loc>${new URL(`/occasions/${occasion.slug}`, site ?? url).toString()}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", ...occasionCacheHeaders([OCCASION_INDEX_TAG, GARLAND_CACHE_TAG]) } });
};
