// Main-menu readiness and editorial selections. Navigation (header, mobile
// menu, footer, category strip) reads which categories are ready here; the
// homepage edit, city examples and guide samples take their small featured
// selections from here.
//
// This file controls what is promoted, never what is eligible. The full
// ranges — every public bouquet on /categories/bouquets, every assigned
// bouquet on an occasion page — come from src/data/catalogueRange.ts and the
// admin's assignments, never from these slugs. It never deletes products,
// changes prices or touches database publication: every product keeps its
// own URL, record and price. To promote another category in the main menu,
// set `ready: true` once the owner has confirmed the facts listed in
// `pending`.
import type { Product } from "./productCatalog";
import { GARLAND_PREVIEW } from "./garlandRules";

export { GARLAND_PREVIEW };

export type LaunchGroup = { id: string; label: string; slugs: string[] };
export type LaunchCategory = {
  id: string;
  label: string;
  href: string;
  ready: boolean;
  /** Editorial featured selections (examples), not the category's full range. */
  groups: LaunchGroup[];
  /** Facts still needed from the owner before this category can be public. */
  pending?: string[];
};

export const LAUNCH_CATEGORIES: LaunchCategory[] = [
  {
    id: "bouquets",
    label: "Bouquets",
    href: "/categories/bouquets",
    ready: true,
    // Featured bouquets: existing products with database prices whose
    // photographs match their catalogue description. A shortlist for the
    // homepage, city pages and guides; /categories/bouquets lists every
    // public bouquet.
    groups: [
      { id: "roses", label: "Rose bouquets", slugs: ["red-affair", "timeless-hug", "rose-promise"] },
      { id: "mixed", label: "Mixed flower bouquets", slugs: ["colourful-confession", "colour-pop-love", "sunshine-story"] },
      { id: "lilies", label: "Lily bouquets", slugs: ["blush-lily-letter", "pink-lily-wish"] },
    ],
  },
  {
    // Launched 12 October 2026: the owner confirmed the 156 photographs
    // (FP-G001–FP-G156) are their own. The designs are made to order through
    // WhatsApp enquiry and are read live from the database
    // (src/data/garlands.ts), so this entry lists no slugs.
    id: "garlands",
    label: "Garlands / Poola Mala",
    href: "/categories/garlands",
    ready: true,
    groups: [],
    // Still unrecorded; customers see "To be confirmed on WhatsApp" meanwhile.
    pending: [
      "For each design: single or pair, length, exact flowers, finish/tassels, preparation time",
      "Which designs suit groom, wedding and engagement use, and the delivery area for garlands",
    ],
  },
  {
    id: "baskets",
    label: "Flower Baskets",
    href: "/categories/baskets",
    ready: false,
    groups: [],
    pending: ["Confirmation that handling and delivery trials are complete", "Photographs of the two launch designs (current entries reuse a category photo)"],
  },
  {
    id: "torans",
    label: "Door Torans",
    href: "/categories/floral-torans-and-strings",
    ready: false,
    groups: [],
    pending: ["Readiness confirmation", "For each set: length, flowers and quantity per set, pre-order notice", "Photographs of the actual sets"],
  },
  {
    id: "veni",
    label: "Veni",
    href: "/categories/jasmine",
    ready: false,
    groups: [],
    pending: ["Readiness confirmation", "The two veni designs (flowers, length), price or quotation, pre-order or add-on only"],
  },
];

/**
 * Shop by Occasion, in the owner's order. `route` is an existing occasion
 * page; an occasion is shown in the menu only when that page has eligible
 * products (occasionJourneys.menuOccasions).
 */
export const LAUNCH_OCCASIONS: { label: string; route: string | null }[] = [
  { label: "Birthday", route: "birthday" },
  { label: "Anniversary", route: "anniversary" },
  { label: "Wedding", route: "wedding" },
  { label: "Engagement", route: "engagement" }, // page built only when it has products (garlands, once public)
  { label: "Housewarming", route: "housewarming" },
  { label: "Baby Shower / Seemantham", route: "mom-to-be" },
];

export const readyCategories = () => LAUNCH_CATEGORIES.filter((category) => category.ready);

/**
 * A category's featured groups, limited to products in `catalogue` (the
 * public catalogue), in editorial order. A featured product that is not
 * public is skipped; nothing is substituted.
 */
export function featuredGroups(categoryId: string, catalogue: Product[]): { group: LaunchGroup; products: Product[] }[] {
  const category = LAUNCH_CATEGORIES.find((item) => item.id === categoryId && item.ready);
  const bySlug = new Map(catalogue.map((product) => [product.slug, product]));
  return (category?.groups ?? []).map((group) => ({ group, products: group.slugs.flatMap((slug) => bySlug.get(slug) ?? []) }));
}

/** The featured bouquets that are public, in display order (each once). */
export function featuredBouquets(catalogue: Product[]): Product[] {
  const seen = new Set<string>();
  return featuredGroups("bouquets", catalogue).flatMap(({ products }) => products).filter((product) => (seen.has(product.slug) ? false : (seen.add(product.slug), true)));
}

/** Every slug named in an editorial selection (for checks that each still exists). */
export const featuredSlugs = () => LAUNCH_CATEGORIES.flatMap((category) => category.groups.flatMap((group) => group.slugs));

/** Occasion routes that also show live garland designs. */
export const GARLAND_OCCASION_ROUTES = new Set(["wedding", "engagement"]);

/** Whether the owner has switched garlands on in the menus (the garlands entry's `ready`). */
export const garlandsPromoted = () => LAUNCH_CATEGORIES.some((category) => category.id === "garlands" && category.ready);

/** The Shop by Occasion routes (gift lists of public bouquets assigned in the admin). */
export const LAUNCH_OCCASION_ROUTES = new Set(LAUNCH_OCCASIONS.map((item) => item.route).filter((route): route is string => !!route));
