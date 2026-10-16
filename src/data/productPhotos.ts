// Which catalogue photographs show their own product, and what the others
// show. Read by product pages, cards and the image sitemap (sitemap.xml.ts).
//
// A product has its own photograph when the file is named for that product
// (bouquets/bouquet-<slug>-01.webp, lilies/lily-<slug>-01.webp) and no other
// product uses it. Every other catalogue photograph is a representative
// picture: shared by several products, or showing something other than the
// product (sunflower jars for a florist cutter). Those are described by what
// is in the picture, looked at photograph by photograph (16 October 2026),
// and are never offered to search as a picture of the product.
import { productCatalog, type Product } from "./productCatalog";
import { bouquetPhotoAlt } from "./collectionGuidance";

/** What each representative photograph shows. Only visible content: no flower count, size or claim that it is the product. */
export const REPRESENTATIVE_PHOTOS: Record<string, string> = {
  "/images/addon-candle.jpg": "Three stacked candles decorated with pressed flowers",
  "/images/addon-table-decor.jpg": "Sunflowers, white daisies and small purple flowers in glass jars along a dining table",
  "/images/banner-pooja.jpg": "A home pooja room hung with marigold strings above an altar of framed deities",
  "/images/bouquet-1.jpg": "A bouquet of pink tulips and baby's breath in pink paper, tied with a satin bow, by a window",
  "/images/bouquet-2.jpg": "A bouquet of mixed flowers, including gerberas, daisies and purple larkspur, in kraft paper tied with red string",
  "/images/bouquet-3.jpg": "Orange and yellow daisy-like flowers with purple bellflowers, wrapped in newspaper",
  "/images/bouquet-4.jpg": "Orange flowers, lavender and small white daisies in kraft paper",
  "/images/bouquet-5.jpg": "A wicker basket of pink gerberas, daisies and other garden flowers on grass",
  "/images/bouquet-6.jpg": "A hand holding a bunch of wildflowers: daisies, a peach rose and purple flowers",
  "/images/bouquet-7.jpg": "Blue and white flowers with yellow daisies in a metal jug",
  "/images/bouquet-9.jpg": "Pink and cream tulips in a metal watering can",
  "/images/bouquet-10.jpg": "Pink and cream tulips in a metal watering can",
  "/images/cards/iloveu.jpg": "A greeting card with quilled red heart-shaped flowers and the words Happy Valentine's Day, on an envelope",
  "/images/cat-basket.jpg": "A wicker basket of gerberas, pink lilies, roses, hydrangea and purple stock",
  "/images/cat-bouquets.jpg": "Sunflowers with yellow and white roses in white wrapping",
  "/images/cat-plant.jpg": "Pink and orange bougainvillea in a glass vase on a table",
  "/images/cat-pooja.jpg": "A pooja set-up with marigold and jasmine strings",
  "/images/event-flowers.jpg": "A building front hung with pink flowers and strings of lights",
  "/images/jasmine.jpg": "White jasmine buds",
  "/images/occasion-event.jpg": "A doorway framed with white and yellow flower strings",
  "/images/pooja-flowers.jpg": "A cane basket of loose flowers for pooja: yellow blooms, marigold, hibiscus, pink flowers, butterfly pea and jasmine",
  "/images/rose-bouquet.jpg": "Red roses tied with a red ribbon",
};

/** A description of a representative photograph, or null for one not described. */
export const photoDescription = (path: string): string | null => REPRESENTATIVE_PHOTOS[path] ?? null;

/** True when the photograph is this product's own (see the header). */
export function hasOwnPhotograph(product: Pick<Product, "slug" | "image">, catalogue: Pick<Product, "slug" | "image">[] = productCatalog): boolean {
  const file = product.image.split("/").pop() ?? "";
  return file.includes(product.slug) && !catalogue.some((other) => other.slug !== product.slug && other.image === product.image);
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Alternative text for a product's photograph wherever the product is shown.
 * Own photographs: the bouquet description from the record (bouquetPhotoAlt).
 * Representative photographs: the product name, then what the picture shows,
 * so a linked image still names its product without describing the product
 * as photographed.
 */
export function productPhotoAlt(product: Product): string {
  if (hasOwnPhotograph(product)) return /^(bouquets|lilies)$/i.test(product.category) ? bouquetPhotoAlt(product) : product.name;
  const shows = photoDescription(product.image);
  return shows ? `${product.name}: representative photograph of ${lowerFirst(shows)}` : product.name;
}
