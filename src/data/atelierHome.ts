// Build-time data for the atelier homepage. Everything here is derived
// from the real catalogue (productCatalog.ts), the database prices
// (ProductPricing) and the existing image variant manifests — nothing is
// invented. Counts shown to visitors are computed, so they stay true as
// the catalogue changes.
import { productCatalog, type Product } from "./productCatalog";
import imageVariants from "./imageVariants.json";
import imageDimensions from "./imageDimensions.json";
import homePhotoVariants from "./homePhotoVariants.json";
import { withAuthoritativePrice, type AuthoritativePrice } from "../server/services/ProductPricing";
import { launchGroups, launchProducts } from "./launchCatalogue";
import { budgetBand, deckOccasions, giftProducts, type Membership } from "./occasionJourneys";

type Variants = Record<string, Record<string, string>>;
type Dimensions = Record<string, { width: number; height: number }>;

export type ResponsiveImage = {
  src: string;
  srcset?: string;
  width?: number;
  height?: number;
};

export function responsiveImage(image: string): ResponsiveImage {
  const variants = (imageVariants as Variants)[image];
  const dims = (imageDimensions as Dimensions)[image];
  return {
    src: variants?.["720"] ?? image,
    srcset: variants
      ? Object.entries(variants)
          .map(([width, path]) => `${path} ${width}w`)
          .join(", ")
      : undefined,
    width: dims?.width,
    height: dims?.height,
  };
}

const bySlug = (slug: string) => {
  const product = productCatalog.find((item) => item.slug === slug);
  if (!product) throw new Error(`atelierHome: product "${slug}" not found in productCatalog`);
  return product;
};

// ---------------------------------------------------------------------
// The owner's own photographs (public/images/*.jpg). WebP variants are
// generated at or below each photo's native width by
// scripts/home-photo-variants.mjs — never upscaled, never re-cropped.
// ---------------------------------------------------------------------
type PhotoManifest = Record<string, { width: number; height: number; variants: Record<string, string> }>;

export type Photo = ResponsiveImage & { width: number; height: number; alt: string };

// `name` is a file in public/images ("bouquet-1") or one of the editorial
// crops defined in scripts/home-photo-variants.mjs ("bouquet-1#hero").
export function photo(name: string, alt: string): Photo {
  const key = name.includes("#") ? `/images/${name}` : `/images/${name}.jpg`;
  const entry = (homePhotoVariants as PhotoManifest)[key];
  if (!entry) throw new Error(`atelierHome: no variants for ${key} — run scripts/home-photo-variants.mjs`);
  const widths = Object.keys(entry.variants).map(Number).sort((a, b) => a - b);
  return {
    src: entry.variants[String(widths[widths.length - 1])],
    srcset: widths.map((w) => `${entry.variants[String(w)]} ${w}w`).join(", "),
    width: entry.width,
    height: entry.height,
    alt,
  };
}

// A. Opening photograph — a wrapped bouquet (bouquet-1.jpg, the catalogue's
// own photo for its gift range), cropped to drop the window above it, plus
// a detail of the same photograph for the hero's foreground layer.
// Editorial only: no product name or price is attached to it.
// The hero shows one identifiable public bouquet — its own product
// photograph, linked to its page — rather than a generic photograph. The
// foreground "lens" is a magnified detail of the same file (CSS crop, no
// extra image). Falls back to the first launch bouquet if this one leaves
// the range.
const HERO_PRODUCT_SLUG = "timeless-hug";
/** The hero photograph's display width (the lens uses the same, so both load one file); the preload in pages/index.astro uses it too. */
export const HERO_SIZES = "(min-width: 1024px) 560px, calc(100vw - 4rem)";

export function getHeroPhoto() {
  const product = launchProducts().find((item) => item.slug === HERO_PRODUCT_SLUG) ?? launchProducts()[0];
  const main = productPhoto(product.slug);
  return {
    slug: product.slug,
    main: { ...main, alt: `${product.name}: ${product.description}` },
    name: product.name,
    detail: { ...main, alt: "" },
  };
}

// A2. Hero gallery — the other photographs from the original homepage
// banners, each with the destination it used to point to (or the closest
// populated page for it).
export type ReelSlide = { photo: Photo; eyebrow: string; title: string; text: string; cta: string; href: string };

