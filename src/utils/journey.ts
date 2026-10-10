// Explicit shopping context travels in product links and on each basket
// item. An unfiltered visit never inherits another item's context. Product
// canonicals stay unchanged; later customer choices take precedence.
import { OCCASION_FILTER_LABELS } from "../data/shoppingTaxonomy";
export type Journey = {
  occasion: string;
  occasionLabel: string;
  intent: "gift" | "ceremony";
  intentLabel: string;
  from: string;
  at: number;
};

export function makeJourney(occasions: string[], intent: "gift" | "ceremony", from = ""): Journey | null {
  const known = [...new Set(occasions.filter((key) => Object.hasOwn(OCCASION_FILTER_LABELS, key)))];
  if (!known.length) return null;
  return { occasion: known.join(","), occasionLabel: known.map((key) => OCCASION_FILTER_LABELS[key]).join(" · "), intent,
    intentLabel: intent === "gift" ? "A gift" : "For the ceremony", from: from.startsWith("/") && !from.startsWith("//") ? from : "", at: Date.now() };
}
export function journeyFromParams(params: URLSearchParams): Journey | null {
  return makeJourney((params.get("occ") ?? "").split(","), params.get("for") === "ceremony" ? "ceremony" : "gift", params.get("from") ?? "");
}
export function journeyHref(pathname: string, journey: Journey | null): string {
  if (!journey) return pathname;
  const params = new URLSearchParams({ occ: journey.occasion, for: journey.intent });
  if (journey.from) params.set("from", journey.from);
  return `${pathname}?${params}`;
}

export function readJourney(): Journey | null {
  // Context belongs to the opened link, never an unrelated session visit.
  return typeof location === "undefined" ? null : journeyFromParams(new URLSearchParams(location.search));
}

export function clearJourney(): void {
  try {
    sessionStorage.removeItem("fp-journey");
  } catch {}
  const url = new URL(location.href);
  for (const key of ["occ", "for", "from"]) url.searchParams.delete(key);
  history.replaceState(history.state, "", url);
}

/** "Birthday — a gift" style line for WhatsApp messages. */
export function journeyLines(journey: Journey | null): string[] {
  if (!journey) return [];
  return [`${journey.occasion.includes(",") ? "Occasions" : "Occasion"}: ${journey.occasionLabel}`, `For: ${journey.intentLabel}`];
}
