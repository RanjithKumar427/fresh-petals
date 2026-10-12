import type { APIRoute } from "astro";
import { isListedGarland, loadGarlands } from "../data/garlands";
import { garlandCacheHeaders } from "../server/services/GarlandWebsite";
import { GARLANDS_PATH, GARLAND_GUIDE_PATH, populatedCollections } from "../data/garlandCollections";

// The garland part of the sitemap, rendered on request so a garland published
// or unpublished in the admin is added or removed without a deployment.
// Listed next to sitemap.xml in robots.txt. Only public designs (never a
// local-preview draft) are included, with the pages that list them: the
// garland listing, each flower collection that currently has a design, and
// the garland guide. <lastmod> is the admin's last save: a design's own, and
// for a listing the latest among the designs it shows.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const garlands = (await loadGarlands()).filter((product) => isListedGarland(product.garland));
  const day = (version: string | null | undefined) => (version ? version.slice(0, 10) : "");
  const latest = (items: typeof garlands) => items.map((product) => day(product.version)).sort().at(-1) ?? "";
  const entry = (path: string, date: string) => `  <url><loc>${new URL(path, site ?? url).toString()}</loc>${date ? `<lastmod>${date}</lastmod>` : ""}</url>`;
  const listings = garlands.length
    ? [
        entry(GARLANDS_PATH, latest(garlands)),
        ...populatedCollections(garlands).map(({ collection }) => entry(collection.path, latest(garlands.filter((product) => product.garland.filters.includes(collection.key))))),
        entry(GARLAND_GUIDE_PATH, ""),
      ]
    : [];
  const entries = [...listings, ...garlands.map((product) => entry(`/products/${product.slug}`, day(product.version)))].join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", ...garlandCacheHeaders() },
  });
};
