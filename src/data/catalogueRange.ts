// What the storefront can list, and how it is grouped. One set of selectors
// for every surface, so a list, its count, its filters and its links agree.
//
// 1. Publication. A catalogue product is public only when its database record
//    is "published" in this deployment's snapshot (src/content.config.ts,
//    "catalogueStatus"; read through src/server/services/PublicCatalogue.ts).
//    A missing record, a draft, an archived record or an unknown status is
//    never public; reconcileCatalogue() reports each one.
// 2. Ranges. The full eligible range of a type (every public bouquet, every
//    public fresh-flower product) is derived from each product's own record:
//    its category, add-on/subscription flags and recorded flowers. Editorial
//    shortlists (the featured bouquets in src/data/launchCatalogue.ts, the
//    homepage four, city and guide examples) are separate and never decide
//    what a full list contains.
// 3. Flowers. Flower membership is read from the recorded flowers
//    (flowerTypes) only — never the product name, the first flower listed,
//    the photograph or a guess. The sets overlap: a bouquet with roses and
//    lilies belongs to both.
import type { Product } from "./productCatalog";

// ---------------------------------------------------------------------------
// Publication
// ---------------------------------------------------------------------------

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * One database product record as the build snapshot keeps it. The editorial
 * fields are those with a one-to-one catalogue equivalent (the seed wrote
 * catalogue description → short_description, longDescription → description,
 * stemCount → stem_count and the catalogue image as the primary photograph);
 * they are compared for drift only, never published.
 */
export type CatalogueRecord = {
  slug: string;
  status: string;
  category: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  stemCount?: string | null;
  image?: string | null;
};

/** slug → database status, from one snapshot. */
export type PublicationMap = ReadonlyMap<string, string>;

/** Public means exactly "published"; anything else — including no record — is not. */
export const isPublished = (status: string | undefined | null): boolean => status === "published";

/** The catalogue products whose database record is published, in catalogue order. */
export function publicProducts<T extends { slug: string }>(catalogue: T[], publication: PublicationMap): T[] {
  return catalogue.filter((product) => isPublished(publication.get(product.slug)));
}

/**
 * Database fields the storefront does not read for catalogue products
 * (src/server/services/ProductPricing.ts header). The first group has an
 * equivalent catalogue field and is compared for drift (editorialDrift); the
 * second has no reliable one-to-one mapping and is not compared.
 */
export const UNMAPPED_EDITORIAL_FIELDS = [
  "name",
  "short and long description",
  "main photograph",
  "category",
  "stem count",
] as const;
export const UNCOMPARED_EDITORIAL_FIELDS = [
  "flower types, moods and colour theme",
  "what's included and care notes",
  "size and arrangement style",
  "SEO title and description",
  "additional photographs",
] as const;

export type DriftField = "name" | "category" | "shortDescription" | "description" | "stemCount" | "image";
export const DRIFT_FIELD_LABELS: Record<DriftField, string> = {
  name: "name",
  category: "category",
  shortDescription: "short description",
  description: "long description",
  stemCount: "stem count",
  image: "main photograph",
};

/** The neutral placeholder the catalogue shows when a photograph was reviewed as not showing the product (src/data/productPhotos.ts). */
export const PLACEHOLDER_IMAGE = "/images/product-placeholder.svg";

/**
 * Catalogue copy changed on purpose after the database was seeded; the
 * difference is expected and is reported as deliberate, not as drift.
 */
export const DELIBERATE_CATALOGUE_COPY: Record<string, { fields: DriftField[]; reason: string }> = {
  "pet-friendly-flowerbox": { fields: ["shortDescription", "description"], reason: "catalogue copy rewritten so no pet-safety claim is made (P0.1 trust containment)" },
};

export type DriftEntry = { slug: string; field: DriftField; database: string; storefront: string; deliberate?: string };

const sameText = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").replace(/\s+/g, " ").trim() === (b ?? "").replace(/\s+/g, " ").trim();

