// The admin's catalogue records laid over the storefront catalogue, so the
// dashboard is the source for what it edits:
//
//   - a product record with no storefront entry (added in the admin) gets one
//     built from the record: name, descriptions, category, photo, included
//     items, care notes, flowers, occasions;
//   - for a product with an entry, the dashboard's name, short and long
//     description, stem count and main photo replace the entry's, except
//     copy rewritten on purpose (DELIBERATE_CATALOGUE_COPY), a reviewed
//     placeholder photo, and a photo the build can't serve (a local path with
//     no file). Category, collections, flowers, included items and care stay
//     with the entry: they decide which pages list it and have no one-to-one
//     dashboard field.
//
// The records come from src/data/generated/dashboard-catalogue.json, written by
// each Cloudflare build (scripts/build/dashboard-catalogue.mjs). Without it
// (development, type checks, tests, Vercel builds) the catalogue is unchanged.
// Publication is not decided here: a product is public only while its record
// is "published" in the build's snapshot (src/server/services/PublicCatalogue.ts).
import type { PriceType, Product } from "./productCatalog";
import { DELIBERATE_CATALOGUE_COPY, PLACEHOLDER_IMAGE } from "./catalogueRange";
import { STORED_PHOTO_WIDTHS, storedPhotoUrl } from "./garlandRules";
import { QUOTE_ONLY_PRICE_LABEL } from "../shared/quoteOnly";
import { staticPhoto } from "./storedPhotos";

export type DashboardRecord = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  priceType: PriceType;
  stemCount: string | null;
  requiresConfirmation: boolean;
  category: string;
  categorySlug: string;
  image: { url: string; alt: string | null; width: number | null; height: number | null; usable: boolean } | null;
  whatsIncluded: string[];
  careNotes: string[];
  flowerTypes: string[];
  occasions: string[];
};

function generatedRecords(): DashboardRecord[] {
  // Vite replaces this call at build time (it must be written literally). Outside
  // Vite (the source-level tests) it doesn't exist, and the catalogue is unchanged.
  try {
    const files = import.meta.glob("./generated/dashboard-catalogue.json", { eager: true, import: "default" }) as Record<string, { products?: DashboardRecord[] }>;
    return Object.values(files)[0]?.products ?? [];
  } catch {
    return [];
  }
}

const text = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** The storefront address of a record's main photo, or null when it can't be served. */
export function recordPhoto(image: DashboardRecord["image"]): string | null {
  if (!image?.usable) return null;
  if (!/^https:\/\//.test(image.url)) return image.url;
  // A static copy made by the build (src/data/storedPhotos.ts), else the resizer.
  const copy = staticPhoto(image.url, image.width, image.height);
  if (copy) return copy.path;
  // A stored upload goes through the site's resizer at the largest allowed width it has.
  const width = [...STORED_PHOTO_WIDTHS].reverse().find((w) => !image.width || w <= image.width) ?? STORED_PHOTO_WIDTHS[0];
  return storedPhotoUrl(image.url, width);
}

/** One entry's fields from its record (an edit in the admin), as described above. */
export function withRecordEdits(product: Product, record: DashboardRecord): Product {
  const keep = DELIBERATE_CATALOGUE_COPY[product.slug]?.fields ?? [];
  const next: Product = { ...product };
  if (text(record.name) && !keep.includes("name")) next.name = record.name.trim();
  if (text(record.shortDescription) && !keep.includes("shortDescription")) next.description = record.shortDescription!.trim();
  if (text(record.description) && !keep.includes("description")) next.longDescription = record.description!.trim();
  if (text(record.stemCount) && !keep.includes("stemCount")) next.stemCount = record.stemCount!.trim();
  const photo = recordPhoto(record.image);
  if (photo && product.image !== PLACEHOLDER_IMAGE && !keep.includes("image")) next.image = photo;
  return next;
}

/** A storefront entry for a record added in the admin. */
export function entryFromRecord(record: DashboardRecord): Product {
  const short = text(record.shortDescription) || record.name;
  return {
    id: `dashboard-${record.id}`,
    slug: record.slug,
    name: record.name.trim(),
    category: record.category,
    image: recordPhoto(record.image) ?? PLACEHOLDER_IMAGE,
    priceLabel: QUOTE_ONLY_PRICE_LABEL,
    priceType: record.priceType,
    description: short,
    longDescription: text(record.description) || short,
    isAvailable: true,
    requiresConfirmation: record.requiresConfirmation,
    whatsIncluded: record.whatsIncluded,
    careNotes: record.careNotes,
    flowerTypes: record.flowerTypes,
    ...(text(record.stemCount) ? { stemCount: record.stemCount!.trim() } : {}),
    collectionTags: [record.categorySlug],
    occasionTags: record.occasions,
  };
}

/** The catalogue with the admin's records applied (entries first, in catalogue order, then added products by id). */
export function withDashboardRecords(catalogue: Product[], records: DashboardRecord[] = generatedRecords()): Product[] {
  if (!records.length) return catalogue;
  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const known = new Set(catalogue.map((product) => product.slug));
  return [
    ...catalogue.map((product) => (bySlug.has(product.slug) ? withRecordEdits(product, bySlug.get(product.slug)!) : product)),
    ...records.filter((record) => !known.has(record.slug) && /^[a-z0-9-]+$/.test(record.slug)).map(entryFromRecord),
  ];
}
