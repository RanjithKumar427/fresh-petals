// The launch range: which categories are public, which existing products
// belong to them, and which occasions are promoted. Navigation (header,
// mobile menu, footer, category strip), the homepage bouquet grid and
// occasion carousel, /categories/bouquets and the launch occasion pages all
// read from here.
//
// This file only controls what is promoted. It never deletes products,
// changes prices or touches database publication: every product keeps its
// own URL, record and price. To launch another category, add its verified
// product slugs and set `ready: true` once the owner has confirmed the facts
// listed in `pending`.
import { productCatalog, type Product } from "./productCatalog";
import { GARLAND_PREVIEW } from "./garlandRules";

export { GARLAND_PREVIEW };

export type LaunchGroup = { id: string; label: string; slugs: string[] };
export type LaunchCategory = {
  id: string;
  label: string;
  href: string;
  ready: boolean;
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
    // Existing, published products with database prices whose photographs
    // match their catalogue description.
    groups: [
      { id: "roses", label: "Rose bouquets", slugs: ["red-affair", "timeless-hug", "rose-promise"] },
      { id: "mixed", label: "Mixed flower bouquets", slugs: ["colourful-confession", "colour-pop-love", "sunshine-story"] },
      { id: "lilies", label: "Lily bouquets", slugs: ["blush-lily-letter", "pink-lily-wish"] },
    ],
  },
  {
    // 25 draft designs (FP-G001–FP-G025) live in src/data/garlands.ts. They
    // show on /categories/garlands in a local preview only, until each
    // design is published with photo permission and a verified sample.
    id: "garlands",
    label: "Garlands / Poola Mala",
    href: "/categories/garlands",
    ready: false,
    groups: [],
    pending: [
      "Photo-publication permission for the supplier-catalogue photos, or your own photos of the samples",
      "For each design: single or pair, length, exact flowers, finish/tassels, price or quotation, preparation time",
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
 * page; an occasion is shown only when that page has launch products.
 */
export const LAUNCH_OCCASIONS: { label: string; route: string | null }[] = [
  { label: "Birthday", route: "birthday" },
  { label: "Anniversary", route: "anniversary" },
  { label: "Wedding", route: "wedding" },
  { label: "Engagement", route: "engagement" }, // page built only when it has products (garlands, once public)
  { label: "Housewarming", route: "housewarming" },
  { label: "Baby Shower / Seemantham", route: "mom-to-be" },
];

const bySlug = (slug: string) => {
  const product = productCatalog.find((item) => item.slug === slug);
  if (!product) throw new Error(`launchCatalogue: product "${slug}" not found`);
  return product;
};

export const readyCategories = () => LAUNCH_CATEGORIES.filter((category) => category.ready);

/** Every launch product, in display order (each product once). */
export function launchProducts(): Product[] {
  const slugs = readyCategories().flatMap((category) => category.groups.flatMap((group) => group.slugs));
  return [...new Set(slugs)].map(bySlug);
}

export function launchGroups(categoryId: string): { group: LaunchGroup; products: Product[] }[] {
  const category = LAUNCH_CATEGORIES.find((item) => item.id === categoryId && item.ready);
  return (category?.groups ?? []).map((group) => ({ group, products: group.slugs.map(bySlug) }));
}

/**
 * Launch products genuinely tagged for an occasion route (no blanket
 * assignment). Garlands for wedding/engagement are added live on those pages
 * (src/components/LiveGarlands.astro), not here.
 */
export function launchProductsForOccasion(route: string): Product[] {
  return launchProducts().filter((product) => product.occasionTags?.includes(route));
}

/** Occasion routes that also show live garland designs. */
export const GARLAND_OCCASION_ROUTES = new Set(["wedding", "engagement"]);

/** Whether the owner has switched garlands on in the menus (the garlands entry's `ready`). */
export const garlandsPromoted = () => LAUNCH_CATEGORIES.some((category) => category.id === "garlands" && category.ready);

/** Occasion routes whose pages are restricted to the launch range. */
export const LAUNCH_OCCASION_ROUTES = new Set(LAUNCH_OCCASIONS.map((item) => item.route).filter((route): route is string => !!route));

/**
 * The homepage occasion carousel, in the owner's preferred order. `route` is
 * the existing occasion page each card links to; `feature` optionally names
 * the launch product whose photograph leads the card. A card is shown only
 * while its route has eligible launch bouquets (see occasionCarousel()).
 */
export const OCCASION_CAROUSEL: { label: string; route: string; feature?: string }[] = [
  { label: "Birthday", route: "birthday", feature: "colour-pop-love" },
  { label: "Anniversary", route: "anniversary", feature: "timeless-hug" },
  { label: "Wedding", route: "wedding" },
  { label: "Engagement", route: "engagement" },
  { label: "Housewarming & Pooja", route: "housewarming" },
  { label: "Condolence", route: "sympathy" },
];

/** Carousel routes; their occasion pages list occasionBouquets(route). */
export const OCCASION_CAROUSEL_ROUTES = new Set(OCCASION_CAROUSEL.map((item) => item.route));

const BOUQUET_CATEGORIES = new Set(["Bouquets", "Lilies"]);

/**
 * The eligible public bouquets for a carousel occasion — one list read by
 * both its homepage card (count and photo) and its occasion page. Launch
 * occasions keep the launch range (launchProductsForOccasion). The others
 * (Condolence → sympathy) keep their existing public bouquets: catalogue
 * bouquets genuinely tagged for the route, with no add-ons or fallbacks.
 * Every product shown still takes its price from the database.
 */
export function occasionBouquets(route: string): Product[] {
  if (LAUNCH_OCCASION_ROUTES.has(route)) return launchProductsForOccasion(route);
  return productCatalog.filter(
    (product) => product.occasionTags?.includes(route) && BOUQUET_CATEGORIES.has(product.category) && !product.isAddon
  );
}

/**
 * Carousel entries that have eligible bouquets, in order. Each occasion
 * appears once; none is padded or repeated.
 */
export function occasionCarousel(): { label: string; href: string; count: number; products: Product[]; feature?: string }[] {
  return OCCASION_CAROUSEL.flatMap((item) => {
    const products = occasionBouquets(item.route);
    return products.length > 0 ? [{ label: item.label, href: `/occasions/${item.route}`, count: products.length, products, feature: item.feature }] : [];
  });
}

/** Shop by Occasion entries that currently have launch products. */
export function populatedOccasions(): { label: string; href: string; count: number }[] {
  return LAUNCH_OCCASIONS.flatMap((item) => {
    if (!item.route) return [];
    const count = launchProductsForOccasion(item.route).length;
    // Garland-only occasions (engagement) are live pages; they join the menu
    // once the owner promotes garlands (`ready: true` above).
    const promotedGarlandOccasion = GARLAND_OCCASION_ROUTES.has(item.route) && garlandsPromoted();
    return count > 0 || promotedGarlandOccasion ? [{ label: item.label, href: `/occasions/${item.route}`, count }] : [];
  });
}