/**
 * Dashboard values that differ from what the storefront shows, for fields
 * with an equivalent catalogue field. Whitespace is ignored; a field the
 * record doesn't carry is not compared; a catalogue placeholder (a reviewed,
 * deliberately replaced photograph) is not compared with the stored photograph.
 */
export function editorialDrift(record: CatalogueRecord, product: Pick<Product, "slug" | "name" | "category" | "description" | "longDescription" | "stemCount" | "image">): DriftEntry[] {
  const pairs: [DriftField, string | null | undefined, string | null | undefined][] = [
    ["name", record.name, product.name],
    ["category", record.category, product.category],
    ...(record.shortDescription !== undefined ? [["shortDescription", record.shortDescription, product.description] as [DriftField, string | null | undefined, string | null | undefined]] : []),
    ...(record.description !== undefined ? [["description", record.description, product.longDescription] as [DriftField, string | null | undefined, string | null | undefined]] : []),
    ...(record.stemCount !== undefined ? [["stemCount", record.stemCount, product.stemCount] as [DriftField, string | null | undefined, string | null | undefined]] : []),
    ...(record.image !== undefined && product.image !== PLACEHOLDER_IMAGE ? [["image", record.image, product.image] as [DriftField, string | null | undefined, string | null | undefined]] : []),
  ];
  const deliberate = DELIBERATE_CATALOGUE_COPY[product.slug];
  return pairs
    .filter(([, database, storefront]) => !sameText(database, storefront))
    .map(([field, database, storefront]) => ({
      slug: product.slug,
      field,
      database: database ?? "",
      storefront: storefront ?? "",
      ...(deliberate?.fields.includes(field) ? { deliberate: deliberate.reason } : {}),
    }));
}

/** What the storefront takes from the database for a catalogue product, and when. */
export const DATABASE_DRIVEN_FIELDS = [
  "publication status (with the next deployment)",
  "price (with the next deployment)",
  "suitable occasions (live occasion pages and lists)",
] as const;

export type Reconciliation = {
  /** Catalogue products published in the database: listed by the storefront. */
  live: string[];
  /** Catalogue products whose record is a draft or archived: excluded everywhere. */
  hidden: { slug: string; status: string }[];
  /** Catalogue products with no database record: excluded, and a problem. */
  missingRecord: string[];
  /** Records whose status is not draft/published/archived: excluded, and a problem. */
  unknownStatus: { slug: string; status: string }[];
  /** Non-garland records with no storefront catalogue entry: not live, whatever their status. */
  unmapped: { slug: string; status: string; name: string; category: string }[];
  /** Mapped records whose dashboard value differs from what the storefront shows (database-only edits; deliberate ones marked). */
  editorialDrift: DriftEntry[];
};

/**
 * Compares the database records with the storefront catalogue. Nothing here
 * defaults to published: a product is live only with a "published" record.
 * Garland records are managed live (src/data/garlands.ts) and are skipped.
 */
export function reconcileCatalogue(records: CatalogueRecord[], catalogue: Pick<Product, "slug" | "name" | "category" | "description" | "longDescription" | "stemCount" | "image">[], isGarland: (record: CatalogueRecord) => boolean): Reconciliation {
  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const mapped = new Set(catalogue.map((product) => product.slug));
  const result: Reconciliation = { live: [], hidden: [], missingRecord: [], unknownStatus: [], unmapped: [], editorialDrift: [] };
  for (const product of catalogue) {
    const record = bySlug.get(product.slug);
    if (!record) result.missingRecord.push(product.slug);
    else if (!(PRODUCT_STATUSES as readonly string[]).includes(record.status)) result.unknownStatus.push({ slug: product.slug, status: record.status });
    else if (isPublished(record.status)) result.live.push(product.slug);
    else result.hidden.push({ slug: product.slug, status: record.status });
    if (record) result.editorialDrift.push(...editorialDrift(record, product));
  }
  for (const record of records) {
    if (mapped.has(record.slug) || isGarland(record)) continue;
    if (!(PRODUCT_STATUSES as readonly string[]).includes(record.status)) result.unknownStatus.push({ slug: record.slug, status: record.status });
    result.unmapped.push({ slug: record.slug, status: record.status, name: record.name, category: record.category });
  }
  return result;
}

