// The prices this deployment publishes: the database's prices as read once at
// build time (src/content.config.ts, "publishedPrices"). Read through
// loadAuthoritativePrices() in ProductPricing.ts, never directly.
import { getCollection } from "astro:content";
import type { AuthoritativePrice } from "./ProductPricing";

export async function publishedPriceMap(): Promise<Map<string, AuthoritativePrice>> {
  const entries = await getCollection("publishedPrices");
  return new Map(entries.map((entry) => [entry.id, entry.data]));
}
