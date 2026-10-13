// The recipient city of the order: one normalised value (a registry slug),
// kept in one place. Product drafts, the basket and its draft all read it
// from here, so they can never name different cities.
//
// Two ideas are kept apart:
//   browsing     the city of the page being looked at: a city hub, or a shop
//                link opened with ?city=<slug>. Looking is not deciding.
//   destination  where the order is going. It changes only when the customer
//                picks a city, or when browsing a city with nothing decided
//                yet (no destination, or an empty basket). A basket that
//                already has a destination is never re-pointed by a visit:
//                the page asks instead (DestinationCity.astro).
//
// Presentation state only. It asks for no pincode and promises nothing: the
// address, date, availability and charges are confirmed on WhatsApp.
import { CITY_PARAM, cityName, normalizeCity } from "../data/serviceCities";

const DESTINATION_KEY = "fresh_petals_destination_city";
const CART_KEY = "fresh_petals_cart";
export const DESTINATION_UPDATED_EVENT = "fresh-petals-destination-updated";

/** The order's recipient city (registry slug), or null. An unknown stored value reads as null. */
export function getDestination(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeCity(window.localStorage.getItem(DESTINATION_KEY));
  } catch {
    return null;
  }
}

/** An explicit choice by the customer. An unknown value clears the destination. */
export function setDestination(value: string | null): string | null {
  if (typeof window === "undefined") return null;
  const slug = normalizeCity(value);
  try {
    if (slug) window.localStorage.setItem(DESTINATION_KEY, slug);
    else window.localStorage.removeItem(DESTINATION_KEY);
  } catch {
    // Storage unavailable: the page keeps working, the choice just does not persist.
  }
  window.dispatchEvent(new CustomEvent(DESTINATION_UPDATED_EVENT, { detail: { city: slug } }));
  return slug;
}

/** The city of the page in view: ?city=<slug>, else the page's own city (a hub). Invalid values are ignored. */
export function browsingCity(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = normalizeCity(new URLSearchParams(window.location.search).get(CITY_PARAM));
  return fromUrl ?? normalizeCity(document.querySelector<HTMLElement>("[data-city-context]")?.dataset.cityContext);
}

function basketHasItems(): boolean {
  try {
    const items = JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(items) && items.length > 0;
  } catch {
    return false;
  }
}

export type DestinationState = {
  destination: string | null;
  browsing: string | null;
  /** A basket is already going to another city: ask before changing it. */
  conflict: boolean;
};

/**
 * Called once per page. Adopts the browsed city as the destination only when
 * nothing is decided yet; otherwise leaves the destination alone and reports
 * the difference so the page can ask.
 */
export function resolveDestination(): DestinationState {
  const browsing = browsingCity();
  let destination = getDestination();
  if (browsing && browsing !== destination && (!destination || !basketHasItems())) destination = setDestination(browsing);
  return { destination, browsing, conflict: Boolean(browsing && destination && browsing !== destination) };
}

/** Draft line naming the recipient city, or nothing when none is chosen. */
export function destinationLines(slug: string | null = getDestination()): string[] {
  const name = cityName(slug);
  return name ? [`Recipient city: ${name}`] : [];
}

export { cityName };
