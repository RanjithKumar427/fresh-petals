// The recipient city of the order: one normalised value (a registry slug),
// kept in one place. Product drafts, the basket and its draft all read it
// from here, so they can never name different cities.
//
// Two ideas are kept apart:
//   browsing     the city of the page being looked at: a city hub, or a shop
//                link opened with ?city=<slug>. Looking is not deciding, and
//                it never sets the destination: the page offers that city as
//                a choice instead (DestinationCity.astro).
//   destination  where the order is going. Only an explicit choice by the
//                customer sets it (the selector, or a button that names the
//                city). It is stored with a confirmation mark; a value saved
//                without one (an older site that adopted the browsed city by
//                itself) is not treated as chosen and is cleared.
//
// Every product WhatsApp enquiry needs this value (src/utils/productEnquiry.ts).
//
// Presentation state only. It asks for no pincode and promises nothing: the
// address, date, availability and charges are confirmed on WhatsApp.
import { CITY_PARAM, cityName, normalizeCity } from "../data/serviceCities";

const DESTINATION_KEY = "fresh_petals_destination_city";
/** The explicit choice itself; written only by setDestination. */
const CONFIRMED_KEY = "fresh_petals_destination_confirmed";
export const DESTINATION_UPDATED_EVENT = "fresh-petals-destination-updated";
// Storage unavailable (private mode, blocked): the choice lasts for this page.
let memoryDestination: string | null = null;

/**
 * The order's recipient city (registry slug), or null. Only an explicitly
 * chosen, known city counts. The confirmed key is the record of that
 * choice (one write, so another tab never sees half of a change); the
 * plain key mirrors it for the basket and analytics scripts. A plain value
 * with no confirmed choice (an older site adopted the browsed city by
 * itself) or an unknown value reads as null and is cleared.
 */
export function getDestination(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const confirmed = normalizeCity(window.localStorage.getItem(CONFIRMED_KEY));
    if (confirmed) {
      if (window.localStorage.getItem(CONFIRMED_KEY) !== confirmed) window.localStorage.setItem(CONFIRMED_KEY, confirmed);
      if (window.localStorage.getItem(DESTINATION_KEY) !== confirmed) window.localStorage.setItem(DESTINATION_KEY, confirmed);
      return confirmed;
    }
    window.localStorage.removeItem(CONFIRMED_KEY);
    window.localStorage.removeItem(DESTINATION_KEY);
    return null;
  } catch {
    return memoryDestination;
  }
}

/** An explicit choice by the customer. An unknown value clears the destination. */
export function setDestination(value: string | null): string | null {
  if (typeof window === "undefined") return null;
  const slug = normalizeCity(value);
  memoryDestination = slug;
  try {
    if (slug) {
      window.localStorage.setItem(CONFIRMED_KEY, slug);
      window.localStorage.setItem(DESTINATION_KEY, slug);
    } else {
      window.localStorage.removeItem(CONFIRMED_KEY);
      window.localStorage.removeItem(DESTINATION_KEY);
    }
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

export type DestinationState = {
  destination: string | null;
  browsing: string | null;
  /** The chosen city differs from the city this page is about: the page asks. */
  conflict: boolean;
  /** Nothing chosen yet and the page is about a city: the page offers it. */
  suggest: boolean;
};

/** Where the order stands on this page. Never changes the destination. */
export function resolveDestination(): DestinationState {
  const browsing = browsingCity();
  const destination = getDestination();
  return { destination, browsing, conflict: Boolean(browsing && destination && browsing !== destination), suggest: Boolean(browsing && !destination) };
}

// Another tab changed the choice: this page follows it rather than keep a stale city.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== CONFIRMED_KEY && event.key !== null) return;
    window.dispatchEvent(new CustomEvent(DESTINATION_UPDATED_EVENT, { detail: { city: getDestination() } }));
  });
}

/** Draft line naming the recipient city, or nothing when none is chosen. */
export function destinationLines(slug: string | null = getDestination()): string[] {
  const name = cityName(slug);
  return name ? [`Recipient city: ${name}`] : [];
}

export { cityName };