/** Plain-text report lines for the build log; empty when there is nothing to report. */
export function reconciliationReport(report: Reconciliation): string[] {
  const lines: string[] = [];
  if (report.hidden.length) lines.push(`${report.hidden.length} catalogue product(s) not published in the database, excluded from every page: ${report.hidden.map((item) => `${item.slug} (${item.status})`).join(", ")}`);
  if (report.missingRecord.length) lines.push(`PROBLEM: ${report.missingRecord.length} catalogue product(s) have no database record and are excluded: ${report.missingRecord.join(", ")}`);
  if (report.unknownStatus.length) lines.push(`PROBLEM: unknown status, treated as not published: ${report.unknownStatus.map((item) => `${item.slug} (${item.status})`).join(", ")}`);
  const unmappedPublished = report.unmapped.filter((item) => isPublished(item.status));
  if (unmappedPublished.length) lines.push(`PROBLEM: ${unmappedPublished.length} record(s) published in the dashboard have no storefront catalogue entry and are NOT live: ${unmappedPublished.map((item) => `${item.slug} ("${item.name}", ${item.category})`).join(", ")}. Each needs a catalogue entry in src/data/productCatalog.ts (${UNMAPPED_EDITORIAL_FIELDS.join("; ")}) and a deployment.`);
  const drift = report.editorialDrift.filter((item) => !item.deliberate);
  const deliberate = report.editorialDrift.filter((item) => item.deliberate);
  const clip = (text: string) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);
  if (drift.length) lines.push(`${drift.length} dashboard edit(s) the storefront does not show (it uses its catalogue copy): ${drift.map((item) => `${item.slug} ${DRIFT_FIELD_LABELS[item.field]} "${clip(item.database)}" (storefront "${clip(item.storefront)}")`).join(", ")}`);
  if (deliberate.length) lines.push(`${deliberate.length} deliberate catalogue difference(s), not drift: ${deliberate.map((item) => `${item.slug} ${DRIFT_FIELD_LABELS[item.field]} (${item.deliberate})`).join(", ")}`);
  lines.push(`Not compared (no one-to-one catalogue field): ${UNCOMPARED_EDITORIAL_FIELDS.join("; ")}.`);
  return lines;
}

/** Whether a product record exists in the catalogue and what this deployment shows. */
export type StorefrontReadiness = {
  /** The product has a storefront catalogue entry (src/data/productCatalog.ts). */
  mapped: boolean;
  /** Its status in this deployment's snapshot, or null when the snapshot has no record. */
  deployedStatus: string | null;
};

// ---------------------------------------------------------------------------
// Ranges
// ---------------------------------------------------------------------------

/** Product categories that are bouquets (hand-tied, wrapped or vase arrangements). */
export const BOUQUET_CATEGORIES = new Set(["Bouquets", "Lilies"]);

/** A bouquet: a Bouquets or Lilies record that is not an add-on. */
export const isBouquet = (product: Pick<Product, "category" | "isAddon">): boolean => BOUQUET_CATEGORIES.has(product.category) && !product.isAddon;

/** Every bouquet in a (public) catalogue, in catalogue order. */
export function bouquetRange<T extends Pick<Product, "category" | "isAddon">>(catalogue: T[]): T[] {
  return catalogue.filter(isBouquet);
}

/**
 * Product types that are fresh flowers as sold (src/data/productCatalog.ts
 * categories). Dried flowers, plants, vases, tools, hampers, add-ons and
 * subscriptions are other product types.
 */
export const FRESH_FLOWER_CATEGORIES = new Set(["Bouquets", "Lilies", "Flowerbox", "Baskets", "By Stems", "Flower Strings & Torans", "Pooja Flowers"]);

/** The record names flowers: recorded flower types, or included items that are flowers or stems. */
const recordsFlowers = (product: Pick<Product, "flowerTypes" | "whatsIncluded">) =>
  (product.flowerTypes?.length ?? 0) > 0 || (product.whatsIncluded ?? []).some((item) => /\b(flowers?|stems?|toran)\b/i.test(item));

