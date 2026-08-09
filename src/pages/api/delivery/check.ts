import type { APIRoute } from "astro";
import { DeliveryService } from "../../../server/services/delivery/DeliveryService";
import {
  deliveryServiceabilitySchema,
  deliveryListSchema,
  deliveryCheckSchema,
} from "../../../server/validation/deliverySchema";
import { json } from "../../../server/http/json";

export const prerender = false;

// Deliberately public — not under /api/admin. Serviceability/fee/promise
// checking is inherently a public storefront operation with no PII
// involved (just a pincode and, optionally, a date), and the exact same
// data already ships fully exposed in every page's public JS bundle
// today via src/data/serviceAreas.ts — this endpoint doesn't reduce that
// exposure, it just makes the *decision* authoritative instead of
// reimplemented three times client-side. See the Delivery Capability
// report.
//
// Three request shapes, matching the three genuinely different questions
// the charter's own model distinguishes (Serviceability / Capability /
// Promise — see DeliveryService.checkServiceability's comment):
//   { pincode }                                -> serviceability only
//   { pincode, deliveryDate }                   -> all four methods
//   { pincode, deliveryDate, method }           -> one method (revalidation)
//
// If the engine can't reach the database (or fails for any other
// infrastructure reason), we must not let that surface as a raw 500 that
// the caller might mistake for "unavailable" and silently ignore, nor
// let it crash the WhatsApp flow. Every response comes back explicitly
// "not available/serviceable" with a message that's honest about *why*
// — asking the customer to continue on WhatsApp — rather than
// fabricating a promise the engine was never actually able to confirm.
const INFRA_FAILURE_MESSAGE =
  "We couldn't confirm delivery availability right now. Please continue on WhatsApp and we'll confirm availability.";

function failClosedMethods(methods: string[], reason: string) {
  return json({
    ok: true,
    data: methods.map((method) => ({ available: false, method, label: method, reason })),
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "Invalid request body." }, 400);

  if (body.deliveryDate === undefined) {
    const parsed = deliveryServiceabilitySchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
    }
    try {
      const result = await DeliveryService.checkServiceability(parsed.data.pincode);
      return json({ ok: true, data: result });
    } catch {
      return json({ ok: true, data: { serviceable: false } });
    }
  }

  if (body.method !== undefined) {
    const parsed = deliveryCheckSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
    }
    try {
      const result = await DeliveryService.checkMethod(parsed.data);
      return json({ ok: true, data: [result] });
    } catch {
      return failClosedMethods([parsed.data.method], INFRA_FAILURE_MESSAGE);
    }
  }

  const parsed = deliveryListSchema.safeParse(body);
  if (!parsed.success) {
    return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }
  try {
    const results = await DeliveryService.listMethods(parsed.data);
    return json({ ok: true, data: results });
  } catch {
    return failClosedMethods(["MORNING", "AFTERNOON", "EVENING", "EXPRESS"], INFRA_FAILURE_MESSAGE);
  }
};
