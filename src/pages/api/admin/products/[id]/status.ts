import type { APIRoute } from "astro";
import { ProductService } from "../../../../../server/services/ProductService";
import { json } from "../../../../../server/http/json";
import { BODY_LIMITS, jsonBody } from "../../../../../server/http/body";
import { garlandWebsiteChange } from "../../../../../server/services/GarlandWebsite";

export const prerender = false;

const VALID_STATUSES = new Set(["draft", "published", "archived"]);

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const body = await jsonBody(request, BODY_LIMITS.adminJson);
  if (body instanceof Response) return body;
  if (!VALID_STATUSES.has(body.status)) {
    return json({ ok: false, error: "Invalid status." }, 400);
  }

  const before = await ProductService.get(id);
  const result = await ProductService.setStatus(id, body.status);
  if (!result.ok) return json(result, 400);
  // Publishing or unpublishing a garland refreshes the live website.
  const website = await garlandWebsiteChange(before, result.data);
  return json(website ? { ...result, website } : result, 200);
};
