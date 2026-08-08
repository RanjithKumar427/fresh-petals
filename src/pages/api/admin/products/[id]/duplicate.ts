import type { APIRoute } from "astro";
import { ProductService } from "../../../../../server/services/ProductService";
import { json } from "../../../../../server/http/json";

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const result = ProductService.duplicate(id);
  return json(result, result.ok ? 201 : 400);
};
