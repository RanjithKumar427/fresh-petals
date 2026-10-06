import type { APIRoute } from "astro";
import { isListedGarland, loadGarlands } from "../data/garlands";
import { garlandCacheHeaders } from "../server/services/GarlandWebsite";

// The garland part of the sitemap, rendered on request so a garland published
// or unpublished in the admin is added or removed without a deployment.
// Listed next to sitemap.xml in robots.txt. Only public designs (never a
// local-preview draft) are included. /categories/garlands itself is in the
// prebuilt sitemap.xml.
export const prerender = false;

export const GET: APIRoute = async ({ site, url }) => {
  const garlands = (await loadGarlands()).filter((product) => isListedGarland(product.garland));
  const entries = garlands
    .map((product) => {
      const lastmod = product.version ? `<lastmod>${product.version.slice(0, 10)}</lastmod>` : "";
      return `  <url><loc>${new URL(`/products/${product.slug}`, site ?? url).toString()}</loc>${lastmod}</url>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", ...garlandCacheHeaders() },
  });
};
