// Garland records as edited in the admin dashboard. Garland pages are
// rendered on request (see src/server/services/GarlandWebsite.ts), so live
// routes read these fresh on every render — the CDN in front of them is what
// keeps database load low. src/data/garlands.ts merges these over the bundled
// catalogue (src/data/garlandDrafts.json), so admin edits always win.
//
// Before migration 0011 is applied (no garland tables yet), this returns an
// empty map and the storefront behaves exactly as before — so deploying the
// code ahead of the migration can't break a build.
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/postgres/client";
import { buildMemo } from "../platform/buildMemo";
import {
  garlandDetails,
  media,
  occasions,
  productGarlandFilters,
  productImages,
  productOccasions,
  productOptions,
  products,
} from "../db/postgres/schema";

export type GarlandRecordImage = { url: string; altText: string | null; width: number | null; height: number | null; isPrimary: boolean };

export type GarlandRecord = {
  productId: number;
  designCode: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  status: "draft" | "published" | "archived";
  /** Last admin save of the product (ISO) — the version shown on the website. */
  updatedAt: string;
  priceType: "fixed" | "from" | "market" | "quote";
  sellingPrice: number | null;
  soldUnit: "single" | "pair" | "set" | null;
  length: string | null;
  flowerRecipe: string | null;
  thickness: string | null;
  finish: string | null;
  leadTime: string | null;
  substitutionPolicy: string | null;
  sellingMode: "enquiry" | "cart";
  readyForSale: boolean;
  photoPermission: "unconfirmed" | "granted" | "refused";
  sampleVerified: boolean;
  filters: ("rose" | "tuberose" | "lotus" | "designer-mixed")[];
  occasions: string[];
  options: { optionName: string; valueLabel: string; extraCharge: number | null }[];
  images: GarlandRecordImage[];
};

const FILTER_ORDER = ["rose", "tuberose", "lotus", "designer-mixed"] as const;

function isMissingGarlandTables(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: string }).code === "42P01") return true; // undefined_table
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function load(): Promise<Map<string, GarlandRecord>> {
  const db = getDb();
  let rows;
  try {
    rows = await db
      .select({
        productId: products.id,
        designCode: garlandDetails.designCode,
        slug: products.slug,
        name: products.name,
        shortDescription: products.shortDescription,
        description: products.description,
        status: products.status,
        updatedAt: products.updatedAt,
        priceType: products.priceType,
        sellingPrice: products.sellingPrice,
        soldUnit: garlandDetails.soldUnit,
        length: garlandDetails.length,
        flowerRecipe: garlandDetails.flowerRecipe,
        thickness: garlandDetails.thickness,
        finish: garlandDetails.finish,
        leadTime: garlandDetails.leadTime,
        substitutionPolicy: garlandDetails.substitutionPolicy,
        sellingMode: garlandDetails.sellingMode,
        readyForSale: garlandDetails.readyForSale,
        photoPermission: garlandDetails.photoPermission,
        sampleVerified: garlandDetails.sampleVerified,
      })
      .from(garlandDetails)
      .innerJoin(products, eq(products.id, garlandDetails.productId));
  } catch (error) {
    if (isMissingGarlandTables(error)) {
      console.warn("[garlands] migration 0011 is not applied yet — using the bundled garland catalogue only.");
      return new Map();
    }
    throw error;
  }
  if (rows.length === 0) return new Map();

  const ids = rows.map((row) => row.productId);
  const [filterRows, occasionRows, optionRows, imageRows] = await Promise.all([
    db.select().from(productGarlandFilters).where(inArray(productGarlandFilters.productId, ids)),
    db
      .select({ productId: productOccasions.productId, slug: occasions.slug })
      .from(productOccasions)
      .innerJoin(occasions, eq(occasions.id, productOccasions.occasionId))
      .where(inArray(productOccasions.productId, ids)),
    db.select().from(productOptions).where(inArray(productOptions.productId, ids)).orderBy(asc(productOptions.sortOrder), asc(productOptions.id)),
    db
      .select({
        productId: productImages.productId,
        url: media.url,
        altText: productImages.altText,
        mediaAlt: media.altText,
        width: media.width,
        height: media.height,
        isPrimary: productImages.isPrimary,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder)),
  ]);

  const map = new Map<string, GarlandRecord>();
  for (const row of rows) {
    const id = row.productId;
    const images = imageRows
      .filter((image) => image.productId === id)
      .map((image) => ({ url: image.url, altText: image.altText ?? image.mediaAlt, width: image.width, height: image.height, isPrimary: image.isPrimary }));
    map.set(row.designCode, {
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      filters: FILTER_ORDER.filter((key) => filterRows.some((f) => f.productId === id && f.filter === key)),
      occasions: occasionRows.filter((o) => o.productId === id).map((o) => o.slug),
      options: optionRows.filter((o) => o.productId === id).map(({ optionName, valueLabel, extraCharge }) => ({ optionName, valueLabel, extraCharge })),
      images,
    });
  }
  return map;
}

