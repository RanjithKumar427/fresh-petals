// The ONE authoritative delivery calculation — Delivery Capability
// Engine milestone. Before this, the exact same decision ("is this
// pincode/slot/date combination deliverable, and what does it cost?")
// was independently reimplemented in three places: cart.astro,
// DeliveryChecker.astro, and ProductOptions.astro — all reading the same
// static src/data/serviceAreas.ts array and re-deriving the same rules
// inline. This service is what all three (and the WhatsApp message, and
// the inquiry record) now call instead. See the Delivery Capability
// report's Pre-Implementation Audit for the full before/after.
//
// Thin on purpose: the actual decision logic (cutoffs, fees, promise
// text) lives in deliveryRules.ts as a pure function with no I/O — this
// file's only job is fetching the zone and handing it to that function.
// See deliveryRules.ts's header for why that split exists.
import { DeliveryZoneRepository } from "../../db/repositories/DeliveryZoneRepository";
import { getBusinessNow } from "./businessTime";
import {
  evaluateDeliveryMethod,
  DELIVERY_METHODS,
  DELIVERY_METHOD_OPTIONS,
  type DeliveryMethod,
  type DeliveryResult,
} from "./deliveryRules";

export { DELIVERY_METHODS, DELIVERY_METHOD_OPTIONS, evaluateDeliveryMethod };
export type { DeliveryMethod, DeliveryResult };

export type ServiceabilityResult =
  | { serviceable: true; area: string; city: string; fee: number }
  | { serviceable: false };

export const DeliveryService = {
  /**
   * The single source of truth for one method. Every caller — the check
   * API, the pre-WhatsApp revalidation, the inquiry record — goes
   * through this or `listMethods`. `reference` defaults to the real
   * current instant; tests pass a fixed Date to exercise specific times
   * without depending on when the test runs.
   */
  async checkMethod(
    input: { pincode: string; deliveryDate: string; method: DeliveryMethod },
    reference: Date = new Date()
  ): Promise<DeliveryResult> {
    const now = getBusinessNow(reference);
    const zone = await DeliveryZoneRepository.findByPincode(input.pincode);
    return evaluateDeliveryMethod(input.method, input.deliveryDate, zone, now, reference);
  },

  /**
   * All four methods' results for one pincode/date — what the customer
   * UI shows as available options. One zone lookup, not four: the
   * pincode is the same for all four methods, so there is nothing
   * method-specific about the fetch itself.
   */
  async listMethods(
    input: { pincode: string; deliveryDate: string },
    reference: Date = new Date()
  ): Promise<DeliveryResult[]> {
    const now = getBusinessNow(reference);
    const zone = await DeliveryZoneRepository.findByPincode(input.pincode);
    return DELIVERY_METHODS.map((method) => evaluateDeliveryMethod(method, input.deliveryDate, zone, now, reference));
  },

  /**
   * SERVICEABILITY only — "can FreshPetals serve this location at all?"
   * Deliberately separate from checkMethod/listMethods, which answer the
   * different question of CAPABILITY/PROMISE ("which methods, with what
   * cutoffs, right now"). A caller that only has a pincode — no delivery
   * date, no method, e.g. ProductOptions.astro's live "as you type your
   * pincode" status line — should get a serviceability answer, not a
   * date/time-gated one; conflating the two would make a pincode that's
   * genuinely serviceable read as "unavailable" any time a fixed slot's
   * cutoff has passed today, which is a different fact entirely.
   */
  async checkServiceability(pincode: string): Promise<ServiceabilityResult> {
    const zone = await DeliveryZoneRepository.findByPincode(pincode);
    if (!zone) return { serviceable: false };
    return { serviceable: true, area: zone.area, city: zone.city, fee: zone.deliveryFee };
  },

  /**
   * Distinct area names only — storefront browsing context for the
   * Simple Area Selection milestone's homepage selector. Not a
   * serviceability or capability answer; see DeliveryZoneRepository's
   * `listAreas()` for why it deliberately returns nothing more than
   * names.
   */
  async listAreas(): Promise<string[]> {
    return DeliveryZoneRepository.listAreas();
  },
};
