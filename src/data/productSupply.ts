// What a product is and what is supplied, for the product page, product cards
// and the WhatsApp drafts. Read from the catalogue record (category, flowers,
// included items) and the short per-product lines below; nothing is read from
// a photograph, and nothing here adds a fact the record does not hold.
//
// - productKind: which page facts apply. A florist cutter is not "fresh
//   flowers", "hand-arranged" or subject to flower substitutions.
// - productIdentity: the plain line under the product name ("Blue gypsophila
//   bouquet"), so a creative name says what it is. Bouquets and lilies take it
//   from the recorded flowers and presentation (src/data/productTitles.ts);
//   other products from PRODUCT_IDENTITY.
// - suppliedItems: included items, and what is only on request. Ordering steps
//   ("Availability confirmation on WhatsApp") are not items.
// - quantityBasis: what one unit is, where the record says (a bouquet, a box,
//   a stem, a toran made to length); otherwise how quantity is agreed.
import type { Product } from "./productCatalog";
import { flowerDescriptor, formOf } from "./productTitles";
import { OCCASION_FILTER_LABELS } from "./shoppingTaxonomy";

export type ProductKind = "design" | "loose" | "plan" | "range" | "item" | "dried" | "plant";

const KIND_BY_CATEGORY: Record<string, ProductKind> = {
  Bouquets: "design",
  Lilies: "design",
  Baskets: "design",
  Hampers: "design",
  Wedding: "design",
  "Pet Friendly": "design",
  Flowerbox: "design",
  "Pooja Flowers": "loose",
  "By Stems": "loose",
  "Flower Strings & Torans": "loose",
  Subscriptions: "plan",
  Offers: "range",
  "Add-ons": "item",
  Vases: "item",
  "Floral Tools": "item",
  "Room Mist & Diffuser": "item",
  "Dried Flowers": "dried",
  "Plants & Succulents": "plant",
};

// Products whose record makes them a different kind from their category.
const KIND_BY_SLUG: Record<string, ProductKind> = {
  "diy-flowerbox": "loose",
  "loose-flower-box": "loose",
  "pooja-flowerbox": "loose",
  "plant-and-flower-hamper": "design",
  "fresh-flower-toran": "design",
};

export function productKind(product: Pick<Product, "slug" | "category" | "flowerTypes">): ProductKind {
  return KIND_BY_SLUG[product.slug] ?? KIND_BY_CATEGORY[product.category] ?? ((product.flowerTypes?.length ?? 0) > 0 ? "design" : "item");
}

/** Fresh flowers are what is sold (or, for a plan or a budget band, what is delivered). */
export const sellsFreshFlowers = (kind: ProductKind) => kind === "design" || kind === "loose" || kind === "plan" || kind === "range";

/**
 * The identity line for products that are not bouquets, written from each
 * record (its description and included items). Short: it also stands in for
 * the category label on product cards.
 */
