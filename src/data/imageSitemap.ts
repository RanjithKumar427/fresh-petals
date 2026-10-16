// Image entries for the existing sitemaps (sitemap.xml, sitemap-garlands.xml),
// in the Google image sitemap extension. A page lists only the photographs
// that belong to it: a catalogue product's own photograph
// (src/data/productPhotos.ts) and a public garland's main photograph and
// confirmed gallery. Representative pictures, garland related-view
// candidates and the placeholder are never listed. Original files only, not
// their resized copies; each image appears once per page.
import type { Product } from "./productCatalog";
import type { GarlandDesign } from "./garlandRules";
import { hasOwnPhotograph } from "./productPhotos";

export const IMAGE_SITEMAP_NS = 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
export const xmlEscape = (text: string) => text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

/** A site path ("/images/…") made absolute against the site; an https URL (stored upload) kept as it is. */
export const absoluteImage = (path: string, site: URL | string) => new URL(path, site).toString();

const isPhotograph = (path: string | undefined | null): path is string => Boolean(path) && !/\.svg$/i.test(path!);

/** The catalogue product's own photograph, or none. */
export const productImages = (product: Pick<Product, "slug" | "image">, catalogue?: Pick<Product, "slug" | "image">[]) =>
  isPhotograph(product.image) && hasOwnPhotograph(product, catalogue) ? [product.image] : [];

/** A garland's main photograph and its confirmed gallery, as its page shows them. */
export const garlandImages = (design: Pick<GarlandDesign, "image" | "gallery">) => [design.image.path, ...design.gallery.map((photo) => photo.path)].filter(isPhotograph);

/** One <url> entry with optional <lastmod> and image children; duplicate images dropped. */
export function urlEntry(loc: string, { lastmod = "", images = [], site }: { lastmod?: string | null; images?: string[]; site: URL | string }): string {
  const unique = [...new Set(images.map((path) => absoluteImage(path, site)))];
  const imageXml = unique.map((url) => `<image:image><image:loc>${xmlEscape(url)}</image:loc></image:image>`).join("");
  return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${imageXml}</url>`;
}
