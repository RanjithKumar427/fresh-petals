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
import { PRESENTATION_UNCONFIRMED, recordedPresentation, type FlowerKey, type PresentationKind } from "./catalogueRange";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

const PRESENTATION_ITEM = /wrapping|hand-tied|\bvase\b|\bbox\b|basket/i;

/** The container a photograph shows, as one word ("vase", "box"), for the customer-facing question. */
const containerWord = (photographed: string) => (/\bvase\b/i.test(photographed) ? "vase" : /\bbox\b/i.test(photographed) ? "box" : "container");

/** For a design whose presentation is unconfirmed: what is recorded and what the photograph shows. */
export function presentationCheck(product: Pick<Product, "slug" | "whatsIncluded">): { recorded: string | null; photographed: string; note: string } | null {
  const photographed = PRESENTATION_UNCONFIRMED[product.slug];
  if (!photographed) return null;
  const recorded = (product.whatsIncluded ?? []).find((item) => PRESENTATION_ITEM.test(item)) ?? null;
  return {
    recorded,
    photographed,
    // Customer-facing: names the open choice and asks, promising neither the
    // recorded wrapping nor the photographed container.
    note: `${recorded ? `Wrapping or ${containerWord(photographed)}` : "Presentation"} to be confirmed: the photograph shows ${photographed}. Please confirm on WhatsApp how this design will be presented before you order.`,
  };
}

/**
 * How a bouquet is presented, from its record (src/data/catalogueRange.ts
 * recordedPresentation): "in a glass vase", "in a pink flower box", "in a
 * wicker basket", "in kraft wrapping", "hand-tied", or null when unrecorded,
 * conflicting or unconfirmed.
 */
export function bouquetPresentation(product: Product): string | null {
  const { kind, evidence, handTied } = recordedPresentation(product);
  const item = evidence[0];
  if (!item) return null;
  // "Pink flower box" → "in a pink flower box"; "Giftbox arrangement" → "in a giftbox"; "Basket packing" → "in a basket".
  if (kind === "vase" || kind === "box" || kind === "basket") return `in a ${lowerFirst(item.replace(/^packed /i, "").replace(/-style\b/i, "").replace(/ (arrangement|packing|presentation)$/i, ""))}`;
  if (kind === "wrapped") return handTied && !/wrapp/i.test(item) ? "hand-tied" : `in ${lowerFirst(item)}`;
  return null;
}

/** Recorded as arranged in a vase (src/data/catalogueRange.ts recordedPresentation). */
export const isVaseArrangement = (product: Product) => recordedPresentation(product).kind === "vase";
export const presentationKind = (product: Product): PresentationKind => recordedPresentation(product).kind;

/**
 * The presentation words a photograph description has always used: a
 * recorded vase or wrapping, nothing else. Photograph descriptions follow
 * what the photograph shows (src/data/productPhotos.ts), so a container the
 * record lists is not added to them.
 */
function photoPresentation(product: Product): string | null {
  if (PRESENTATION_UNCONFIRMED[product.slug]) return null;
  const included = product.whatsIncluded ?? [];
  const vase = included.find((item) => /\bvase\b/i.test(item));
  if (vase) return `in a ${lowerFirst(vase)}`;
  const wrap = included.find((item) => /wrapping/i.test(item));
  return wrap ? `in ${lowerFirst(wrap)}` : null;
}

/** The flowers recorded for a bouquet, as a phrase ("red roses and fresh rose foliage"), or null. */
export function bouquetFlowers(product: Product): string | null {
  const flowers = (product.flowerTypes ?? []).map(lowerFirst);
  return flowers.length ? list(flowers) : null;
}

/** Photograph description from the record: name, flowers and presentation. Falls back to the name. */
export function bouquetPhotoAlt(product: Product): string {
  const flowers = bouquetFlowers(product);
  if (!flowers) return product.name;
  const presentation = photoPresentation(product);
  return `${product.name}: ${flowers}${presentation ? `, ${presentation}` : ""}`;
}

/** One line per bouquet for a group's comparison list. */
export function bouquetLine(product: Product): string | null {
  const flowers = bouquetFlowers(product);
  if (!flowers) return null;
  const presentation = bouquetPresentation(product);
  return `${flowers.charAt(0).toUpperCase()}${flowers.slice(1)}${presentation ? `, ${presentation}` : ""}.`;
}