/**
 * Whether a garland record with this URL slug or design code exists: one
 * indexed row, no details. Lets a request for an invented address (a
 * crawler's /products/<anything>, an enquiry link with a made-up code) answer
 * 404 without reading every garland (about 100 KB of results per request on
 * staging, 6 Nov 2026).
 */
export async function garlandRecordExists(match: { slug: string } | { code: string }): Promise<boolean> {
  try {
    const rows = await getDb()
      .select({ id: products.id })
      .from(garlandDetails)
      .innerJoin(products, eq(products.id, garlandDetails.productId))
      .where("slug" in match ? eq(products.slug, match.slug) : eq(garlandDetails.designCode, match.code))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    if (isMissingGarlandTables(error)) return false;
    throw error;
  }
}

/**
 * What a WhatsApp enquiry (src/pages/garland-enquiry.ts) needs about one
 * stored garland: its identity, the facts that decide whether it is public,
 * its sold unit and its option labels. No prices or extra charges, no copy,
 * no filters or occasions.
 */
export type GarlandEnquiryRecord = Pick<
  GarlandRecord,
  "productId" | "designCode" | "slug" | "name" | "status" | "soldUnit" | "sellingMode" | "readyForSale" | "photoPermission" | "sampleVerified"
> & {
  options: { optionName: string; valueLabel: string }[];
  /** At least one stored photo is attached (what fromRecord's hasStoredPhoto means). */
  hasPhoto: boolean;
};

/**
 * One garland record by design code, read fresh for an enquiry: one indexed
 * row, then that product's options and whether it has a photo. Replaces
 * reading every garland (five catalogue-wide queries, about 100 KB of results)
 * per enquiry. Null when no record has this code; database errors propagate,
 * so a failed read never becomes a WhatsApp redirect.
 */
export async function loadGarlandEnquiryRecord(code: string): Promise<GarlandEnquiryRecord | null> {
  const db = getDb();
  let rows;
  try {
    rows = await db
      .select({
        productId: products.id,
        designCode: garlandDetails.designCode,
        slug: products.slug,
        name: products.name,
        status: products.status,
        soldUnit: garlandDetails.soldUnit,
        sellingMode: garlandDetails.sellingMode,
        readyForSale: garlandDetails.readyForSale,
        photoPermission: garlandDetails.photoPermission,
        sampleVerified: garlandDetails.sampleVerified,
      })
      .from(garlandDetails)
      .innerJoin(products, eq(products.id, garlandDetails.productId))
      .where(eq(garlandDetails.designCode, code))
      .limit(1);
  } catch (error) {
    if (isMissingGarlandTables(error)) return null;
    throw error;
  }
  const row = rows[0];
  if (!row) return null;
  const [options, photos] = await Promise.all([
    db
      .select({ optionName: productOptions.optionName, valueLabel: productOptions.valueLabel })
      .from(productOptions)
      .where(eq(productOptions.productId, row.productId))
      .orderBy(asc(productOptions.sortOrder), asc(productOptions.id)),
    db
      .select({ id: productImages.id })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(eq(productImages.productId, row.productId))
      .limit(1),
  ]);
  return { ...row, options, hasPhoto: photos.length > 0 };
}

let cache: Promise<Map<string, GarlandRecord>> | null = null;

/**
 * Admin-edited garland records keyed by design code. `fresh` (the default)
 * reads the database now — what every live page uses, so a warm server never
 * serves an outdated copy. `fresh: false` reuses one read per process.
 */
export function loadGarlandRecords({ fresh = true }: { fresh?: boolean } = {}): Promise<Map<string, GarlandRecord>> {
  if (fresh) return buildMemo("garland-records", load);
  if (!cache) cache = load();
  return cache;
}
