// Pure delivery decision logic — Delivery Capability Engine milestone.
// Deliberately has ZERO imports beyond businessTime.ts (also pure, no
// I/O): no DeliveryZoneRepository, no getDb(). This is what makes the
// rules directly unit-testable with a hand-built zone object and a
// controlled `reference` timestamp (see
// scripts/_delivery-engine-test-matrix.mjs) without touching a database
// or going through Astro/Vite's pipeline — DeliveryService.ts (the
// thin I/O layer around this) transitively imports a Vite-only `?raw`
// asset import via getDb() that plain Node can't resolve outside the
// build pipeline (see supabaseCa.ts's own comment on that constraint),
// so anything that needs testing at specific times has to live where
// that import can't reach it.
//
// Only four methods are modeled — MORNING, AFTERNOON, EVENING, EXPRESS —
// because those are the only ones any real FreshPetals configuration
// exists for (see DeliveryZoneRepository / src/data/serviceAreas.ts and
// shipping.astro's policy copy). No EXPRESS_2_HOUR, no MIDNIGHT: adding
// them would mean fabricating a fee, an operating window and a promise
// FreshPetals has never actually offered. If the business defines real
// configuration for either later, they're a straightforward METHOD_META
// entry away — nothing else here needs to change shape to add one.
import { getBusinessNow, formatMinuteOfDay, type BusinessNow } from "./businessTime";

export type DeliveryMethod = "MORNING" | "AFTERNOON" | "EVENING" | "EXPRESS";

export const DELIVERY_METHODS: DeliveryMethod[] = ["MORNING", "AFTERNOON", "EVENING", "EXPRESS"];

/** The minimum shape evaluateDeliveryMethod needs from a zone — matches DeliveryZoneRepository's DeliveryZone, kept separate so this file has no repository import. */
export type DeliveryZoneLike = {
  area: string;
  city: string;
  deliveryFee: number;
  sameDayAvailable: boolean;
  morningDeliveryAvailable: boolean;
};

export type DeliveryResult =
  | {
      available: true;
      method: DeliveryMethod;
      label: string;
      promise: string;
      deliveryDate: string;
      fee: number;
      area: string;
      city: string;
      reason: null;
    }
  | {
      available: false;
      method: DeliveryMethod;
      label: string;
      reason: string;
    };

type MethodMeta = {
  label: string;
  /** Minutes since local midnight. Fixed slots only — EXPRESS is relative to "now", not a fixed window. */
  window: { startMinute: number; endMinute: number } | null;
};

// Labels match the real, already-shipped copy in shipping.astro's policy
// text. This is the ONE place they're defined — cart.astro and
// DeliveryChecker.astro both import DELIVERY_METHOD_OPTIONS below to
// populate their slot `<select>` instead of hand-writing their own copy
// of this list, so there's exactly one source of truth for what a
// method is called, not three that have to be kept in sync by hand.
const METHOD_META: Record<DeliveryMethod, MethodMeta> = {
  MORNING: { label: "Morning Slot: 7 AM - 10 AM", window: { startMinute: 7 * 60, endMinute: 10 * 60 } },
  AFTERNOON: { label: "Afternoon Slot: 12 PM - 3 PM", window: { startMinute: 12 * 60, endMinute: 15 * 60 } },
  EVENING: { label: "Evening Slot: 5 PM - 8 PM", window: { startMinute: 17 * 60, endMinute: 20 * 60 } },
  EXPRESS: { label: "Express Delivery: Within 4-6 Hours", window: null },
};

/** `{ value, label, method }` for each of the four real methods — what cart.astro/DeliveryChecker.astro render as `<option>`s. `value` matches `label`: the existing WhatsApp message builders use the select's own value as the display text, so keeping them identical preserves that behavior exactly. */
export const DELIVERY_METHOD_OPTIONS: { value: string; label: string; method: DeliveryMethod }[] =
  DELIVERY_METHODS.map((method) => ({
    value: METHOD_META[method].label,
    label: METHOD_META[method].label,
    method,
  }));

/** "Morning Slot: 7 AM - 10 AM" -> "7 AM - 10 AM" — just the time commitment, matching the DeliveryResult.promise contract. */
function windowPromiseText(label: string): string {
  const separatorIndex = label.indexOf(": ");
  return separatorIndex === -1 ? label : label.slice(separatorIndex + 2);
}

/**
 * EXPRESS has no fixed slot to quote, only a relative "within 4-6 hours"
 * — so the promise is computed from the actual request time, not a fixed
 * string. This is a presentation derivation of the real "4-6 hours"
 * copy, not new business data: it never claims anything the business
 * hasn't already committed to (shipping.astro), it just states the
 * specific clock window that promise resolves to right now.
 */
function buildExpressPromise(reference: Date): string {
  const from = getBusinessNow(new Date(reference.getTime() + 4 * 60 * 60 * 1000));
  const to = getBusinessNow(new Date(reference.getTime() + 6 * 60 * 60 * 1000));
  return `Within 4-6 hours (estimated ${formatMinuteOfDay(from.minuteOfDay)}-${formatMinuteOfDay(to.minuteOfDay)})`;
}

/**
 * The one decision function — every method's availability, fee and
 * promise text flows through this. `checkMethod`/`listMethods` in
 * DeliveryService.ts are thin I/O wrappers (fetch the zone, call this);
 * this is what's actually under test.
 */
export function evaluateDeliveryMethod(
  method: DeliveryMethod,
  deliveryDate: string,
  zone: DeliveryZoneLike | null,
  now: BusinessNow,
  reference: Date
): DeliveryResult {
  const meta = METHOD_META[method];
  const unavailable = (reason: string): DeliveryResult => ({ available: false, method, label: meta.label, reason });

  if (deliveryDate < now.isoDate) {
    return unavailable("Please choose today or a future delivery date.");
  }

  if (!zone) {
    return unavailable(
      "We couldn't confirm delivery for this pincode yet. Please continue on WhatsApp and we'll confirm manually."
    );
  }

  const isToday = deliveryDate === now.isoDate;

  if (method === "MORNING") {
    if (!zone.morningDeliveryAvailable) {
      return unavailable(`Morning delivery isn't available in ${zone.area} yet.`);
    }
    if (isToday && now.minuteOfDay >= meta.window!.endMinute) {
      return unavailable(
        "The morning delivery window (7 AM - 10 AM) has already passed for today. Please choose a later slot or a future date."
      );
    }
  } else if (method === "AFTERNOON" || method === "EVENING") {
    if (isToday && now.minuteOfDay >= meta.window!.endMinute) {
      const slotName = method === "AFTERNOON" ? "afternoon" : "evening";
      return unavailable(
        `The ${slotName} delivery window has already passed for today. Please choose a later slot or a future date.`
      );
    }
  } else if (method === "EXPRESS") {
    // Definitional, not an invented business rule: "within 4-6 hours"
    // only means something relative to right now — a future-dated
    // Express request isn't a coherent promise to make.
    if (!isToday) {
      return unavailable("Express delivery is only available for today's date.");
    }
    if (!zone.sameDayAvailable) {
      return unavailable(`Express delivery isn't available in ${zone.area} yet.`);
    }
  }

  return {
    available: true,
    method,
    label: meta.label,
    promise: method === "EXPRESS" ? buildExpressPromise(reference) : windowPromiseText(meta.label),
    deliveryDate,
    fee: zone.deliveryFee,
    area: zone.area,
    city: zone.city,
    reason: null,
  };
}
