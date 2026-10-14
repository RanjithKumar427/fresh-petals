// Selection help for the bouquet and pooja collections
// (docs/seo/search-expansion-2026-10.md).
//
// Copy rules. Bouquet facts are read from each product's own record
// (flowerTypes, whatsIncluded) at render time, never retyped here, so a line
// can't drift from the catalogue. Nothing states a stem count, a size, a
// delivery time or a price. Pooja products record no pack size or unit, and
// several share a category photograph, so the copy says what to tell us and
// what we confirm, not what a pack contains.
import type { Product } from "./productCatalog";
import { whatsappLink } from "../config/storefront";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/** How a bouquet is presented, from its record: "in a glass vase", "in kraft wrapping", or null when unrecorded. */
export function bouquetPresentation(product: Product): string | null {
  const included = product.whatsIncluded ?? [];
  const vase = included.find((item) => /\bvase\b/i.test(item));
  if (vase) return `in a ${lowerFirst(vase)}`;
  const wrap = included.find((item) => /wrapping/i.test(item));
  return wrap ? `in ${lowerFirst(wrap)}` : null;
}

export const isVaseArrangement = (product: Product) => (product.whatsIncluded ?? []).some((item) => /\bvase\b/i.test(item));

/** The flowers recorded for a bouquet, as a phrase ("red roses and fresh rose foliage"), or null. */
export function bouquetFlowers(product: Product): string | null {
  const flowers = (product.flowerTypes ?? []).map(lowerFirst);
  return flowers.length ? list(flowers) : null;
}

/** Photograph description from the record: name, flowers and presentation. Falls back to the name. */
export function bouquetPhotoAlt(product: Product): string {
  const flowers = bouquetFlowers(product);
  if (!flowers) return product.name;
  return `${product.name}: ${flowers}${bouquetPresentation(product) ? `, ${bouquetPresentation(product)}` : ""}`;
}

/** One line per bouquet for a group's comparison list. */
export function bouquetLine(product: Product): string | null {
  const flowers = bouquetFlowers(product);
  if (!flowers) return null;
  const presentation = bouquetPresentation(product);
  return `${flowers.charAt(0).toUpperCase()}${flowers.slice(1)}${presentation ? `, ${presentation}` : ""}.`;
}

export type GroupGuidance = { intro: string; links: { href: string; label: string }[] };

