import type { APIRoute } from "astro";
import { OCCASION_PAGES } from "../data/occasionPages";
import { catalogueSlugs, occasionPageProducts } from "../data/occasionJourneys";
import { NOINDEX_OCCASION_SLUGS } from "../data/seoLanding";
import { loadOccasionMembership } from "../server/services/OccasionMembership";
import { OCCASION_INDEX_TAG, occasionCacheHeaders } from "../server/services/GarlandWebsite";

// The occasion pages, rendered on request from the admin's occasion
// assignments (src/pages/occasions/[slug].astro). A page is listed only while
// it lists products — the same rule that decides whether the page itself is
// indexable (OccasionPage.astro). Listed in robots.txt next to sitemap.xml.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const membership = await loadOccasionMembership(catalogueSlugs());
  const entries = OCCASION_PAGES.filter((occasion) => !NOINDEX_OCCASION_SLUGS.has(occasion.slug) && occasionPageProducts(occasion, membership).length > 0)
    .map((occasion) => `  <url><loc>${new URL(`/occasions/${occasion.slug}`, site ?? url).toString()}</loc></url>`)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", ...occasionCacheHeaders([OCCASION_INDEX_TAG]) } });
};
