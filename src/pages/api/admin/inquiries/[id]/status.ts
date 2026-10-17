import type { APIRoute } from "astro";
import { InquiryService } from "../../../../../server/services/InquiryService";
import { json } from "../../../../../server/http/json";
import { BODY_LIMITS, jsonBody } from "../../../../../server/http/body";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ ok: false, error: "Invalid id." }, 400);

  const body = await jsonBody(request, BODY_LIMITS.adminJson);
  if (body instanceof Response) return body;
  const result = await InquiryService.updateStatus(id, body.status);
  return json(result, result.ok ? 200 : 400);
};
