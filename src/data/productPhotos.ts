// What each catalogue photograph shows, and how it relates to its product.
// Read by product pages, cards and the image sitemap (sitemap.xml.ts).
//
// Every relationship below was decided by looking at the photograph
// (16 October 2026); nothing is inferred from a file name or from how many
// products use a file. A review binds the product to one exact file path and
// that file's content (sha256 prefix, checked by scripts/audit/regression.test.mjs),
// so a new upload, a renamed file or a replaced file is "unreviewed" until
// someone looks at it and adds or updates its entry here.
//
//   product       shows the product as sold (listed in the image sitemap)
//   unconfirmed   shows the design, but differently from its record (presentation
//                 to be settled by the owner; not listed, no presentation claimed)
//   illustrative  relevant to the product, not the product itself (labelled on its page)
//   unrelated     shows something else; the catalogue uses the "no image yet"
//                 placeholder instead (src/data/productCatalog.ts), the review is kept
import type { Product } from "./productCatalog";
import { bouquetPhotoAlt } from "./collectionGuidance";

/** What a photograph shows. Visible content only: no count, size, or claim that it is any product. */
export const PHOTO_DESCRIPTIONS: Record<string, string> = {
  "/images/addon-candle.jpg": "Three stacked candles decorated with pressed flowers",
  "/images/addon-table-decor.jpg": "Sunflowers, white daisies and small purple flowers in glass jars along a dining table",
  "/images/banner-pooja.jpg": "A home pooja room hung with marigold strings above an altar of framed deities",
  "/images/bouquet-1.jpg": "A bouquet of pink tulips and baby's breath in pink paper, tied with a satin bow, by a window",
  "/images/bouquet-2.jpg": "A bouquet of mixed flowers, including gerberas, daisies and purple larkspur, in kraft paper tied with red string",
  "/images/bouquet-4.jpg": "Orange flowers, lavender and small white daisies in kraft paper",
  "/images/bouquet-5.jpg": "A wicker basket of pink gerberas, daisies and other garden flowers on grass",
  "/images/bouquet-6.jpg": "A hand holding a bunch of wildflowers: daisies, a peach rose and purple flowers",
  "/images/bouquet-7.jpg": "Blue and white flowers with yellow daisies in a metal jug",
  "/images/bouquet-9.jpg": "Pink and cream tulips in a metal watering can",
  "/images/cards/iloveu.jpg": "A greeting card with quilled red heart-shaped flowers and the words Happy Valentine's Day, on an envelope",
  "/images/cat-basket.jpg": "A wicker basket of gerberas, pink lilies, roses, hydrangea and purple stock",
  "/images/cat-pooja.jpg": "A pooja set-up with marigold and jasmine strings",
  "/images/jasmine.jpg": "White jasmine buds",
  "/images/occasion-event.jpg": "A doorway framed with white and yellow flower strings",
  "/images/pooja-flowers.jpg": "A cane basket of loose flowers for pooja: yellow blooms, marigold, hibiscus, pink flowers, butterfly pea and jasmine",
  "/images/rose-bouquet.jpg": "Red roses tied with a red ribbon",
};

export type PhotoVerdict = "product" | "unconfirmed" | "illustrative" | "unrelated";
export type PhotoReview = { photo: string; sha256: string; verdict: PhotoVerdict };