export type GroupGuidance = { intro: string; links: { href: string; label: string }[] };

/**
 * The bouquet list's groups (ids from src/data/catalogueRange.ts
 * BOUQUET_FLOWER_GROUPS). Membership is read from each design's recorded
 * flowers, and the rose and lily groups overlap.
 */
export const BOUQUET_GROUP_GUIDANCE: Record<string, GroupGuidance> = {
  roses: {
    intro: "Every bouquet whose recorded flowers include roses, from all-rose designs to mixed bouquets with a few roses. A design that also has lilies is listed under lilies too. Compare the flowers listed for each, then tell us on WhatsApp if you want the colour changed.",
    links: [
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/occasions/birthday", label: "Birthday flowers" },
    ],
  },
  mixed: {
    intro: "Bouquets whose recorded flowers include neither roses nor lilies. They differ in which flowers lead and how they are presented; each design lists its own flowers below.",
    links: [
      { href: "/occasions/birthday", label: "Birthday flowers" },
      { href: "/occasions", label: "All occasions" },
    ],
  },
  lilies: {
    intro: "Every bouquet whose recorded flowers include lilies. Lilies are fewer, larger flowers, and usually arrive with some buds still closed that open over the following days. A design that also has roses is listed under roses too.",
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
    note: "Loose flowers for the daily pooja. The mix follows the morning's market; tell us how much you need, and whether you also want loose jasmine (malli, mallige), and we confirm what is available.",
  },
  {
    id: "boxes",
    label: "Boxes and baskets",
    slugs: ["pooja-flower-box", "pooja-flowerbox", "pooja-basket"],
    note: "Assorted pooja flowers packed for carrying or gifting. If you are unsure which suits, describe the pooja and we suggest one.",
  },
  {
    id: "strings",
    label: "Strings and torans",
    slugs: ["jasmine-gajra", "fresh-flower-toran"],
    note: "Flowers already strung, such as a toran for a doorway or jasmine gajra for hair and offerings. Tell us the form, the length or the number of pieces you need.",
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

// Each product's presentation comes from src/data/catalogueRange.ts
// recordedPresentation, so this page, the bouquet note, the collections and
// the product titles agree. A design whose presentation is open (an owner
// check, conflicting or qualified items) is grouped as such, never guessed.
type Listed = Pick<Product, "slug" | "category" | "whatsIncluded">;
const ALL_FLOWER_GROUPS: { id: string; label: string; note: string; test: (product: Listed) => boolean }[] = [
  { id: "stems", label: "Flowers by the stem", note: "Loose stems to arrange yourself, priced on the day's flower market and confirmed on WhatsApp.", test: (product) => /^by stems$/i.test(product.category) },
  { id: "wrapped", label: "Wrapped and hand-tied bouquets", note: "Each records wrapping or hand-tying and no vase, box or basket; the design's own page says which. Handed over as they are, then put in water.", test: (product) => recordedPresentation(product).kind === "wrapped" },
  { id: "vase", label: "Arrangements in a vase", note: "Each records a vase as included, so it can stand on a table or a desk as it arrives.", test: (product) => recordedPresentation(product).kind === "vase" },
  { id: "boxes-baskets", label: "Flowers in a box or a basket", note: "Each records a flower box or a basket. Packed to carry or to give.", test: (product) => ["box", "basket"].includes(recordedPresentation(product).kind) },
  { id: "to-confirm", label: "Presentation confirmed on WhatsApp", note: "For these designs the record does not settle how they arrive, or the photograph shows something different. Ask on WhatsApp before you order.", test: (product) => recordedPresentation(product).kind === "unresolved" },
];
const ALL_FLOWERS_OTHER = { id: "more", label: "More flowers", note: "Other flower products in the catalogue, at their listed prices." };

/**
 * Old All Flowers addresses whose group no longer exists, and where their
 * products now are (rendered as a titled signpost at that anchor, with the
 * groups on the page that hold them, so a saved link still lands somewhere
 * useful; no product card is repeated).
 */
export const ALL_FLOWERS_MOVED_GROUPS: { id: string; flower: FlowerKey; title: string; text: string; href: string; label: string }[] = [
  { id: "lilies", flower: "lilies", title: "Looking for lilies?", text: "Lily designs are now grouped by how they arrive, like every other design on this page. All of them, with lilies by the stem, are on one page:", href: "/categories/lilies", label: "lilies" },
];

/**
 * All Flowers: wrapped bouquet, vase arrangement, or box/basket, compared from
 * the records of the products in each group. What it comes in is the
 * presentation items recorded (wrapping, vase, box, basket); care is only the
 * instructions recorded on at least half of the group's products. Nothing is
 * typed per product, so a catalogue change updates the table.
 */
const PRESENTATION_ROWS: { id: string; label: string; suits: string }[] = [
  { id: "wrapped", label: "Wrapped or hand-tied bouquet", suits: "Handing over in person, or a home that already has a vase. It needs water soon after it arrives." },
  { id: "vase", label: "Arrangement in a vase", suits: "An office desk, or a home without a vase. It can stand as it arrives." },
  { id: "boxes-baskets", label: "Box or basket", suits: "Carrying, gifting or setting down without a vase. The flowers inside are confirmed with you on WhatsApp." },
];

export type PresentationRow = { id: string; label: string; suits: string; comesIn: string[]; alsoOnSome: string[]; care: string[]; examples: Product[] };

export function presentationComparison<T extends Product>(sections: { id: string; products: T[] }[]): PresentationRow[] {
  return PRESENTATION_ROWS.flatMap((row) => {
    const products = sections.find((section) => section.id === row.id)?.products ?? [];
    if (products.length === 0) return [];
    // Only the items that established each design's presentation; a group holds one presentation, so there is no "also on some".
    const comesIn = [...new Set(products.flatMap((product) => recordedPresentation(product).evidence))];
    const counts = new Map<string, number>();
    for (const product of products) for (const note of new Set(product.careNotes ?? [])) counts.set(note, (counts.get(note) ?? 0) + 1);
    const care = [...counts].filter(([, count]) => count * 2 >= products.length).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([note]) => note);
    return [{ ...row, comesIn, alsoOnSome: [], care, examples: products.slice(0, 2) }];
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
  // Shown in a shopper's order: wrapped bouquets first, then vase arrangements, boxes and baskets, stems, designs to confirm.
  const order = ["wrapped", "vase", "boxes-baskets", "stems", "to-confirm"];
  return [...order.map((id) => sections.find((section) => section.id === id)!), ...(rest.length ? [{ ...ALL_FLOWERS_OTHER, products: rest }] : [])].filter((section) => section.products.length > 0);
}

// ---------------------------------------------------------------------------
// Flower pages (/categories/rose, /categories/lilies): arrangements whose
// recorded flowers include the flower, then that flower by the stem.
// ---------------------------------------------------------------------------

/** Category slugs that list one flower's arrangements and stems (src/pages/categories/[slug].astro). */
export const FLOWER_PAGES: Record<string, FlowerKey> = { rose: "roses", lilies: "lilies" };

const FLOWER_NAMES: Record<FlowerKey, { plural: string; stems: string }> = {
  roses: { plural: "roses", stems: "Roses by the stem" },
  lilies: { plural: "lilies", stems: "Lilies by the stem" },
};

/** Arrangements first (every listed product that isn't a loose stem), then stems; nothing dropped. */
export function flowerSections<T extends Pick<Product, "slug" | "category">>(products: T[], flower: FlowerKey): { id: string; label: string; note: string | null; products: T[] }[] {
  const names = FLOWER_NAMES[flower];
  const stems = products.filter((product) => /^by stems$/i.test(product.category));
  const arrangements = products.filter((product) => !stems.includes(product));
  return [
    { id: "arrangements", label: `Bouquets and arrangements with ${names.plural}`, note: `Every design whose recorded flowers include ${names.plural}. Many also have other flowers; each card's page lists them.`, products: arrangements },
    { id: "stems", label: names.stems, note: `Loose ${names.plural} to arrange yourself, priced on the day's flower market and confirmed on WhatsApp.`, products: stems },
  ].filter((section) => section.products.length > 0);
}
