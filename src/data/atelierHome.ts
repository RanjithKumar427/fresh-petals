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
import { launchGroups, populatedOccasions } from "./launchCatalogue";

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
export function getHeroPhoto() {
  return {
    main: photo("bouquet-1#hero", "A bouquet of pink and white tulips with baby's breath, wrapped in pink paper and tied with a pink satin ribbon"),
    detail: photo("bouquet-1#tulips", ""),
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
  title: string;
  href: string;
  note: string;
  image: Photo;
};

function productPhoto(slug: string): Photo {
  const product = bySlug(slug);
  const img = responsiveImage(product.image);
  return { ...img, width: img.width ?? 1200, height: img.height ?? 1200, alt: product.name };
}

export function getOccasionDeck(): OccasionPanel[] {
  const groups = Object.fromEntries(launchGroups("bouquets").map(({ group, products }) => [group.id, products]));
  const occasions = Object.fromEntries(populatedOccasions().map((item) => [item.href, item]));
  const panels: (OccasionPanel | null)[] = [
    { title: "All bouquets", href: "/categories/bouquets", note: "Our launch range of hand-tied bouquets.", image: photo("cat-bouquets", "A large bouquet of sunflowers and white roses") },
    groups.roses ? { title: "Rose bouquets", href: "/categories/bouquets#roses", note: "Red, pink and peach roses.", image: photo("rose-bouquet", "A bouquet of red roses tied with a red ribbon") } : null,
    groups.mixed ? { title: "Mixed flowers", href: "/categories/bouquets#mixed", note: "Gerberas, sunflowers, daisies and more.", image: productPhoto(groups.mixed[0].slug) } : null,
    groups.lilies ? { title: "Lily bouquets", href: "/categories/bouquets#lilies", note: "Blush and pink lilies.", image: productPhoto(groups.lilies[groups.lilies.length - 1].slug) } : null,
    occasions["/occasions/birthday"] ? { title: "Birthday", href: "/occasions/birthday", note: "Bright bouquets for the day.", image: productPhoto("colour-pop-love") } : null,
    occasions["/occasions/anniversary"] ? { title: "Anniversary", href: "/occasions/anniversary", note: "Roses and lilies for two.", image: productPhoto("timeless-hug") } : null,
    { title: "Custom orders", href: "/custom-orders", note: "Your colours, occasion and budget.", image: photo("hero-bouquets", "Long-stemmed pink and cream flowers laid in a gift box lined with white tissue, beside a small card") },
  ];
  return panels.filter((panel): panel is OccasionPanel => panel !== null);
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
// D. Inside the bouquet — composition facts counted from the 37 products
// in the Bouquets category.
// ---------------------------------------------------------------------
export type BouquetFacts = {
  total: number;
  roses: number;
  gerberas: number;
  chrysanthemums: number;
  softeners: number;
  greenery: number;
  ribbon: number;
  wrapped: number;
  messageNote: number;
  topCareNotes: string[];
};

export function getBouquetFacts(): BouquetFacts {
  const bouquets = productCatalog.filter((product) => product.category === "Bouquets");
  const withFlower = (pattern: RegExp) =>
    bouquets.filter((product) => (product.flowerTypes ?? []).some((type) => pattern.test(type))).length;
  const withIncluded = (pattern: RegExp) =>
    bouquets.filter((product) => (product.whatsIncluded ?? []).some((item) => pattern.test(item))).length;

  const careCounts = new Map<string, number>();
  for (const product of bouquets) {
    for (const note of product.careNotes ?? []) careCounts.set(note, (careCounts.get(note) ?? 0) + 1);
  }

  return {
    total: bouquets.length,
    roses: withFlower(/\brose/i),
    gerberas: withFlower(/gerbera/i),
    chrysanthemums: withFlower(/chrysanth/i),
    softeners: withFlower(/gypsophila|baby/i),
    greenery: withFlower(/greenery|filler|fern/i),
    ribbon: withIncluded(/ribbon/i),
    wrapped: withIncluded(/wrap/i),
    messageNote: withIncluded(/message note/i),
    topCareNotes: [...careCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([note]) => note.replace(/\.$/, "")),
  };
}

// D. The detail study: the kraft-wrapped bouquet (banner-bouquet.jpg) and
// two details cropped from that same photograph.
export function getDetailPhoto() {
  return {
    whole: photo("banner-bouquet", "A large hand-tied bouquet of mixed flowers wrapped in kraft paper and tied with red twine"),
    centre: photo("banner-bouquet#centre", "Close view of the centre of the bouquet: large coral and red blooms with cream, yellow and white flowers around them"),
    tie: photo("banner-bouquet#tie", "Close view of the kraft paper wrap gathered at the stems and tied with red twine"),
  };
}

// G. Final invitation photograph — flowers being held out, cropped to the
// hand and flowers.
export function getFinalPhoto() {
  return photo("bouquet-6#closing", "A hand holding out a bouquet of daisies, a peach rose, lavender and wildflowers in a meadow");
}
