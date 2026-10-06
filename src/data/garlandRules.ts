// Garland record types and the publication / selling rules, kept apart from
// the draft data (src/data/garlandDrafts.json) so server code such as
// ProductPricing.ts can apply the rules without bundling any draft records.

/** Unpublished drafts are shown only in a local preview (`astro dev`, or PUBLIC_FP_PREVIEW_DRAFTS=1). */
export const GARLAND_PREVIEW: boolean = import.meta.env.DEV || import.meta.env.PUBLIC_FP_PREVIEW_DRAFTS === "1";

export type GarlandFilterKey = "rose" | "tuberose" | "lotus" | "designer-mixed";

/** The four browsing filters, in display order. */
export const GARLAND_FILTER_LABELS: { key: GarlandFilterKey; label: string }[] = [
  { key: "rose", label: "Rose" },
  { key: "tuberose", label: "Tuberose" },
  { key: "lotus", label: "Lotus" },
  { key: "designer-mixed", label: "Designer / Mixed" },
];

/** A garland photograph and its WebP derivatives (width -> path), recorded on
 *  the design rather than in the shared image manifests, so unpublished photo
 *  paths never reach code bundled for other pages. */
export type GarlandPhoto = { path: string; width: number; height: number; alt: string; variants?: Record<string, string> };

/** One choice of an option (e.g. Finish → Gold tassels), with an optional extra charge in INR. */
export type GarlandOptionValue = { label: string; extraCharge: number | null };
/** An option the customer can choose; values may be plain strings in older catalogue data. */
export type GarlandOption = { label: string; values?: (string | GarlandOptionValue)[] };

export type GarlandDesign = {
  code: string;
  slug: string;
  title: string;
  filters: GarlandFilterKey[];
  filterRecipeVerified: boolean;
  status: string;
  published: boolean;
  readyForSale: boolean;
  /** "enquiry" (WhatsApp quotation) or "cart" (existing cart and checkout). */
  sellingMode: string;
  price: number | null;
  currency: string;
  priceConfirmed: boolean;
  /** Single garland, pair or set — null until confirmed. */
  soldUnit: "single" | "pair" | "set" | null;
  length: string | null;
  flowerRecipe: string | null;
  weightOrThickness: string | null;
  /** Finish / tassels (admin-edited; absent in older catalogue data). */
  finish?: string | null;
  leadTime: string | null;
  substitutionPolicy: string | null;
  options: GarlandOption[];
  photoPermission: string;
  sampleVerified: boolean;
  firstSample: boolean;
  image: GarlandPhoto;
  /** Confirmed extra photographs of this design (shown once the design is public). */
  gallery: GarlandPhoto[];
  /** Provisional related-view candidates: never in the gallery, local preview only. */
  relatedViews: GarlandPhoto[];
  /** Admin-edited copy (from the database); absent for catalogue-only drafts. */
  description?: string | null;
  longDescription?: string | null;
  /** Occasion routes this design is recommended for (admin-edited). */
  occasionTags?: string[];
  /** True when the main photo is held in the site's image storage (not a local file). */
  hasStoredPhoto?: boolean;
  /** Archived in the admin: hidden everywhere. */
  archived?: boolean;
};

/** Normalised option values: plain strings become { label, extraCharge: null }. */
export function optionValues(option: GarlandOption): GarlandOptionValue[] {
  return (option.values ?? []).map((value) => (typeof value === "string" ? { label: value, extraCharge: null } : value));
}

/** Public: published, photo permission granted and the sample verified. */
export const isPublicGarland = (design: GarlandDesign) =>
  design.published === true && design.photoPermission === "granted" && design.sampleVerified === true;

/** A price the owner has set and confirmed (shown to customers). */
export const hasConfirmedPrice = (design: GarlandDesign) =>
  design.priceConfirmed === true && typeof design.price === "number" && design.price > 0;

/**
 * Uses the existing cart only when deliberately switched to it: selling mode
 * "cart", ready for sale and a confirmed price. A price alone never enables
 * checkout; enquiry designs keep the WhatsApp quotation flow.
 */
export const isCartGarland = (design: GarlandDesign) =>
  design.sellingMode === "cart" && design.readyForSale === true && hasConfirmedPrice(design);

/**
 * Whether the build-time database price check (ProductPricing.ts) may skip
 * this garland:
 * - unpublished drafts: they exist only in a local preview build and are never sold;
 * - public enquiry designs with no confirmed price: no number is shown, so none can diverge.
 * Every other public garland — anything with a confirmed price or in cart
 * mode — needs a database row like any other product.
 */
export const isExemptFromDatabasePrice = (design: GarlandDesign) =>
  !isPublicGarland(design) || (design.sellingMode === "enquiry" && !hasConfirmedPrice(design));

/** "₹5,000" — Indian digit grouping, as everywhere a garland price is shown. */
export function formatGarlandPrice(design: GarlandDesign): string | null {
  if (!hasConfirmedPrice(design)) return null;
  const amount = (design.price as number).toLocaleString("en-IN");
  return design.currency === "INR" ? `₹${amount}` : `${design.currency} ${amount}`;
}

/** srcset for a garland photo from its own recorded derivatives (none for stored uploads). */
export function garlandPhotoSrcset(photo: GarlandPhoto): string | undefined {
  const variants = Object.entries(photo.variants ?? {});
  if (!variants.length) return undefined;
  return [...variants.map(([width, path]) => `${path} ${width}w`), `${photo.path} ${photo.width}w`].join(", ");
}

/** Public on the live site: approved (isPublicGarland), not archived, and photographed in the site's image storage. */
export function isListedGarland(design: GarlandDesign): boolean {
  return !design.archived && isPublicGarland(design) && design.hasStoredPhoto === true;
}
