import type { APIRoute } from "astro";
import { InquiryService } from "../../server/services/InquiryService";
import { json } from "../../server/http/json";
import { BODY_LIMITS, bodyErrorResponse, readJson } from "../../server/http/body";

export const prerender = false;

// Deliberately public — not under /api/admin, so src/middleware.ts's admin
// session guard never applies here. Per the Phase 3 charter, the storefront
// requires no authentication anywhere; this is the one write path a
// signed-out customer reaches, called fire-and-forget right as a WhatsApp
// order message is generated (see cart.astro / ProductOptions.astro). It
// only ever creates a row — no read, update, or delete is exposed publicly,
// so this can't be used to browse or tamper with other customers' inquiries.
//
// The response is an acknowledgement only ({ ok: true }): the stored row,
// its id and the customer's details are never echoed back. The body is JSON
// of at most 32 KiB (src/server/http/body.ts); a failure to store it gives
// a generic error and never the database's message.
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await readJson(request, BODY_LIMITS.publicJson);
  } catch (error) {
    return bodyErrorResponse(error);
  }
  if (!body || typeof body !== "object") return json({ ok: false, error: "Invalid request body." }, 400);

  try {
    const result = await InquiryService.create(body);
    if (!result.ok) return json({ ok: false, error: result.error, fieldErrors: result.fieldErrors }, 400);
    return json({ ok: true }, 201);
  } catch {
    return json({ ok: false, error: "We couldn't record this enquiry. Your WhatsApp message is not affected." }, 500);
  }
};
