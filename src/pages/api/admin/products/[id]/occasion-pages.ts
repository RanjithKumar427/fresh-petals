import type { APIRoute } from "astro";
import { ProductService } from "../../../../../server/services/ProductService";
import { json } from "../../../../../server/http/json";
import { checkOccasionPages } from "../../../../../server/services/OccasionWebsite";
import { occasionSlugsForIds } from "../../../../../server/services/OccasionMembership";
import { LIVE_OCCASION_ROUTES } from "../../../../../data/occasionJourneys";

export const prerender = false;

/**
 * Do the live occasion pages list this bouquet exactly as its saved
 * occasions say? The editor polls this after an occasion change until they
 * do. Pages are fetched from the address the admin is using (or
 * SITE_CHECK_ORIGIN), so the answer comes through the same CDN cache
 * visitors get. ?routes=birthday,anniversary limits the check.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);
  const product = await ProductService.get(id);
  if (!product) return json({ ok: false, error: "Product not found." }, 404);
  if (product.garland) return json({ ok: false, error: "Garland occasions are shown with the garland pages." }, 400);

  const requested = (url.searchParams.get("routes") ?? "").split(",").filter((route) => LIVE_OCCASION_ROUTES.has(route));
  const routes = requested.length ? requested : [...LIVE_OCCASION_ROUTES];
  const assigned = await occasionSlugsForIds(product.occasionIds);
  const origin = process.env.SITE_CHECK_ORIGIN || url.origin;
  const pages = await checkOccasionPages(product, assigned, routes, origin);
  return json({ ok: true, data: { checkedAt: new Date().toISOString(), pages, allOk: pages.every((page) => page.ok) } });
};
