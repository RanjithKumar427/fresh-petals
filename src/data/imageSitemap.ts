// Image entries for the existing sitemaps (sitemap.xml, sitemap-garlands.xml),
// in the Google image sitemap extension. A page lists only the photographs
// that belong to it: a catalogue photograph reviewed as showing the product
// (src/data/productPhotos.ts, verdict "product") and a public garland's main
// photograph and confirmed gallery. Illustrative, unrelated, unconfirmed and
// unreviewed photographs, garland related-view candidates and the placeholder
// are never listed. Original files only, not their resized copies; each image
// appears once per page (one file may serve several pages).
import type { Product } from "./productCatalog";
import type { GarlandDesign } from "./garlandRules";
import { isProductPhotograph } from "./productPhotos";

export const IMAGE_SITEMAP_NS = 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const xmlEscape = (text: string) => text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

/** A site path ("/images/…") made absolute against the site; an https URL (stored upload) kept as it is. */
export const absoluteImage = (path: string, site: URL | string) => new URL(path, site).toString();

const isPhotograph = (path: string | undefined | null): path is string => Boolean(path) && !/\.svg$/i.test(path!);

/** The catalogue product's photograph when it is reviewed as showing the product, or none. */
export const productImages = (product: Pick<Product, "slug" | "image">) => (isPhotograph(product.image) && isProductPhotograph(product) ? [product.image] : []);

/** A garland's main photograph and its confirmed gallery, as its page shows them. */
export const garlandImages = (design: Pick<GarlandDesign, "image" | "gallery">) => [design.image.path, ...design.gallery.map((photo) => photo.path)].filter(isPhotograph);

/** One <url> entry with optional <lastmod> and image children; duplicate images dropped. */
export function urlEntry(loc: string, { lastmod = "", images = [], site }: { lastmod?: string | null; images?: string[]; site: URL | string }): string {
  const unique = [...new Set(images.map((path) => absoluteImage(path, site)))];
  const imageXml = unique.map((url) => `<image:image><image:loc>${xmlEscape(url)}</image:loc></image:image>`).join("");
  return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${imageXml}</url>`;
}