/** Reviewed relationships, by product slug (see the header). */
export const PHOTO_REVIEWS: Record<string, PhotoReview> = {
﻿  // product
  "blue-mountain-grace": { photo: "/images/bouquets/bouquet-blue-mountain-grace-01.webp", sha256: "fcbac5efa406fc9a", verdict: "product" },
  "blush-garden-kiss": { photo: "/images/bouquets/bouquet-blush-garden-kiss-01.webp", sha256: "a6314700f81811a1", verdict: "product" },
  "cloud-nine-blue": { photo: "/images/bouquets/bouquet-cloud-nine-blue-01.webp", sha256: "0f59e417bd1e0bbd", verdict: "product" },
  "cloud-white": { photo: "/images/bouquets/bouquet-cloud-white-01.webp", sha256: "67e0cb7c74c8b829", verdict: "product" },
  "colour-pop-love": { photo: "/images/bouquets/bouquet-colour-pop-love-01.webp", sha256: "397f5fc83a77c139", verdict: "product" },
  "colourful-confession": { photo: "/images/bouquets/bouquet-colourful-confession-01.webp", sha256: "5c48dcb25daf49c6", verdict: "product" },
  "cotton-candy": { photo: "/images/bouquets/bouquet-cotton-candy-01.webp", sha256: "18d102f16bf5618e", verdict: "product" },
  "cotton-candy-poetry": { photo: "/images/bouquets/bouquet-cotton-candy-poetry-01.webp", sha256: "af6e7b67b77cdd88", verdict: "product" },
  "country-love-note": { photo: "/images/bouquets/bouquet-country-love-note-01.webp", sha256: "93ab96f933386760", verdict: "product" },
  "daisy-morning": { photo: "/images/bouquets/bouquet-daisy-morning-01.webp", sha256: "a152bbff982b86d1", verdict: "product" },
  "dear-sunshine": { photo: "/images/bouquets/bouquet-dear-sunshine-01.webp", sha256: "94b7e7cafb43e451", verdict: "product" },
  "first-love": { photo: "/images/bouquets/bouquet-first-love-01.webp", sha256: "6f088a7ad1d94388", verdict: "product" },
  "lavender-whisper": { photo: "/images/bouquets/bouquet-lavender-whisper-01.webp", sha256: "3c4e954f063a83bd", verdict: "product" },
  "lilac-garden": { photo: "/images/bouquets/bouquet-lilac-garden-01.webp", sha256: "88962b38df33a208", verdict: "product" },
  "lily-calm": { photo: "/images/bouquets/bouquet-lily-calm-01.webp", sha256: "b663b9e66e126cbf", verdict: "product" },
  "little-lilly-prayer": { photo: "/images/bouquets/bouquet-little-lilly-prayer-01.webp", sha256: "d3c67cf11f1b948b", verdict: "product" },
  "love-at-first-sight": { photo: "/images/bouquets/bouquet-love-at-first-sight-01.webp", sha256: "ed18b47b12df8189", verdict: "product" },
  "midnight-romance": { photo: "/images/bouquets/bouquet-midnight-romance-01.webp", sha256: "ad7d87d6d2c47991", verdict: "product" },
  "peach-petal-promise": { photo: "/images/bouquets/bouquet-peach-petal-promise-01.webp", sha256: "664b05ed2fbf5d52", verdict: "product" },
  "pink-lily-wish": { photo: "/images/bouquets/bouquet-pink-lily-wish-01.webp", sha256: "a74be7a2c776f956", verdict: "product" },
  "pink-secret": { photo: "/images/bouquets/bouquet-pink-secret-01.webp", sha256: "af82e6cea7361561", verdict: "product" },
  "pink-tulip-promise": { photo: "/images/bouquets/bouquet-pink-tulip-promise-01.webp", sha256: "651573dbec3f97a0", verdict: "product" },
  "purple-crush": { photo: "/images/bouquets/bouquet-purple-crush-01.webp", sha256: "7ce0e8f7f5afea27", verdict: "product" },
  "purple-promise": { photo: "/images/bouquets/bouquet-purple-promise-01.webp", sha256: "419f82d63e150af8", verdict: "product" },
  "purple-whisper": { photo: "/images/bouquets/bouquet-purple-whisper-01.webp", sha256: "d5f6a17d674c62ef", verdict: "product" },
  "rainbow-hug": { photo: "/images/bouquets/bouquet-rainbow-hug-01.webp", sha256: "2ef95419226de123", verdict: "product" },
  "red-affair": { photo: "/images/bouquets/bouquet-red-affair-01.webp", sha256: "7a852cbf826f8875", verdict: "product" },
  "rose-promise": { photo: "/images/bouquets/bouquet-rose-promise-01.webp", sha256: "6a0abf2acb16c969", verdict: "product" },
  "snow-white-saga": { photo: "/images/bouquets/bouquet-snow-white-saga-01.webp", sha256: "a1c8f1b581c5e4a2", verdict: "product" },
  "sunshine-confession": { photo: "/images/bouquets/bouquet-sunshine-confession-01.webp", sha256: "aab8a22699777b30", verdict: "product" },
  "sunshine-story": { photo: "/images/bouquets/bouquet-sunshine-story-01.webp", sha256: "819b7888928cc828", verdict: "product" },
  "sweet-petal-hour": { photo: "/images/bouquets/bouquet-sweet-petal-hour-01.webp", sha256: "73cb653cf773c553", verdict: "product" },
  "timeless-hug": { photo: "/images/bouquets/bouquet-timeless-hug-01.webp", sha256: "87071e2d96fe4fe1", verdict: "product" },
  "violet-picnic": { photo: "/images/bouquets/bouquet-violet-picnic-01.webp", sha256: "040fa304cbc742b0", verdict: "product" },
  "white-silence": { photo: "/images/bouquets/bouquet-white-silence-01.webp", sha256: "25cad00a041ccd3f", verdict: "product" },
  "wild-sunset-charm": { photo: "/images/bouquets/bouquet-wild-sunset-charm-01.webp", sha256: "727ed8d46eceb53c", verdict: "product" },
  "winter-whisper": { photo: "/images/bouquets/bouquet-winter-whisper-01.webp", sha256: "eac87cf4917b584a", verdict: "product" },
  "all-white-fragrance": { photo: "/images/lilies/lily-all-white-fragrance-01.webp", sha256: "c4c0adec64baeb55", verdict: "product" },
  "fragrance-festive-giftbox": { photo: "/images/lilies/lily-fragrance-festive-giftbox-01.webp", sha256: "fdc220b8483037b6", verdict: "product" },
  "pink-serenity-flowerbox": { photo: "/images/lilies/lily-pink-serenity-flowerbox-01.webp", sha256: "8e3313e9901c9a8a", verdict: "product" },
  "blush-lily-letter": { photo: "/images/lilies/lily-blush-lily-letter-01.webp", sha256: "1360d038b67b0f39", verdict: "product" },
  "coral-lily-bloom": { photo: "/images/lilies/lily-coral-lily-bloom-01.webp", sha256: "72e7846cbec74f67", verdict: "product" },
  "ivory-lily-grace": { photo: "/images/lilies/lily-ivory-lily-grace-01.webp", sha256: "15828fcd4617ae60", verdict: "product" },
  "sunrise-asiatic-vase": { photo: "/images/lilies/lily-sunrise-asiatic-vase-01.webp", sha256: "1350b725129d1f83", verdict: "product" },
  "jasmine-malli": { photo: "/images/jasmine.jpg", sha256: "4c8748fe4025dc9c", verdict: "product" },
  "jasmine-malli-subscription": { photo: "/images/jasmine.jpg", sha256: "4c8748fe4025dc9c", verdict: "product" },
  // unconfirmed
  "mandarin-lily-glow": { photo: "/images/lilies/lily-mandarin-lily-glow-01.webp", sha256: "ad325e22c80ccb7c", verdict: "unconfirmed" },
  "luxe-lily-bloom": { photo: "/images/lilies/lily-luxe-lily-bloom-01.webp", sha256: "32d7dec24ca51646", verdict: "unconfirmed" },
  "stargazer-affair": { photo: "/images/lilies/lily-stargazer-affair-01.webp", sha256: "df35af64cace9d5a", verdict: "unconfirmed" },
  // illustrative
  "daily-pooja-flowers": { photo: "/images/cat-pooja.jpg", sha256: "a7e06a1608d233aa", verdict: "illustrative" },
  "pooja-flower-box": { photo: "/images/pooja-flowers.jpg", sha256: "61f8d55ab9afa727", verdict: "illustrative" },
  "temple-bulk-flowers": { photo: "/images/cat-pooja.jpg", sha256: "a7e06a1608d233aa", verdict: "illustrative" },
  "diy-flowerbox": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "illustrative" },
  "loose-flower-box": { photo: "/images/bouquet-6.jpg", sha256: "2175beac16cf1607", verdict: "illustrative" },
  "pooja-flowerbox": { photo: "/images/jasmine.jpg", sha256: "4c8748fe4025dc9c", verdict: "illustrative" },
  "flower-basket": { photo: "/images/cat-basket.jpg", sha256: "ff64d79c527d8a1a", verdict: "illustrative" },
  "gift-basket": { photo: "/images/cat-basket.jpg", sha256: "ff64d79c527d8a1a", verdict: "illustrative" },
  "pooja-basket": { photo: "/images/cat-pooja.jpg", sha256: "a7e06a1608d233aa", verdict: "illustrative" },
  "flowers-under-499": { photo: "/images/bouquet-9.jpg", sha256: "baf05ba6a6e59662", verdict: "illustrative" },
  "bouquets-under-999": { photo: "/images/bouquet-4.jpg", sha256: "d6a71094b34bc284", verdict: "illustrative" },
  "flower-gifts-under-1499": { photo: "/images/bouquet-1.jpg", sha256: "927367abeb1ecf1e", verdict: "illustrative" },
  "todays-flower-offers": { photo: "/images/bouquet-2.jpg", sha256: "e3c86144d5504e85", verdict: "illustrative" },
  "candle-diffuser-addon": { photo: "/images/addon-candle.jpg", sha256: "7f1598175f67efd9", verdict: "illustrative" },
  "premium-card-addon": { photo: "/images/cards/iloveu.jpg", sha256: "9ec490694a7d2284", verdict: "illustrative" },
  "table-decor-addon": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "illustrative" },
  "daily-pooja-flower-subscription": { photo: "/images/banner-pooja.jpg", sha256: "53a29418b59e6cda", verdict: "illustrative" },
  "weekly-flowerbox-subscription": { photo: "/images/bouquet-7.jpg", sha256: "7a27fac3487a8901", verdict: "illustrative" },
  "custom-flower-subscription": { photo: "/images/bouquet-5.jpg", sha256: "4afe7966618cdbf2", verdict: "illustrative" },
  "clear-glass-vase": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "illustrative" },
  "fresh-flower-toran": { photo: "/images/occasion-event.jpg", sha256: "0f28623c05a9efae", verdict: "illustrative" },
  "jasmine-gajra": { photo: "/images/jasmine.jpg", sha256: "4c8748fe4025dc9c", verdict: "illustrative" },
  "housewarming-flower-hamper": { photo: "/images/cat-basket.jpg", sha256: "ff64d79c527d8a1a", verdict: "illustrative" },
  "event-garlands": { photo: "/images/cat-pooja.jpg", sha256: "a7e06a1608d233aa", verdict: "illustrative" },
  "roses-by-stem": { photo: "/images/rose-bouquet.jpg", sha256: "d3d8fd488caf8290", verdict: "illustrative" },
  // unrelated
  "gift-flower-box": { photo: "/images/bouquet-3.jpg", sha256: "65a5fd55ba943666", verdict: "unrelated" },
  "premium-flower-basket": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "unrelated" },
  "dried-flower-bunch": { photo: "/images/addon-candle.jpg", sha256: "7f1598175f67efd9", verdict: "unrelated" },
  "dried-flower-vase-set": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "unrelated" },
  "mini-succulent-gift": { photo: "/images/cat-plant.jpg", sha256: "401a56aec394e266", verdict: "unrelated" },
  "plant-and-flower-hamper": { photo: "/images/bouquet-10.jpg", sha256: "baf05ba6a6e59662", verdict: "unrelated" },
  "premium-decor-vase": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "unrelated" },
  "florist-cutter": { photo: "/images/addon-table-decor.jpg", sha256: "5f8b9a515a968648", verdict: "unrelated" },
  "room-mist-flower-gift-addon": { photo: "/images/addon-candle.jpg", sha256: "7f1598175f67efd9", verdict: "unrelated" },
  "flower-chocolate-hamper": { photo: "/images/cat-bouquets.jpg", sha256: "9abe0d6df649aaeb", verdict: "unrelated" },
  "bridal-flower-accessories": { photo: "/images/event-flowers.jpg", sha256: "e36f56a1324e1204", verdict: "unrelated" },
  "lilies-by-stem": { photo: "/images/bouquet-2.jpg", sha256: "e3c86144d5504e85", verdict: "unrelated" },
};