/**
 * All Flowers: the fresh-flower range. A product belongs when it is a
 * fresh-flower product type whose record names flowers (so an empty basket
 * or box would not), is neither an add-on nor a subscription — or when its
 * record already places it in the flower range (collection "all-flowers").
 */
export function isAllFlowersProduct(product: Pick<Product, "category" | "isAddon" | "isSubscription" | "flowerTypes" | "whatsIncluded" | "collectionTags">): boolean {
  if (product.isAddon || product.isSubscription) return false;
  if (product.collectionTags?.includes("all-flowers")) return true;
  return FRESH_FLOWER_CATEGORIES.has(product.category) && recordsFlowers(product);
}

export function allFlowersRange<T extends Parameters<typeof isAllFlowersProduct>[0]>(catalogue: T[]): T[] {
  return catalogue.filter(isAllFlowersProduct);
}

// ---------------------------------------------------------------------------
// Flowers (recorded flower types only)
// ---------------------------------------------------------------------------

export type FlowerKey = "roses" | "lilies";

const FLOWER_WORDS: Record<FlowerKey, RegExp> = {
  roses: /\broses?\b/i,
  lilies: /\b(lily|lilies)\b/i,
};

/** Whether the recorded flowers include this flower. */
export function recordsFlower(product: Pick<Product, "flowerTypes">, flower: FlowerKey): boolean {
  return (product.flowerTypes ?? []).some((type) => FLOWER_WORDS[flower].test(type));
}

/** Loose stems of one flower: the By Stems products filed under that flower's collection. */
export function stemsOf<T extends Pick<Product, "category" | "collectionTags">>(catalogue: T[], flower: FlowerKey): T[] {
  return catalogue.filter((product) => product.category === "By Stems" && (product.collectionTags ?? []).includes(flower));
}

/** Arrangements (not loose stems, not add-ons) whose recorded flowers include this flower. */
export function arrangementsWith<T extends Pick<Product, "category" | "isAddon" | "isSubscription" | "flowerTypes">>(catalogue: T[], flower: FlowerKey): T[] {
  return catalogue.filter((product) => product.category !== "By Stems" && !product.isAddon && !product.isSubscription && recordsFlower(product, flower));
}

/**
 * The bouquet list's groups (/categories/bouquets#roses, #lilies, #mixed).
 * Roses and lilies are read from the recorded flowers and overlap; "mixed"
 * is every bouquet with neither, so each bouquet is in at least one group.
 */
export const BOUQUET_FLOWER_GROUPS: { id: "roses" | "lilies" | "mixed"; label: string; menuLabel: string; test: (product: Pick<Product, "flowerTypes">) => boolean }[] = [
  { id: "roses", label: "Bouquets with roses", menuLabel: "Bouquets with roses", test: (product) => recordsFlower(product, "roses") },
  { id: "lilies", label: "Bouquets with lilies", menuLabel: "Bouquets with lilies", test: (product) => recordsFlower(product, "lilies") },
  // Not a verified "mixed flower" classification: only "no roses or lilies recorded". The #mixed address is kept for existing links.
  { id: "mixed", label: "Other bouquets", menuLabel: "Other bouquets", test: (product) => !recordsFlower(product, "roses") && !recordsFlower(product, "lilies") },
];

export function bouquetFlowerGroups<T extends Pick<Product, "slug" | "flowerTypes">>(bouquets: T[]): { id: string; label: string; products: T[] }[] {
  return BOUQUET_FLOWER_GROUPS.map(({ id, label, test }) => ({ id, label, products: bouquets.filter(test) }));
}

/** Each product once, in first-seen order (for totals across overlapping groups). */
export function uniqueBySlug<T extends { slug: string }>(lists: T[][]): T[] {
  const seen = new Set<string>();
  return lists.flat().filter((product) => (seen.has(product.slug) ? false : (seen.add(product.slug), true)));
}
