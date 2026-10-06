import type { APIRoute } from "astro";
import { ProductService } from "../../../../../server/services/ProductService";
import { json } from "../../../../../server/http/json";
import { checkGarlandOnWebsite } from "../../../../../server/services/GarlandWebsite";
import { GARLAND_PREVIEW } from "../../../../../data/garlandRules";

export const prerender = false;

/**
 * Is this garland's saved version what the website shows right now? The
 * editor polls this after a save until the answer is yes. The page is fetched
 * from the same address the admin is using (or SITE_CHECK_ORIGIN), so the
 * answer comes through the same CDN cache visitors get.
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const product = await ProductService.get(id);
  if (!product) return json({ ok: false, error: "Product not found." }, 404);
  if (!product.garland) return json({ ok: false, error: "Only garlands are checked on the live website." }, 400);

  const origin = process.env.SITE_CHECK_ORIGIN || url.origin;
  const data = await checkGarlandOnWebsite(product, origin, GARLAND_PREVIEW);
  return json({ ok: true, data });
};
