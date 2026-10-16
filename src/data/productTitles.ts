// Product page titles and descriptors, built from what the catalogue records
// for a product (flowerTypes, whatsIncluded). The model name and URL never
// change; the title adds the flower and the form, e.g.
//   Red Affair Red Rose Bouquet | Fresh Petals
//   Blush Lily Letter – Blush Lily Bouquet | Fresh Petals
//   First Love Pink & White Tulip Bouquet | Fresh Petals
// Nothing is read from a photograph, and a product with no recorded flowers
// keeps its plain "Name – Category" title. Garlands have their own titles
// (name and FP-G code) and are not handled here.
import type { Product } from "./productCatalog";
import { presentationCheck } from "./collectionGuidance";

const SUPPORTING = /foliage|filler|greenery|gypsophila|eucalyptus|baby|leaves|leaf|fern|seasonal|buds?$|spray/i;
const SINGULAR: [RegExp, string][] = [[/ies$/i, "y"], [/(gerbera|dahlia|hydrangea|peon)s$/i, "$1"], [/ses$/i, "se"], [/s$/i, ""]];
const singular = (word: string) => { for (const [pattern, to] of SINGULAR) if (pattern.test(word)) return word.replace(pattern, to); return word; };
const titleCase = (text: string) => text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const VASE = (product: Product) => (product.whatsIncluded ?? []).some((item) => /\bvase\b/i.test(item));

/** "Red Rose", "Pink & White Tulip", "Mixed Flower" — or null when the record does not support one. */
export function flowerDescriptor(product: Pick<Product, "flowerTypes">): string | null {
  const main = (product.flowerTypes ?? []).map((flower) => flower.trim()).filter((flower) => flower && !SUPPORTING.test(flower));
  if (main.length === 0) return null;
  const parts = main.map((flower) => { const words = flower.split(/\s+/); return { noun: singular(words.at(-1)!).toLowerCase(), colour: words.slice(0, -1).join(" ").toLowerCase() }; });
  const nouns = [...new Set(parts.map((part) => part.noun))];
  if (nouns.length === 1) {
    const colours = [...new Set(parts.map((part) => part.colour).filter(Boolean))];
    if (colours.length > 2) return titleCase(`mixed ${nouns[0]}`);
    return titleCase(`${colours.join(" & ")} ${nouns[0]}`.trim());
  }
  if (nouns.length === 2 && parts.length === 2) return titleCase(`${parts[0].noun} & ${parts[1].noun}`);
  return "Mixed Flower";
}

const BRAND = "Fresh Petals";

export function productTitle(product: Product): string {
  const plain = `${product.name} – ${product.category} | ${BRAND}`;
  if (!/^(bouquets|lilies)$/i.test(product.category)) return plain;
  const descriptor = flowerDescriptor(product);
  if (!descriptor) return plain;
  // An unconfirmed presentation (presentationCheck) gets the neutral form its own description uses.
  const form = presentationCheck(product) ? "Arrangement" : VASE(product) ? "Vase Arrangement" : "Bouquet";
  // Words the name already says are not said again right after it.
  const nameWords = new Set(product.name.toLowerCase().split(/\s+/));
  const repeats = descriptor.toLowerCase().split(/[\s&]+/).filter(Boolean).some((word) => nameWords.has(word));
  const title = `${product.name}${repeats ? " –" : ""} ${descriptor} ${form} | ${BRAND}`;
  return title.length <= 70 ? title : `${product.name} – ${descriptor.split(" ").at(-1)} ${form} | ${BRAND}`;
}
