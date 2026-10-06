// Garlands / Poola Mala — FP-G001 onward, adapted to the site's existing
// Product model. Two sources, merged per design code:
//
//   1. The admin dashboard (database): garlands are ordinary products with a
//      garland_details row (drizzle/0011). Names, copy, prices, unit, length,
//      flowers, finish, options, photos, publication and approvals are edited
//      there. Admin edits always win.
//   2. The bundled catalogue (src/data/garlandDrafts.json, maintained by
//      scripts/import-garlands.mjs): the starting point for every design and the
//      only source until scripts/seed-garlands.mjs has added it to the database.
//
// Live, not built. Garland pages and sections are rendered on request and
// cached briefly by the CDN; saving in the admin purges that cache
// (src/server/services/GarlandWebsite.ts). So the static catalogue
// (productCatalog) contains no garlands at all — every garland surface calls
// loadGarlands() / findGarland() at request time.
//
// Visibility. Unpublished drafts appear only in a local preview (`astro dev`,
// or a build with PUBLIC_FP_PREVIEW_DRAFTS=1). A design is listed publicly
// only when it is published, photo permission is granted, the sample is
// verified — and its main photo is held in the site's image storage, so a
// production build never depends on local, git-ignored files. Archived
// designs are hidden everywhere.
//
// Unknown facts stay null and are shown as "to be confirmed". A price never
// enables checkout by itself: see isCartGarland.
import drafts from "./garlandDrafts.json";
import type { Product } from "./productCatalog";
import { GARLAND_FILTER_LABELS, GARLAND_PREVIEW, formatGarlandPrice, isCartGarland, isListedGarland, type GarlandDesign, type GarlandOption } from "./garlandRules";
import { loadGarlandRecords, type GarlandRecord } from "../server/services/GarlandCatalogue";

export * from "./garlandRules";

/** A garland product: the shared Product shape plus its garland facts. */
export type GarlandProduct = Product & { garland: GarlandDesign };

export const GARLAND_CATEGORY = { slug: "garlands", label: "Garlands / Poola Mala" } as const;
export const GARLAND_FILTERS = GARLAND_FILTER_LABELS;

/** Garland designs are recommended for these existing occasion routes unless the admin chooses others. */
export const GARLAND_OCCASIONS = ["wedding", "engagement"] as const;

function groupOptions(record: GarlandRecord): GarlandOption[] {
  const groups = new Map<string, GarlandOption>();
  for (const option of record.options) {
    const group = groups.get(option.optionName) ?? { label: option.optionName, values: [] };
    group.values!.push({ label: option.valueLabel, extraCharge: option.extraCharge });
    groups.set(option.optionName, group);
  }
  return [...groups.values()];
}

/** The catalogue design with the admin's database record laid over it. */
function fromRecord(base: GarlandDesign | undefined, record: GarlandRecord): GarlandDesign {
  const primary = record.images.find((image) => image.isPrimary) ?? record.images[0];
  const others = record.images.filter((image) => image !== primary);
  const priced = record.priceType === "fixed" && typeof record.sellingPrice === "number" && record.sellingPrice > 0;
  const photo = (image: (typeof record.images)[number]) => ({
    path: image.url,
    width: image.width ?? 800,
    height: image.height ?? 1000,
    alt: image.altText || record.name,
  });
  return {
    code: record.designCode,
    slug: record.slug,
    title: record.name,
    filters: record.filters,
    filterRecipeVerified: !!record.flowerRecipe,
    status: record.status,
    published: record.status === "published",
    archived: record.status === "archived",
    readyForSale: record.readyForSale,
    sellingMode: record.sellingMode,
    price: priced ? record.sellingPrice : null,
    currency: "INR",
    priceConfirmed: priced,
    soldUnit: record.soldUnit,
    length: record.length,
    flowerRecipe: record.flowerRecipe,
    weightOrThickness: record.thickness,
    finish: record.finish,
    leadTime: record.leadTime,
    substitutionPolicy: record.substitutionPolicy,
    options: groupOptions(record),
    photoPermission: record.photoPermission,
    sampleVerified: record.sampleVerified,
    firstSample: base?.firstSample ?? false,
    // A stored photo replaces the local catalogue photo; without one the local
    // photo is used, which only a preview build ships.
    image: primary ? photo(primary) : (base?.image ?? { path: "/images/product-placeholder.svg", width: 800, height: 1000, alt: record.name }),
    gallery: primary ? others.map(photo) : (base?.gallery ?? []),
    relatedViews: base?.relatedViews ?? [],
    hasStoredPhoto: !!primary,
    description: record.shortDescription,
    longDescription: record.description,
    occasionTags: record.occasions,
  };
}

const catalogueDesigns = drafts.designs as GarlandDesign[];

async function mergedDesigns(fresh: boolean): Promise<(GarlandDesign & { updatedAt?: string })[]> {
  const records = await loadGarlandRecords({ fresh });
  return [
    ...catalogueDesigns.map((design) => {
      const record = records.get(design.code);
      return record ? { ...fromRecord(design, record), updatedAt: record.updatedAt } : design;
    }),
    // Garlands that exist only in the database (e.g. added there later).
    ...[...records.values()]
      .filter((record) => !catalogueDesigns.some((d) => d.code === record.designCode))
      .map((record) => ({ ...fromRecord(undefined, record), updatedAt: record.updatedAt })),
  ];
}

/** Shown in this environment: public garlands, plus every non-archived draft in a preview. */
const isVisible = (design: GarlandDesign) => !design.archived && (GARLAND_PREVIEW || isListedGarland(design));

function toProduct(design: GarlandDesign): GarlandProduct {
  const price = formatGarlandPrice(design);
  return {
    id: `garland-${design.code.toLowerCase()}`,
    slug: design.slug,
    name: design.title,
    category: "Garlands",
    image: design.image.path,
    priceLabel: price ?? "Price on request",
    priceType: price ? "fixed" : "quote",
    description: design.description || `${design.title} — design ${design.code}.`,
    longDescription:
      design.longDescription || `${design.title}, design ${design.code}. Made to order; the exact flowers and length are confirmed with you on WhatsApp.`,
    isAvailable: true,
    requiresConfirmation: true,
    badge: design.code,
    collectionTags: [],
    occasionTags: design.occasionTags ? [...design.occasionTags] : [...GARLAND_OCCASIONS],
    flowerTypes: [],
    whatsIncluded: [],
    careNotes: [],
    garland: design,
  } as GarlandProduct;
}

/** Garland products visible right now (fresh from the database by default). */
export async function loadGarlands({ fresh = true }: { fresh?: boolean } = {}): Promise<(GarlandProduct & { version: string | null })[]> {
  return (await mergedDesigns(fresh)).filter(isVisible).map((design) => ({ ...toProduct(design), version: design.updatedAt ?? null }));
}

/** One visible garland by its URL slug, or null when it doesn't exist or isn't public. */
export async function findGarland(slug: string): Promise<(GarlandProduct & { version: string | null }) | null> {
  return (await loadGarlands()).find((product) => product.slug === slug) ?? null;
}

/** One visible garland by its design code (fresh), or null. */
export async function findGarlandByCode(code: string): Promise<(GarlandProduct & { version: string | null }) | null> {
  return (await loadGarlands()).find((product) => product.garland.code === code) ?? null;
}

export const isGarlandProduct = (product: Product): product is GarlandProduct =>
  "garland" in product && !!(product as GarlandProduct).garland;

/** Whether this garland's page offers the existing cart (otherwise a WhatsApp enquiry). */
export const usesCart = (product: GarlandProduct) => isCartGarland(product.garland);
