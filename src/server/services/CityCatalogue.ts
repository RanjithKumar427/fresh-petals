// The whole public catalogue as collections, for the per-city shop view
// (/locations/<city>/shop) and the collection tiles on city pages.
//
// Nothing is selected or limited here, and nothing is city-specific: every
// serviceable city sees the same collections and the same products, because
// no per-city stock or restriction exists. Sources are the ones the rest of
// the shop already uses, so public eligibility is unchanged:
//   - catalogue collections: the category pages' own getStaticPaths()
//     (the source of truth for which category pages exist and what they list),
//     at this deployment's published prices;
//   - featured bouquets: the launch bouquet groups;
//   - garlands: public, listed designs read fresh from the admin database,
//     as one collection and by browsing group (rose, lotus, tuberose,
//     designer/mixed). A browsing group is how photographs are sorted, not a
//     list of the flowers used.
// An unpublished garland or a product removed from a category disappears
// here as it does there. Empty collections are dropped.
import type { Product } from "../../data/productCatalog";
import { getStaticPaths as getCategoryStaticPaths } from "../../pages/categories/[slug].astro";
import { CANONICAL_CATEGORY, NOINDEX_CATEGORY_SLUGS } from "../../data/seoLanding";
import { launchGroups } from "../../data/launchCatalogue";
import { isListedGarland, loadGarlands, type GarlandProduct } from "../../data/garlands";
import { GARLAND_FILTER_LABELS, garlandPhotoSrcset } from "../../data/garlandRules";
import { loadAuthoritativePrices, withAuthoritativePrice } from "./ProductPricing";
import { photoDimensions, photoVariants } from "../../data/photoManifest";
import { QUOTE_ONLY_PRICE_LABEL, isQuoteOnly } from "../../shared/quoteOnly";
import { productPhotoAlt } from "../../data/productPhotos";

export type CatalogueItem = {
  /** Product slug: one product, one key, whichever collections it is in. */
  key: string;
  name: string;
  /** Canonical product path (no city). */
  path: string;
  image: { src: string; srcset?: string; width?: number; height?: number; alt: string; contain: boolean };
  /** Garland design code. */
  code?: string;
  /** Public price label: the quote-only label, or the published price. */
  price: string;
  quoteOnly: boolean;
  category: string;
};

export type CatalogueCollection = {
  id: string;
  /** "Lotus wedding garlands": read as "<label> in <city>". */
  label: string;
  /** The national page for this collection. */
  href: string;
  /** Shown first in navigation. */
  primary: boolean;
  items: CatalogueItem[];
};

function productItem(product: Product): CatalogueItem {
  const variants = photoVariants[product.image];
  const quoteOnly = isQuoteOnly(product);
  return {
    key: product.slug,
    name: product.name,
    path: `/products/${product.slug}`,
    image: {
      src: product.image,
      srcset: variants ? Object.entries(variants).map(([width, path]) => `${path} ${width}w`).join(", ") : undefined,
      width: photoDimensions[product.image]?.width,
      height: photoDimensions[product.image]?.height,
      alt: productPhotoAlt(product),
      contain: false,
    },
    price: quoteOnly ? QUOTE_ONLY_PRICE_LABEL : product.priceLabel,
    quoteOnly,
    category: product.category,
  };
}

function garlandItem(product: GarlandProduct): CatalogueItem {
  const design = product.garland;
  return {
    key: product.slug,
    name: design.title,
    path: `/products/${product.slug}`,
    image: { src: design.image.path, srcset: garlandPhotoSrcset(design.image, 480), width: design.image.width, height: design.image.height, alt: design.image.alt, contain: true },
    code: design.code,
    price: QUOTE_ONLY_PRICE_LABEL,
    quoteOnly: true,
    category: "Garlands",
  };
}

const PRIMARY = ["all-flowers", "lilies", "pooja-flowers"];
const GARLAND_LABELS: Record<string, string> = { rose: "Rose wedding garlands", lotus: "Lotus wedding garlands", tuberose: "Tuberose wedding garlands", "designer-mixed": "Designer and mixed garlands" };
const titleFromSlug = (slug: string) => slug.split("-").map((word) => (word === "and" ? "and" : word.charAt(0).toUpperCase() + word.slice(1))).join(" ");

export async function loadCityCatalogue(): Promise<{ collections: CatalogueCollection[]; all: CatalogueItem[] }> {
  const [priceMap, categoryPaths, garlands] = await Promise.all([
    loadAuthoritativePrices(),
    getCategoryStaticPaths(),
    loadGarlands().then((list) => list.filter((product) => isListedGarland(product.garland))),
  ]);

  const featured: CatalogueCollection = {
    id: "bouquets",
    label: "Featured bouquets",
    href: "/categories/bouquets",
    primary: true,
    items: launchGroups("bouquets").flatMap(({ products }) => products).map((product) => productItem(withAuthoritativePrice(product, priceMap))),
  };

  const categories: CatalogueCollection[] = categoryPaths
    .filter((entry) => !NOINDEX_CATEGORY_SLUGS.has(entry.params.slug) && !CANONICAL_CATEGORY[entry.params.slug])
    .map((entry) => ({
      id: entry.params.slug,
      label: entry.params.slug === "all-flowers" ? "All flowers" : entry.params.slug === "pooja-flowers" ? "Pooja flowers and jasmine" : (entry.props.category?.name ?? titleFromSlug(entry.params.slug)),
      href: `/categories/${entry.params.slug}`,
      primary: PRIMARY.includes(entry.params.slug),
      items: (entry.props.products as Product[]).map(productItem),
    }));

  const garlandItems = garlands.map(garlandItem);
  const garlandCollections: CatalogueCollection[] = [
    { id: "garlands", label: "Wedding garlands", href: "/categories/garlands", primary: true, items: garlandItems },
    ...GARLAND_FILTER_LABELS.map(({ key }) => ({
      id: `garlands-${key}`,
      label: GARLAND_LABELS[key] ?? `${titleFromSlug(key)} garlands`,
      href: key === "designer-mixed" ? "/categories/garlands?filter=designer-mixed" : `/categories/garlands/${key}`,
      primary: true,
      items: garlands.filter((product) => product.garland.filters.includes(key)).map(garlandItem),
    })),
  ];

  const order = (collection: CatalogueCollection) => (collection.id === "all-flowers" ? 0 : collection.id === "bouquets" ? 1 : collection.id === "lilies" ? 2 : collection.id.startsWith("garlands") ? 3 : collection.id === "pooja-flowers" ? 4 : 5);
  const collections = [featured, ...categories, ...garlandCollections]
    .filter((collection) => collection.items.length > 0)
    .sort((a, b) => order(a) - order(b) || (order(a) === 5 ? a.label.localeCompare(b.label) : 0));

  // Every product once, however many collections list it.
  const seen = new Set<string>();
  const all = collections.flatMap((collection) => collection.items).filter((item) => (seen.has(item.key) ? false : (seen.add(item.key), true)));
  return { collections, all };
}

export const CITY_SHOP_PAGE_SIZE = 24;
