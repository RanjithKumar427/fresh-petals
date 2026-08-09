import type { APIRoute } from "astro";
import { InquiryService } from "../../../../server/services/InquiryService";
import { json } from "../../../../server/http/json";

export const prerender = false;

// Under /api/admin — auto-protected by src/middleware.ts's admin session
// guard, same as every other admin route. No filtering/pagination: this is
// a simple inbox, not a report builder, and the business hasn't produced
// enough volume yet to need either — add them when real usage asks for it.
export const GET: APIRoute = async () => {
  const inquiries = await InquiryService.list();
  return json({ ok: true, data: inquiries });
};
