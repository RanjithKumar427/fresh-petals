// Which occasions each bouquet belongs to, as assigned in the admin
// ("Suitable occasions" → product_occasions). The database is the source of
// truth: a product with no rows has no occasions — a cleared assignment is
// never refilled from the catalogue's original tags. Read fresh on every call;
// the live pages that use it are CDN-cached and purged when an assignment
// changes (src/server/services/GarlandWebsite.ts, occasion tags).
import { inArray, eq } from "drizzle-orm";
import { getDb } from "../db/postgres/client";
import { occasions, productOccasions, products } from "../db/postgres/schema";

/** slug → assigned occasion slugs (sorted). Slugs without a product row map to []. */
export async function loadOccasionMembership(slugs: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>(slugs.map((slug) => [slug, []]));
  if (slugs.length === 0) return result;
  const rows = await getDb()
    .select({ slug: products.slug, occasion: occasions.slug })
    .from(productOccasions)
    .innerJoin(products, eq(products.id, productOccasions.productId))
    .innerJoin(occasions, eq(occasions.id, productOccasions.occasionId))
    .where(inArray(products.slug, slugs));
  for (const row of rows) result.get(row.slug)?.push(row.occasion);
  for (const list of result.values()) list.sort();
  return result;
}

/** Occasion slugs for ids (for working out which occasions an edit touched). */
export async function occasionSlugsForIds(ids: number[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await getDb().select({ slug: occasions.slug }).from(occasions).where(inArray(occasions.id, ids));
  return rows.map((row) => row.slug).sort();
}
