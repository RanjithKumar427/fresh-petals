import type { APIRoute } from "astro";
import { InquiryService } from "../../server/services/InquiryService";
import { json } from "../../server/http/json";

export const prerender = false;

// Deliberately public — not under /api/admin, so src/middleware.ts's admin
// session guard never applies here. Per the Phase 3 charter, the storefront
// requires no authentication anywhere; this is the one write path a
// signed-out customer reaches, called fire-and-forget right as a WhatsApp
// order message is generated (see cart.astro / ProductOptions.astro). It
// only ever creates a row — no read, update, or delete is exposed publicly,
// so this can't be used to browse or tamper with other customers' inquiries.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "Invalid request body." }, 400);

  const result = await InquiryService.create(body);
  return json(result, result.ok ? 201 : 400);
};
