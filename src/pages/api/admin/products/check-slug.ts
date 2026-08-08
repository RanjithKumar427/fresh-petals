import type { APIRoute } from "astro";
import { ProductService } from "../../../../server/services/ProductService";
import { json } from "../../../../server/http/json";

export const prerender = false;

/** Powers the Basic Information slug field's live "already taken" check + alternative suggestions. */
export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get("slug") ?? "";
  const excludeId = url.searchParams.get("excludeId");

  if (!slug) return json({ ok: true, data: { available: true, suggestions: [] } });

  const result = ProductService.checkSlug(slug, excludeId ? Number(excludeId) : undefined);
  return json({ ok: true, data: result });
};
