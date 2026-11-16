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
import { recordedPresentation, type PresentationKind } from "./catalogueRange";

const SUPPORTING = /foliage|filler|greenery|gypsophila|eucalyptus|baby|leaves|leaf|fern|seasonal|buds?$|spray/i;
const SINGULAR: [RegExp, string][] = [[/ies$/i, "y"], [/(gerbera|dahlia|hydrangea|peon)s$/i, "$1"], [/ses$/i, "se"], [/s$/i, ""]];
const singular = (word: string) => { for (const [pattern, to] of SINGULAR) if (pattern.test(word)) return word.replace(pattern, to); return word; };
const titleCase = (text: string) => text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
// The form named in a title, from the recorded presentation
// (src/data/catalogueRange.ts): a design that comes in a box or a basket is
// not called a bouquet; an open presentation gets the neutral "Arrangement".
const FORM: Record<PresentationKind, string> = { wrapped: "Bouquet", unrecorded: "Bouquet", vase: "Vase Arrangement", box: "Flower Box", basket: "Flower Basket", unresolved: "Arrangement" };
export const formOf = (product: Product) => {
  const form = FORM[recordedPresentation(product).kind];
  // "Pink Serenity Flowerbox – Pink Lily Box", not "… Flowerbox … Flower Box".
  return form === "Flower Box" && /box\b/i.test(product.name) ? "Box" : form;
};

/** "Red Rose", "Pink & White Tulip", "Mixed Flower" — or null when the record does not support one. */
export function flowerDescriptor(product: Pick<Product, "flowerTypes">): string | null {
  const recorded = (product.flowerTypes ?? []).map((flower) => flower.trim()).filter(Boolean);
  let main = recorded.filter((flower) => !SUPPORTING.test(flower));
  // A design made only of gypsophila (Cloud Nine Blue, Pink Secret, Cotton
  // Candy) is named by it, not left without a flower: "Blue Gypsophila".
  // "Baby's breath" is the same flower and is not counted twice.
  if (main.length === 0) main = recorded.filter((flower) => /gypsophila/i.test(flower));
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

// Category names shown to customers where the stored category (which sets the
// URL) makes a claim: "Pet Friendly" is shown as "Homes with Pets".
const CATEGORY_LABEL: Record<string, string> = { "Pet Friendly": "Homes with Pets" };
export const categoryLabel = (category: string) => CATEGORY_LABEL[category] ?? category;

export function productTitle(product: Product): string {
  const label = categoryLabel(product.category);
  // A relabelled category already in the name is not repeated ("Flowerbox for Homes with Pets").
  const plain = label !== product.category && product.name.toLowerCase().includes(label.toLowerCase()) ? `${product.name} | ${BRAND}` : `${product.name} – ${label} | ${BRAND}`;
  if (!/^(bouquets|lilies)$/i.test(product.category)) return plain;
  const form = formOf(product);
  const descriptor = flowerDescriptor(product);
  // A box or basket with no main flower recorded is still named by what it is, not its legacy category.
  if (!descriptor) return /box|basket/i.test(form) ? `${product.name} – ${form === "Box" ? "Flower Box" : form} | ${BRAND}` : plain;
  // Words the name already says are not said again right after it.
  const nameWords = new Set(product.name.toLowerCase().split(/\s+/));
  const repeats = descriptor.toLowerCase().split(/[\s&]+/).filter(Boolean).some((word) => nameWords.has(word));
  const title = `${product.name}${repeats ? " –" : ""} ${descriptor} ${form} | ${BRAND}`;
  return title.length <= 70 ? title : `${product.name} – ${descriptor.split(" ").at(-1)} ${form} | ${BRAND}`;
}
