import type { APIRoute } from "astro";
import { ProductService } from "../../../../server/services/ProductService";
import { json } from "../../../../server/http/json";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const product = await ProductService.get(id);
  if (!product) return json({ ok: false, error: "Product not found." }, 404);
  return json({ ok: true, data: product });
};

/** Autosave and explicit "Save" both land here — the editor always sends the full current draft (see ProductEditor). */
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const body = await request.json();
  const result = await ProductService.update(id, body);
  return json(result, result.ok ? 200 : 400);
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const result = await ProductService.remove(id);
  return json(result, result.ok ? 200 : 400);
};
