// Storefront-context area selection — Simple Area Selection milestone.
// Deliberately as thin as src/utils/cart.ts: a plain localStorage string,
// same "typeof window" guard and try/catch defensiveness, same
// dispatch-a-custom-event-for-same-page-reactivity pattern
// (fresh-petals-cart-updated -> fresh-petals-area-updated here). This is
// UNTRUSTED presentation state — the actual delivery decision always
// comes from the server-side Delivery Capability Engine via
// /api/delivery/check, never from this value. See DeliveryService's
// listAreas() header comment for the same point from the read side.

import { STOREFRONT_CITY } from "../config/storefront";

// Scoped to the storefront city: an area a visitor picked under the old
// Hyderabad storefront (stored under the unscoped key) must not resurface
// here as "Delivering to <Hyderabad area>".
const AREA_KEY = `fresh_petals_selected_area:${STOREFRONT_CITY.toLowerCase()}`;
export const AREA_UPDATED_EVENT = "fresh-petals-area-updated";

export function getSelectedArea(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(AREA_KEY);
  } catch {
    return null;
  }
}

export function setSelectedArea(area: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(AREA_KEY, area);
  } catch {
    // localStorage unavailable (private browsing, storage disabled, etc.)
    // — the storefront must keep working without persistence rather than
    // throw. The click still visually selects the area for this page
    // view; it just won't survive navigation.
  }

  window.dispatchEvent(new CustomEvent(AREA_UPDATED_EVENT, { detail: { area } }));
}
