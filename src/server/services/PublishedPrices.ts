// What this deployment publishes, as read once at build time
// (src/content.config.ts): prices ("publishedPrices"), each product record's
// publication status ("catalogueStatus") and the occasion assignments the
// prebuilt header uses ("occasionAssignments"). Read through
// loadAuthoritativePrices() in ProductPricing.ts and src/server/services/
// PublicCatalogue.ts, never directly.
import { getCollection } from "astro:content";
import type { AuthoritativePrice } from "./ProductPricing";

export async function publishedPriceMap(): Promise<Map<string, AuthoritativePrice>> {
  const entries = await getCollection("publishedPrices");
  return new Map(entries.map((entry) => [entry.id, entry.data]));
}

export async function publishedStatusMap(): Promise<Map<string, string>> {
  const entries = await getCollection("catalogueStatus");
  return new Map(entries.map((entry) => [entry.data.slug, entry.data.status]));
}

export async function publishedOccasionMap(): Promise<Map<string, string[]>> {
  const entries = await getCollection("occasionAssignments");
  return new Map(entries.map((entry) => [entry.id, [...entry.data.occasions]]));
}