export const PRODUCT_IDENTITY: Record<string, string> = {
  "daily-pooja-flowers": "Loose pooja flowers",
  "jasmine-malli": "Loose jasmine (malli)",
  "pooja-flower-box": "Assorted pooja flowers in a box",
  "temple-bulk-flowers": "Bulk flowers for temples and events",
  "diy-flowerbox": "Loose flowers to arrange yourself",
  "loose-flower-box": "Loose seasonal flowers in a box",
  "gift-flower-box": "Arranged flowers in a gift box",
  "pooja-flowerbox": "Pooja flowers in a box",
  "flower-basket": "Arranged flowers in a basket",
  "gift-basket": "Flower basket, add-ons optional",
  "pooja-basket": "Pooja flowers in a basket",
  "premium-flower-basket": "Custom flower basket",
  "flowers-under-499": "Budget band: flowers under ₹499",
  "bouquets-under-999": "Budget band: bouquets under ₹999",
  "flower-gifts-under-1499": "Budget band: gifts under ₹1499",
  "todays-flower-offers": "Offers from today's flowers",
  "chocolates-addon": "Add-on: chocolates",
  "candle-diffuser-addon": "Add-on: candle or diffuser",
  "premium-card-addon": "Add-on: greeting card",
  "table-decor-addon": "Add-on: event table decor",
  "daily-pooja-flower-subscription": "Plan: regular pooja flowers",
  "weekly-flowerbox-subscription": "Plan: a flower box every week",
  "jasmine-malli-subscription": "Plan: regular jasmine / malli",
  "custom-flower-subscription": "Plan: flowers on your schedule",
  "dried-flower-bunch": "Dried stems, no water needed",
  "dried-flower-vase-set": "Dried flower arrangement, made to order",
  "mini-succulent-gift": "Live mini succulent",
  "plant-and-flower-hamper": "Flowers with a small plant",
  "clear-glass-vase": "Clear glass vase",
  "premium-decor-vase": "Decor vase, quoted by type",
  "florist-cutter": "Stem cutter for home arranging",
  "flower-food-sachets": "Flower food for vase water",
  "pet-friendly-flowerbox": "Flower box for a home with pets",
  "fresh-flower-toran": "Fresh toran, made to length",
  "jasmine-gajra": "Jasmine gajra for hair",
  "room-mist-flower-gift-addon": "Add-on: room mist or diffuser",
  "flower-chocolate-hamper": "Flowers with chocolates",
  "housewarming-flower-hamper": "Flowers, with optional extras",
  "bridal-flower-accessories": "Gajra, poola jada and hair florals",
  "event-garlands": "Event garlands, priced on the day",
  "roses-by-stem": "Rose stems, sold by the stem",
  "lilies-by-stem": "Lily stems, sold by the stem",
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase().replace(/\basiatic\b/g, "Asiatic");

/** "Blue gypsophila bouquet", "Gerbera & daisy vase arrangement", "Stem cutter for home arranging" — or null. */
export function productIdentity(product: Product): string | null {
  if (PRODUCT_IDENTITY[product.slug]) return PRODUCT_IDENTITY[product.slug];
  if (!/^(bouquets|lilies)$/i.test(product.category)) return null;
  const descriptor = flowerDescriptor(product);
  const form = formOf(product);
  const formLabel = form === "Box" ? "Flower Box" : form;
  return descriptor ? sentence(`${descriptor} ${formLabel}`) : formLabel === "Bouquet" ? null : sentence(formLabel);
}

// An ordering step written as an item: shown once beside the price, not as something supplied.
const PROCESS_STEP = /\b(confirmation|confirmed|whatsapp|final (price|quote|option)|market[- ]?(price|rate|based pricing)|quote\b)/i;
const ON_REQUEST = /\s*\b(on request|optional)\b\s*/i;

// A container (vase, pot, box, basket) offered "depending on availability"
// is not known to be included or optional: it belongs with the quote, not in
// either list.
// ("Vase option based on availability", "Basket, depending on availability";
// not "Clear glass vase (size depends on availability)", where the vase is the product.)
const UNRESOLVED_CONTAINER = /\b(vase|pot|planter|box|basket)\b(\s+option)?,?\s+(depending on|based on) availability\b/i;

/**
 * Included items, on-request items, and what is agreed in the quote because
 * the record says neither. Admin-added records are read the same way.
 */
export function suppliedItems(product: Pick<Product, "whatsIncluded" | "onRequest" | "toConfirm">): { included: string[]; onRequest: string[]; toConfirm: string[] } {
  const included: string[] = [];
  const toConfirm = [...(product.toConfirm ?? [])];
  const onRequest = (product.onRequest ?? []).filter((item) => {
    if (!UNRESOLVED_CONTAINER.test(item)) return true;
    toConfirm.push(item);
    return false;
  });
  for (const item of product.whatsIncluded ?? []) {
    if (PROCESS_STEP.test(item)) continue;
    if (UNRESOLVED_CONTAINER.test(item)) {
      toConfirm.push(item);
      continue;
    }
    if (ON_REQUEST.test(item)) {
      const cleaned = item.replace(ON_REQUEST, " ").replace(/\s+/g, " ").trim();
      if (cleaned && !onRequest.includes(cleaned)) onRequest.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
    } else included.push(item);
  }
  return { included, onRequest, toConfirm };
}

/** The WhatsApp draft's question for what the quote must settle, or null. */
export function enquiryConfirmLine(product: Pick<Product, "whatsIncluded" | "onRequest" | "toConfirm">): string | null {
  const { toConfirm } = suppliedItems(product);
  return toConfirm.length ? `Please confirm in the quote: ${toConfirm.map((item) => item.charAt(0).toLowerCase() + item.slice(1)).join("; ")}.` : null;
}

/** What one unit is, where the record says it. */
const QUANTITY_BASIS: Record<string, string> = {
  "roses-by-stem": "Sold by the stem. Tell us how many stems and the colour; colours depend on the day's market.",
  "lilies-by-stem": "Sold by the stem. Tell us how many stems and the colour; colours depend on the day's stock.",
  "fresh-flower-toran": "One toran, made to the length you need. Tell us the length and how many.",
  "event-garlands": "Priced by flower type, size and count. Tell us how many garlands, and their size.",
  "diy-flowerbox": "One box of loose flowers. The mix and quantity of flowers are agreed on WhatsApp.",
  "loose-flower-box": "One box of loose flowers. The quantity of flowers is agreed on WhatsApp.",
  "weekly-flowerbox-subscription": "One flower box each week, on delivery days agreed on WhatsApp.",
  "jasmine-malli-subscription": "Quantity per delivery, and how often, agreed on WhatsApp.",
  "daily-pooja-flower-subscription": "Quantity per delivery, and how often, agreed on WhatsApp.",
  "temple-bulk-flowers": "Bulk quantity to your requirement; confirm large orders at least a day ahead.",
};

const KIND_QUANTITY: Record<ProductKind, string | null> = {
  design: null,
  loose: "Tell us how much you need; we confirm the quantity and the day's price on WhatsApp.",
  plan: "Quantity per delivery, and delivery days, agreed on WhatsApp.",
  range: "One selection within the budget band; we suggest the options on WhatsApp.",
  item: "Tell us how many you need.",
  dried: null,
  plant: null,
};

/** The quantity line, or null where one unit is the product itself (a bouquet, an arrangement, a dried bunch). */
export function quantityBasis(product: Pick<Product, "slug" | "category" | "flowerTypes">): string | null {
  return QUANTITY_BASIS[product.slug] ?? KIND_QUANTITY[productKind(product)];
}

/** The quiet caption under the description: only what is true of this kind of product. */
export function trustIndicators(product: Pick<Product, "slug" | "category" | "flowerTypes">): string[] {
  const kind = productKind(product);
  const base = ["Delivery Confirmed on WhatsApp", "WhatsApp Ordering"];
  if (kind === "design") return ["Fresh Flowers", ...base, "Hand-Arranged"];
  if (sellsFreshFlowers(kind)) return ["Fresh Flowers", ...base];
  return base;
}

/** The flower fact box: recorded flowers, or how flowers are chosen, or (for other products) what it is. */
export function flowerFact(product: Product): { label: string; text: string } | null {
  if (product.flowerTypes?.length) return { label: "Types of flowers", text: product.flowerTypes.join(", ") };
  const kind = productKind(product);
  if (sellsFreshFlowers(kind)) return { label: "Flowers", text: "Chosen from what is fresh that day; tell us any flower or colour you prefer." };
  if (kind === "dried") return { label: "Flowers", text: "Dried stems from the stock available; tell us the colours you prefer." };
  const identity = productIdentity(product);
  return identity ? { label: "What it is", text: identity } : null;
}

/** "Ideal for", in words: the record's own list, else its occasions by name (never raw slugs). */
export function idealForText(product: Pick<Product, "idealFor" | "occasionTags">): string | null {
  if (product.idealFor?.length) return product.idealFor.join(", ");
  const names = (product.occasionTags ?? []).map((slug) => OCCASION_FILTER_LABELS[slug] ?? slug.replace(/-/g, " "));
  return names.length ? names.join(", ") : null;
}

export function preparationText(product: Pick<Product, "slug" | "category" | "flowerTypes" | "requiresConfirmation">): string {
  const kind = productKind(product);
  if (kind === "plan") return "The first delivery is arranged once the delivery days and start date are agreed on WhatsApp.";
  if (kind === "item" || kind === "plant" || kind === "dried") return "Supplied once we confirm the option and price with you on WhatsApp.";
  return product.requiresConfirmation ? "Made to order once we confirm it with you on WhatsApp." : "Confirmed with you on WhatsApp before we prepare it.";
}

export function substitutionText(product: Pick<Product, "slug" | "category" | "flowerTypes">): string {
  const kind = productKind(product);
  if (sellsFreshFlowers(kind)) return "Flowers depend on what is fresh that day; we agree any change with you before you pay.";
  if (kind === "dried") return "Dried stems vary with the stock; we agree any change with you before you pay.";
  return "If this option is not available, we suggest another before you pay.";
}

/** What a quotation depends on, for a quoted product. */
export function quoteDrivers(product: Pick<Product, "slug" | "category" | "flowerTypes">): string {
  const kind = productKind(product);
  if (kind === "item" || kind === "plant") return "The price depends on the option available, such as its type or size, and how many you need.";
  if (kind === "plan") return "The price depends on the flowers, the quantity per delivery and how often you want them.";
  if (kind === "dried") return "The price depends on the dried stems, the size and the presentation.";
  return "The price depends on the design, flowers, quantity and date.";
}

/** The identity line inside a sentence: first letter lowered, unless it starts a proper name ("Asiatic"). */
export const identityInSentence = (identity: string) => (/^(Asiatic|Oriental)\b/.test(identity) ? identity : identity.charAt(0).toLowerCase() + identity.slice(1));

/** How a WhatsApp draft names the product: "Cloud Nine Blue (blue gypsophila bouquet)". */
export function enquiryName(product: Product): string {
  const identity = productIdentity(product);
  return identity ? `${product.name} (${identityInSentence(identity)})` : product.name;
}

/** "Quantity: 1" for one design; a product sold by quantity asks for the amount instead. */
export function enquiryQuantityLine(product: Pick<Product, "slug" | "category" | "flowerTypes">): string {
  return !/^(bouquets|lilies)$/i.test(product.category) && quantityBasis(product) !== null ? "Quantity needed: " : "Quantity: 1";
}

export { categoryLabel } from "./productTitles";