export function getHeroReel(): ReelSlide[] {
  return [
    {
      photo: photo("hero-main-banner", "White star-shaped jasmine flowers on a dark green branch"),
      eyebrow: "Fresh flowers in Bengaluru",
      title: "Order on WhatsApp",
      text: "Pooja flowers, jasmine, bouquets and garlands. Delivery area, slot and fee are confirmed in chat.",
      cta: "See today's offers",
      href: "/categories/offers",
    },
    {
      photo: photo("bouquet-1", "A bouquet of pink tulips and baby's breath in pink paper, tied with a satin bow, by a window"),
      eyebrow: "Soft and pastel",
      title: "Pink flowers",
      text: "Tulips, roses and lilies in blush and pink, hand-tied.",
      cta: "Shop pink flowers",
      href: "/categories/pink-flowers",
    },
    {
      photo: photo("pooja-flowers", "A cane basket of loose flowers for pooja: yellow blooms, marigold, hibiscus, pink flowers, butterfly pea and jasmine"),
      eyebrow: "Daily fresh flowers for rituals",
      title: "Pooja flowers",
      text: "Fresh flowers, jasmine, garlands and pooja essentials.",
      cta: "Order pooja flowers",
      href: "/occasions/pooja",
    },
    {
      photo: photo("banner-pooja", "A home pooja room hung with marigold strings above an altar of framed deities"),
      eyebrow: "For the home",
      title: "Torans and flower strings",
      text: "Marigold and jasmine strings for doorways, pooja rooms and functions.",
      cta: "See torans and strings",
      href: "/categories/floral-torans-and-strings",
    },
  ];
}

// ---------------------------------------------------------------------
// B. Collection deck — the launch range only: bouquet types, the occasions
// that have launch products, and custom orders. Category cards use the
// owner's category photographs; the others use the photograph of a real
// launch product from that group.
// ---------------------------------------------------------------------
export type OccasionPanel = {
  /** Occasion slug (admin assignment). */
  key: string;
  title: string;
  href: string;
  note: string;
  /** Eligible public bouquets — the same products the destination lists. */
  count: number;
  /** "1 design" / "8 designs". */
  countLabel: string;
  cue: string;
  image: Photo;
  /** object-position for the card's 5:7 crop, so the flowers stay in frame. */
  focus: string;
};

function productPhoto(slug: string): Photo {
  const product = bySlug(slug);
  const img = responsiveImage(product.image);
  return { ...img, width: img.width ?? 1200, height: img.height ?? 1200, alt: product.name };
}

// Owner photographs for occasions that have them; otherwise the photograph
// of a bouquet assigned to the occasion (or a neutral bouquet photograph
// while none is).
const OCCASION_PHOTOS: Record<string, { name: string; alt: string }> = {
  wedding: { name: "occasion-wedding", alt: "A doorway framed with strings of jasmine and roses" },
  engagement: { name: "occasion-wedding", alt: "A doorway framed with strings of jasmine and roses" },
  housewarming: { name: "cat-pooja", alt: "A pooja set-up with marigold and jasmine strings" },
  sympathy: { name: "jasmine", alt: "White jasmine buds" },
};

// Where each photograph's flowers sit, for the carousel's 5:7 portrait crop
// (object-position; measured on the photographs). A square bouquet photo
// loses its sides, a tall owner photo its top and bottom; anything not
// listed is centred.
const OCCASION_FOCUS: Record<string, string> = {
  "/images/occasion-wedding.jpg": "50% 22%",
  "/images/cat-pooja.jpg": "50% 40%",
  "/images/bouquets/bouquet-timeless-hug-01.webp": "54% 50%",
  "/images/bouquets/bouquet-rose-promise-01.webp": "53% 50%",
  "/images/lilies/lily-blush-lily-letter-01.webp": "42% 50%",
};

// Condolence keeps to plain wording.
const OCCASION_CUES: Record<string, string> = { sympathy: "View designs" };

export const designCountLabel = (count: number) => `${count} ${count === 1 ? "design" : "designs"}`;

/**
 * The homepage occasion carousel: actual occasions with eligible public
 * bouquets only, in the owner's order (src/data/occasionJourneys.ts
 * DECK_ORDER), from the admin's current assignments (the homepage is
 * rendered on request). The count is the number of bouquets the card's
 * destination lists. Cards avoid sharing a photograph: an occasion whose
 * usual photograph is already on an earlier card shows the next bouquet
 * assigned to it instead. Once all of its own photographs are in use it
 * takes the one whose other card is furthest away round the ring (the last
 * card sits beside the first) — never an unrelated photograph. Bouquet types
 * and the budget shortcut live with the bouquets (getBouquetBrowse), not here.
 */
export function getOccasionDeck(membership: Membership): OccasionPanel[] {
  const occasions = deckOccasions(membership);
  /** Photograph → the cards (positions) showing it. */
  const shown = new Map<string, number[]>();
  const ringGap = (a: number, b: number) => Math.min(Math.abs(a - b), occasions.length - Math.abs(a - b));
  return occasions.map(({ key, label, note, href, count }, position) => {
    const members = giftProducts(key, membership);
    const owner = OCCASION_PHOTOS[key];
    const choices = [
      ...(owner ? [{ file: `/images/${owner.name}.jpg`, image: photo(owner.name, owner.alt) }] : []),
      ...members.map((product) => ({ file: product.image, image: productPhoto(product.slug) })),
    ];
    /** How far away the nearest card with this photograph is (Infinity: not shown yet). */
    const nearest = (file: string) => Math.min(...(shown.get(file) ?? []).map((other) => ringGap(position, other)));
    const chosen =
      choices.find((choice) => !shown.has(choice.file)) ??
      [...choices].sort((a, b) => nearest(b.file) - nearest(a.file))[0] ??
      { file: "/images/cat-bouquets.jpg", image: photo("cat-bouquets", "A large bouquet of sunflowers and white roses") };
    shown.set(chosen.file, [...(shown.get(chosen.file) ?? []), position]);
    return {
      key,
      title: label,
      href,
      note,
      count,
      countLabel: designCountLabel(count),
      cue: OCCASION_CUES[key] ?? "Explore designs",
      image: chosen.image,
      focus: OCCASION_FOCUS[chosen.file] ?? "50% 50%",
    };
  });
}

