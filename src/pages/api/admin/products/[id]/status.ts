import type { APIRoute } from "astro";
import { ProductService } from "../../../../../server/services/ProductService";
import { json } from "../../../../../server/http/json";

export const prerender = false;

const VALID_STATUSES = new Set(["draft", "published", "archived"]);

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const body = await request.json().catch(() => null);
  if (!body || !VALID_STATUSES.has(body.status)) {
    return json({ ok: false, error: "Invalid status." }, 400);
  }

  const result = ProductService.setStatus(id, body.status);
  return json(result, result.ok ? 200 : 400);
};
