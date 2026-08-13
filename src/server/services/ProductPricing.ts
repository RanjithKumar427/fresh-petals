// Product pricing source-of-truth bridge — Catalog/Database Reconciliation
// milestone. Not a new repository, not a new API, not a pricing engine: a
// thin adapter over the existing ProductRepository that lets every
// storefront consumer of src/data/productCatalog.ts (still the source for
// name/description/images/flowerTypes/etc. — see the architecture audit's
// field-mapping gap findings) get its *displayed price* from PostgreSQL
// instead, without duplicating query logic in 13+ call sites.
//
// Why price only, not a full productCatalog -> Postgres cutover: the
// audit traced the actual Product shape SupabaseProductRepository returns
// (see ProductRepository.ts) against what productCatalog.ts's Product type
// expresses, and found real gaps with no database column at all --
// `badge`, `ratingLabel`, `idealFor`, `careLevel`, `collectionTags`,
// `isSubscription`/`isAddon`, and `longDescription` (distinct from the
// DB's `description`). Every one of those is actively rendered on the
// live product page today. Migrating those fields too would mean either
// silently dropping real, currently-live content, or inventing new schema
// columns -- both explicitly out of scope for this milestone. Pricing
// (`sellingPrice`/`compareAtPrice`/`priceType`) is exactly what the
// database already has, already lets the admin edit, and is the one thing
// this migration is actually about: one number, one source, everywhere a
// customer can see it.
import { ProductRepository } from "../db/repositories/ProductRepository";

export type AuthoritativePrice = {
  priceLabel: string | null;
  sellingPrice: number | null;
  compareAtPrice: number | null;
};

// Module-level cache, not a new caching layer: this file is imported by
// every page/component below, but astro build runs everything in one
// Node process, so a plain module-scoped Map means the *entire* build
// issues exactly one `products` query total, not one per page/section
// (see Phase 20's N+1 concern) -- the same "one query, shared" shape
// list() already gives every other consumer.
let cache: Promise<Map<string, AuthoritativePrice>> | null = null;

function formatPriceLabel(
  priceType: string,
  sellingPrice: number | null
): string | null {
  // Only fixed/from prices have a real number to be authoritative about.
  // market/quote products (and any row with no selling_price set) have no
  // numeric truth in the database to conflict with in the first place --
  // returning null here tells the caller to keep the static catalog's own
  // merchandising copy ("Market price today", "Custom quote", "Ask on
  // WhatsApp", etc.) exactly as before. Nothing invented, nothing dropped.
  if (sellingPrice == null) return null;
  if (priceType === "fixed") return `₹${sellingPrice}`;
  if (priceType === "from") return `From ₹${sellingPrice}`;
  return null;
}

async function loadPriceMap(): Promise<Map<string, AuthoritativePrice>> {
  const rows = await ProductRepository.list();
  const map = new Map<string, AuthoritativePrice>();
  for (const row of rows) {
    map.set(row.slug, {
      priceLabel: formatPriceLabel(row.priceType, row.sellingPrice),
      sellingPrice: row.sellingPrice,
      compareAtPrice: row.compareAtPrice,
    });
  }
  return map;
}

/**
 * Fetches (and caches for the remainder of this build/process) the
 * authoritative price for every product, keyed by slug. Call this once per
 * page/component, before mapping over productCatalog entries.
 */
export function loadAuthoritativePrices(): Promise<Map<string, AuthoritativePrice>> {
  if (!cache) cache = loadPriceMap();
  return cache;
}

/**
 * Returns `product` with its priceLabel replaced by the database's, IF the
 * database has a numeric selling price for it (see formatPriceLabel).
 * Deliberately throws rather than silently keeping the static price when a
 * catalog slug has no matching database row at all -- Phase 19's rule:
 * fail the build clearly, never fabricate a stale fallback. This should
 * never actually trigger today (the audit confirmed 89/89 slugs match),
 * so hitting it means a product was added to one system and not the
 * other, which is exactly the kind of silent divergence this migration
 * exists to prevent.
 */
export function withAuthoritativePrice<T extends { slug: string; priceLabel: string }>(
  product: T,
  priceMap: Map<string, AuthoritativePrice>
): T {
  const authoritative = priceMap.get(product.slug);
  if (!authoritative) {
    throw new Error(
      `No authoritative price found in the database for product slug "${product.slug}". ` +
        `Refusing to fall back to the static catalog price -- add this product to the database, ` +
        `or remove it from productCatalog.ts, before the build can proceed.`
    );
  }
  if (authoritative.priceLabel == null) return product;
  return { ...product, priceLabel: authoritative.priceLabel };
}