/** Bouquet types, shown with the homepage bouquets ("See all bouquets"). */
export function getBouquetBrowse(): { label: string; href: string }[] {
  return launchGroups("bouquets").map(({ group }) => ({ label: group.label, href: `/categories/bouquets#${group.id}` }));
}

/**
 * The budget shortcut beside the homepage bouquet heading: bouquets whose
 * displayed (starting) price is under ₹1,500 — the bouquet price, not an
 * all-in order total. Counted from the same published prices the cards show.
 */
export function getBudgetShortcut(priceMap: Map<string, AuthoritativePrice>): { label: string; href: string; count: number } | null {
  const count = launchProducts().filter((product) => budgetBand(withAuthoritativePrice(product, priceMap)) === "under-1500").length;
  return count > 0 ? { label: `Bouquets under ₹1,500 (${count})`, href: "/categories/bouquets?budget=under-1500", count } : null;
}

// ---------------------------------------------------------------------
// C. Bouquet edit — the catalogue's own "bestselling-bouquets" collection
// plus two lily arrangements, priced from the database.
// ---------------------------------------------------------------------
export type EditProduct = Product & { img: ResponsiveImage };

/**
 * The launch bouquet range (src/data/launchCatalogue.ts), taken in turn from
 * each group (rose, mixed, lily) so the editorial spread alternates.
 */
export function getBouquetEdit(priceMap: Map<string, AuthoritativePrice>): EditProduct[] {
  const groups = launchGroups("bouquets").map(({ products }) => products);
  const interleaved: Product[] = [];
  for (let i = 0; i < Math.max(0, ...groups.map((list) => list.length)); i++) {
    for (const list of groups) if (list[i]) interleaved.push(list[i]);
  }
  return interleaved.map((product) => ({ ...withAuthoritativePrice(product, priceMap), img: responsiveImage(product.image) }));
}

// ---------------------------------------------------------------------
// D. What will arrive — one public launch bouquet, its own photograph (linked
// to its page) and two close-ups cropped from that same file in CSS, with
// the specification its catalogue entry records. Crop boxes are fractions
// of the (square) photograph, measured on it; a bouquet without boxes shows
// the photograph alone.
type Crop = { x: number; y: number; w: number; h: number; caption: string; alt: string };
const ARRIVAL_PRODUCT_SLUG = "colourful-confession";
const ARRIVAL_CROPS: Record<string, { flowers: Crop; wrap: Crop }> = {
  "colourful-confession": {
    flowers: { x: 0.3, y: 0.3, w: 0.44, h: 0.36, caption: "The flowers", alt: "Close view of the centre: gerberas, a peach rose, daisies and purple fillers" },
    wrap: { x: 0.34, y: 0.74, w: 0.34, h: 0.24, caption: "Wrap and ribbon", alt: "Close view of the kraft wrapping gathered with a ribbon at the stems" },
  },
};

export type ArrivalBouquet = {
  slug: string;
  name: string;
  priceLabel: string;
  photo: Photo;
  flowers: string[];
  stems: string | null;
  included: string[];
  crops: { flowers: Crop; wrap: Crop } | null;
};

export function getArrivalBouquet(priceMap: Map<string, AuthoritativePrice>): ArrivalBouquet {
  const product = launchProducts().find((item) => item.slug === ARRIVAL_PRODUCT_SLUG) ?? launchProducts()[0];
  return {
    slug: product.slug,
    name: product.name,
    priceLabel: withAuthoritativePrice(product, priceMap).priceLabel,
    photo: { ...productPhoto(product.slug), alt: `${product.name}: ${product.description}` },
    flowers: product.flowerTypes ?? [],
    stems: product.stemCount ?? null,
    included: product.whatsIncluded ?? [],
    crops: ARRIVAL_CROPS[product.slug] ?? null,
  };
}

// G. Final invitation photograph — flowers being held out, cropped to the
// hand and flowers.
// A public launch bouquet's own photograph (linked to its page), not an
// editorial photograph of flowers we don't sell.
const ASSIST_PRODUCT_SLUG = "pink-lily-wish";

export function getFinalPhoto(): Photo & { slug: string; name: string } {
  const product = launchProducts().find((item) => item.slug === ASSIST_PRODUCT_SLUG) ?? launchProducts()[0];
  return { ...productPhoto(product.slug), alt: `${product.name}: ${product.description}`, slug: product.slug, name: product.name };
}