/** Bouquet groups (ids from src/data/launchCatalogue.ts). */
export const BOUQUET_GROUP_GUIDANCE: Record<string, GroupGuidance> = {
  roses: {
    intro: "Rose bouquets differ mainly in colour. Choose the colour first, then tell us on WhatsApp if you want it changed or made larger.",
    links: [
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/occasions/birthday", label: "Birthday flowers" },
    ],
  },
  mixed: {
    intro: "Mixed bouquets combine several flowers, so they differ in which flower leads and how the bouquet is presented.",
    links: [
      { href: "/occasions/birthday", label: "Birthday flowers" },
      { href: "/occasions", label: "All occasions" },
    ],
  },
  lilies: {
    intro: "Lily bouquets have fewer, larger flowers than rose bouquets, and usually arrive with some buds still closed that open over the following days.",
    links: [
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/custom-orders", label: "Custom orders" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Pooja collection: sections by product form.
// ---------------------------------------------------------------------------

export type PoojaSection = {
  id: string;
  label: string;
  /** Product slugs in this section; a slug not on the page is skipped. */
  slugs: string[];
  note: string;
};

export const POOJA_SECTIONS: PoojaSection[] = [
  {
    id: "loose",
    label: "Loose and daily flowers",
    slugs: ["daily-pooja-flowers", "jasmine-malli"],
    note: "Loose flowers for the daily pooja, and loose jasmine (malli, mallige). The mix follows the morning's market; tell us how much you need and we confirm what is available.",
  },
  {
    id: "boxes",
    label: "Boxes and baskets",
    slugs: ["pooja-flower-box", "pooja-flowerbox", "pooja-basket"],
    note: "Assorted pooja flowers packed for carrying or gifting. Two boxes are listed: one is an assorted box priced on the day's market, the other a flowerbox with a starting price. If you are unsure, describe the pooja and we suggest one.",
  },
  {
    id: "strings",
    label: "Strings, gajra and torans",
    slugs: ["jasmine-gajra", "fresh-flower-toran"],
    note: "Flowers already strung: jasmine gajra for hair and offerings, and fresh flower torans for a doorway. Tell us the length or the number of pieces you need.",
  },
  {
    id: "regular",
    label: "Regular deliveries",
    slugs: ["daily-pooja-flower-subscription", "jasmine-malli-subscription"],
    note: "For flowers on a repeating schedule. The delivery days, start date, quantity and whether we can deliver to your address are agreed on WhatsApp before a plan starts.",
  },
  {
    id: "bulk",
    label: "Bulk and ceremony flowers",
    slugs: ["temple-bulk-flowers", "event-garlands"],
    note: "Larger quantities for a temple, a function or a ceremony, quoted for your date.",
  },
];

export const POOJA_OTHER_SECTION = { id: "more", label: "More pooja flowers" };

/** Groups the page's own products into sections; anything unassigned is kept in a final section, never dropped. */
export function poojaSections<T extends { slug: string }>(products: T[]): { id: string; label: string; note: string | null; products: T[] }[] {
  const placed = new Set<string>();
  const sections = POOJA_SECTIONS.map((section) => {
    const items = section.slugs.flatMap((slug) => products.filter((product) => product.slug === slug));
    items.forEach((product) => placed.add(product.slug));
    return { id: section.id, label: section.label, note: section.note, products: items };
  }).filter((section) => section.products.length > 0);
  const rest = products.filter((product) => !placed.has(product.slug));
  return rest.length ? [...sections, { ...POOJA_OTHER_SECTION, note: null, products: rest }] : sections;
}

/** What a pooja enquiry needs, and the draft that asks for it. */
export const POOJA_ENQUIRY_POINTS = [
  { label: "What it is for", detail: "Daily pooja, a festival, a housewarming, a temple offering or a function." },
  { label: "The date", detail: "And the time you need the flowers by." },
  { label: "The form and quantity", detail: "Loose flowers, a box or basket, strings, gajra or a toran, and roughly how much. Pack sizes are not fixed on this page; we confirm them with you." },
  { label: "The recipient city and address", detail: "Tell us the city and the full address. We confirm whether we can deliver there on your date." },
];

export const POOJA_ENQUIRY_HREF = whatsappLink(
  ["Hi Fresh Petals, I'd like pooja flowers.", "For (daily pooja / festival / function): ", "Date and time needed: ", "Form and quantity (loose, box, string, gajra, toran): ", "Recipient city: ", "Delivery address: ", "", "Please confirm availability and the price."].join("\n")
);

export const POOJA_PHOTO_NOTE =
  "Some photographs on this page show the kind of flowers we supply rather than the exact pack. What you receive depends on the day's market, and we confirm it with you before you pay.";

// ---------------------------------------------------------------------------
// All Flowers: groups by how a product is presented, read from its record.
// ---------------------------------------------------------------------------

type Listed = Pick<Product, "slug" | "category" | "whatsIncluded">;
const ALL_FLOWER_GROUPS: { id: string; label: string; note: string; test: (product: Listed) => boolean }[] = [
  { id: "vase", label: "Arrangements in a vase", note: "Arranged in a vase and ready to stand on a table or a desk.", test: (product) => (product.whatsIncluded ?? []).some((item) => /\bvase\b/i.test(item)) },
  { id: "lilies", label: "Lily bouquets", note: "Fewer, larger flowers. Lilies usually arrive with some buds closed that open over the following days.", test: (product) => /^lilies$/i.test(product.category) },
  { id: "wrapped", label: "Hand-wrapped bouquets", note: "Wrapped and tied by hand. Each card lists the flowers on record; the wrapping is on the design's own page.", test: (product) => /^bouquets$/i.test(product.category) },
  { id: "boxes-baskets", label: "Flowers in a box or a basket", note: "Packed to carry or to give. These keep their listed prices.", test: (product) => /^(flowerbox|baskets)$/i.test(product.category) },
];
const ALL_FLOWERS_OTHER = { id: "more", label: "More flowers", note: "Other flower products in the catalogue, at their listed prices." };

/**
 * All Flowers: wrapped bouquet, vase arrangement, or box/basket, compared from
 * the records of the products in each group. What it comes in is the
 * presentation items recorded (wrapping, vase, box, basket); care is only the
 * instructions recorded on at least half of the group's products. Nothing is
 * typed per product, so a catalogue change updates the table.
 */
const PRESENTATION_ROWS: { id: string; label: string; suits: string; own: RegExp }[] = [
  { id: "wrapped", label: "Wrapped bouquet", suits: "Handing over in person, or a home that already has a vase. It needs water soon after it arrives.", own: /wrapping|hand-tied/i },
  { id: "vase", label: "Arrangement in a vase", suits: "An office desk, or a home without a vase. It can stand as it arrives.", own: /\bvase\b/i },
  { id: "boxes-baskets", label: "Box or basket", suits: "Carrying, gifting or setting down without a vase. The flowers inside are confirmed with you on WhatsApp.", own: /\bbox\b|basket/i },
];
const PRESENTATION_ITEM = /wrapping|hand-tied|\bvase\b|\bbox\b|basket/i;

export type PresentationRow = { id: string; label: string; suits: string; comesIn: string[]; alsoOnSome: string[]; care: string[]; examples: Product[] };

export function presentationComparison<T extends Product>(sections: { id: string; products: T[] }[]): PresentationRow[] {
  return PRESENTATION_ROWS.flatMap(({ own, ...row }) => {
    const products = sections.find((section) => section.id === row.id)?.products ?? [];
    if (products.length === 0) return [];
    const items = [...new Set(products.flatMap((product) => (product.whatsIncluded ?? []).filter((item) => PRESENTATION_ITEM.test(item))))];
    // The row's own presentation, then any other recorded on some of its designs (a wrapped bouquet that comes in a box).
    const comesIn = items.filter((item) => own.test(item));
    const alsoOnSome = items.filter((item) => !own.test(item));
    const counts = new Map<string, number>();
    for (const product of products) for (const note of new Set(product.careNotes ?? [])) counts.set(note, (counts.get(note) ?? 0) + 1);
    const care = [...counts].filter(([, count]) => count * 2 >= products.length).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([note]) => note);
    return [{ ...row, comesIn, alsoOnSome, care, examples: products.slice(0, 2) }];
  });
}

/** Every listed product in exactly one group, in the page's own order; a group with nothing in it is left out. */
export function allFlowerSections<T extends Listed>(products: T[]): { id: string; label: string; note: string | null; products: T[] }[] {
  const placed = new Set<string>();
  const sections = ALL_FLOWER_GROUPS.map((group) => {
    const items = products.filter((product) => !placed.has(product.slug) && group.test(product));
    items.forEach((product) => placed.add(product.slug));
    return { id: group.id, label: group.label, note: group.note, products: items };
  });
  const rest = products.filter((product) => !placed.has(product.slug));
  // Shown in a shopper's order: wrapped bouquets first, then lilies, vase arrangements, boxes and baskets.
  const order = ["wrapped", "lilies", "vase", "boxes-baskets"];
  return [...order.map((id) => sections.find((section) => section.id === id)!), ...(rest.length ? [{ ...ALL_FLOWERS_OTHER, products: rest }] : [])].filter((section) => section.products.length > 0);
}
