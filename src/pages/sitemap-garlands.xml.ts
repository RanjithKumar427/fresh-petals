import type { APIRoute } from "astro";
import { isListedGarland, loadGarlands } from "../data/garlands";
import { garlandCacheHeaders } from "../server/services/GarlandWebsite";
import { GARLANDS_PATH, GARLAND_GUIDE_PATH, populatedCollections } from "../data/garlandCollections";
import { IMAGE_SITEMAP_NS, garlandImages, urlEntry } from "../data/imageSitemap";

// The garland part of the sitemap, rendered on request so a garland published
// or unpublished in the admin is added or removed without a deployment.
// Listed next to sitemap.xml in robots.txt. Only public designs (never a
// local-preview draft) are included, with the pages that list them: the
// garland listing, each flower collection that currently has a design, and
// the garland guide. <lastmod> is the admin's last save: a design's own, and
// for a listing the latest among the designs it shows. Each design's entry
// also lists its main photograph and confirmed gallery (never related-view
// candidates), so a photograph changed in the admin follows the same save.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const garlands = (await loadGarlands()).filter((product) => isListedGarland(product.garland));
  const day = (version: string | null | undefined) => (version ? version.slice(0, 10) : "");
  const latest = (items: typeof garlands) => items.map((product) => day(product.version)).sort().at(-1) ?? "";
  // A design's page lists its main photograph and confirmed gallery; listings list none.
  const entry = (path: string, date: string, images: string[] = []) => urlEntry(new URL(path, site ?? url).toString(), { lastmod: date, images, site: site ?? url });
  const listings = garlands.length
    ? [
        entry(GARLANDS_PATH, latest(garlands)),
        ...populatedCollections(garlands).map(({ collection }) => entry(collection.path, latest(garlands.filter((product) => product.garland.filters.includes(collection.key))))),
        entry(GARLAND_GUIDE_PATH, ""),
      ]
    : [];
  const entries = [...listings, ...garlands.map((product) => entry(`/products/${product.slug}`, day(product.version), garlandImages(product.garland)))].join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ${IMAGE_SITEMAP_NS}>
${entries}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", ...garlandCacheHeaders() },
  });
};