export const PLACEHOLDER_PHOTO = "/images/product-placeholder.svg";

/** How the product's current photograph relates to it: a reviewed verdict, "missing" (placeholder) or "unreviewed". */
export function photoStatus(product: Pick<Product, "slug" | "image">): PhotoVerdict | "missing" | "unreviewed" {
  if (!product.image || /\.svg$/i.test(product.image)) return "missing";
  const review = PHOTO_REVIEWS[product.slug];
  return review && review.photo === product.image ? review.verdict : "unreviewed";
}

/** A description of what a photograph shows, or null when none has been written. */
export const photoDescription = (path: string): string | null => PHOTO_DESCRIPTIONS[path] ?? null;

/** The photograph shows the product as sold: the only kind listed in the image sitemap. */
export const isProductPhotograph = (product: Pick<Product, "slug" | "image">) => photoStatus(product) === "product";

/** Shown on the product's page as a representative picture, with this description. */
export const representativePhoto = (product: Pick<Product, "slug" | "image">): string | null =>
  photoStatus(product) === "illustrative" ? photoDescription(product.image) : null;

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const isBouquet = (product: Pick<Product, "category">) => /^(bouquets|lilies)$/i.test(product.category);

/**
 * Alternative text for a product's photograph wherever the product is shown.
 * It starts with the product name, so a linked image still names its product.
 *   product / unconfirmed: bouquets from their record (bouquetPhotoAlt, which
 *     claims no presentation for unconfirmed designs); others from the photograph;
 *   illustrative: "representative photograph of …";
 *   missing: the placeholder says so; unreviewed: the name only, no claim.
 */
export function productPhotoAlt(product: Product): string {
  const status = photoStatus(product);
  const shows = photoDescription(product.image);
  if ((status === "product" || status === "unconfirmed") && isBouquet(product)) return bouquetPhotoAlt(product);
  if (status === "product" && shows) return `${product.name}: ${lowerFirst(shows)}`;
  if (status === "illustrative" && shows) return `${product.name}: representative photograph of ${lowerFirst(shows)}`;
  if (status === "missing") return `${product.name}: no photograph yet`;
  return product.name;
}
