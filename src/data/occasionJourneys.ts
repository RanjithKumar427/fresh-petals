// Occasion-led shopping: one description of each buying journey, used by the
// homepage shortcuts and occasion section, the occasion landing pages, the
// /occasions index and the bouquet filters. Nothing here is invented:
//
// - What a page offers comes from the launch range (src/data/launchCatalogue.ts,
//   the products the owner has promoted) and, for ceremony flowers, the live
//   public garlands. A journey with nothing eligible says so and offers a
//   WhatsApp enquiry instead of substituting other products.
// - Colour filters come from each product's recorded flowers; budget bands
//   from its database starting price. A filter only appears when it divides
//   the products on that page.
// - Intent ("Send a gift" / "For the ceremony") follows the product type:
//   bouquets are gifts, garlands are ceremony flowers. There is no
//   per-product override yet (see docs/occasion-journeys.md).
import { productCatalog, type Product } from "./productCatalog";
import { LAUNCH_OCCASION_ROUTES, garlandsPromoted, launchProducts } from "./launchCatalogue";
import { OCCASION_PAGES, type OccasionMeta } from "./occasionPages";
import { isListedGarland, type GarlandDesign } from "./garlandRules";

import { OCCASION_FILTER_LABELS, COLOUR_LABELS, BUDGET_LABELS } from "./shoppingTaxonomy";
export { OCCASION_FILTER_LABELS, COLOUR_LABELS, BUDGET_LABELS } from "./shoppingTaxonomy";

export type Intent = "gift" | "ceremony";

/** What a landing page offers: gifts only; a ceremony/gift choice; or a calm enquiry-led page. */
export type JourneyKind = "gift" | "ceremony" | "calm";

export type Palette = {
  /** Page band behind the heading. */
  band: string;
  /** Back plane of the photo composition. */
  plane: string;
  /** Eyebrow / accent text (passes 4.5:1 on the band). */
  accent: string;
};

export type OccasionJourney = {
  /** Existing route: /occasions/<route>. */
  route: string;
  label: string;
  kind: JourneyKind;
  palette: Palette;
  /** The first question the landing page answers. */
  question: string;
  /** Labels for the two intents on ceremony pages. */
  intents?: Record<Intent, string>;
  /** Sentence used in the WhatsApp enquiry ("…flowers for a wedding"). */
  enquiryNoun: string;
};

const NEUTRAL: Palette = { band: "#f4efe6", plane: "#e8dfcf", accent: "#6b5a43" };

export const OCCASION_JOURNEYS: Record<string, OccasionJourney> = {
  birthday: {
    route: "birthday",
    label: "Birthday",
    kind: "gift",
    palette: { band: "#fbf1cf", plane: "#f2dc8c", accent: "#7a5a00" },
    question: "Which bouquet suits them — and what does it cost?",
    enquiryNoun: "birthday flowers",
  },
  anniversary: {
    route: "anniversary",
    label: "Anniversary",
    kind: "gift",
    palette: { band: "#f6e6e4", plane: "#e3bcb8", accent: "#8c3f3a" },
    question: "Roses or lilies, and in which colour?",
    enquiryNoun: "anniversary flowers",
  },
  wedding: {
    route: "wedding",
    label: "Wedding",
    kind: "ceremony",
    palette: { band: "#faf3e4", plane: "#f0c27a", accent: "#8a4b00" },
    question: "Flowers for the ceremony, or a gift for the couple?",
    intents: { ceremony: "For the ceremony", gift: "Send a gift" },
    enquiryNoun: "wedding flowers",
  },
  engagement: {
    route: "engagement",
    label: "Engagement",
    kind: "ceremony",
    palette: { band: "#eef2ea", plane: "#c9d6c2", accent: "#3f5a46" },
    question: "Flowers for the ceremony, or a gift for the couple?",
    intents: { ceremony: "For the ceremony", gift: "Send a gift" },
    enquiryNoun: "engagement flowers",
  },
  housewarming: {
    route: "housewarming",
    label: "Housewarming & Pooja",
    kind: "ceremony",
    palette: { band: "#f8e9df", plane: "#e6b79d", accent: "#94431f" },
    question: "Flowers for the home and pooja, or a housewarming gift?",
    intents: { ceremony: "For the home & pooja", gift: "Send a gift" },
    enquiryNoun: "housewarming flowers",
  },
  pooja: {
    route: "pooja",
    label: "Pooja",
    kind: "ceremony",
    palette: { band: "#f8e9df", plane: "#e6b79d", accent: "#94431f" },
    question: "Flowers for the pooja, or a gift?",
    intents: { ceremony: "For the pooja", gift: "Send a gift" },
    enquiryNoun: "pooja flowers",
  },
  "mom-to-be": {
    route: "mom-to-be",
    label: "Baby Shower / Seemantham",
    kind: "ceremony",
    palette: { band: "#f3eef6", plane: "#d8cbe2", accent: "#5b4870" },
    question: "Flowers for the ceremony, or a gift for the family?",
    intents: { ceremony: "For the ceremony", gift: "Send a gift" },
    enquiryNoun: "baby shower or naming ceremony flowers",
  },
  sympathy: {
    route: "sympathy",
    label: "Condolence",
    kind: "calm",
    palette: { band: "#f5f2ea", plane: "#e4ded1", accent: "#545e57" },
    question: "Can flowers reach them in time?",
    enquiryNoun: "condolence flowers",
  },
};

export function journeyFor(route: string): OccasionJourney {
  return (
    OCCASION_JOURNEYS[route] ?? {
      route,
      label: route.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      kind: "gift",
      palette: NEUTRAL,
      question: "Which flowers, and what do they cost?",
      enquiryNoun: `${route.replace(/-/g, " ")} flowers`,
    }
  );
}

// ---------------------------------------------------------------------------
// Filters derived from catalogue facts.
// ---------------------------------------------------------------------------

export type ColourKey = "red" | "pink" | "peach" | "white" | "yellow" | "mixed";


const COLOUR_WORDS: [ColourKey, RegExp][] = [
  ["red", /\bred\b/i],
  ["pink", /\b(pink|blush)\b/i],
  ["peach", /\bpeach\b/i],
  ["white", /\bwhite\b/i],
  ["yellow", /\b(yellow|sunflowers?)\b/i],
  ["mixed", /\b(mixed|gerberas?|daisies)\b/i],
];

/** Colours named in a product's recorded flowers (never guessed from the photograph). */
export function productColours(product: Pick<Product, "flowerTypes">): ColourKey[] {
  const text = (product.flowerTypes ?? []).join(" · ");
  return COLOUR_WORDS.filter(([, re]) => re.test(text)).map(([key]) => key);
}

export const BUDGET_LIMIT = 1500;
export type BudgetKey = "under-1500" | "1500-plus";

/** The database starting price shown on the card ("From ₹1499" → 1499), or null. */
export function startingPrice(product: Pick<Product, "priceLabel">): number | null {
  const match = product.priceLabel.match(/₹\s?([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function budgetBand(product: Pick<Product, "priceLabel">): BudgetKey | null {
  const price = startingPrice(product);
  if (price === null) return null;
  return price < BUDGET_LIMIT ? "under-1500" : "1500-plus";
}

/**
 * Occasions shoppers can choose between on the bouquet list, with
 * shopper-facing names. Each appears only when the launch range carries it
 * (from the admin's assignments).
 */

export type FilterOption = { key: string; label: string; count: number };
export type FilterGroup = { id: "budget" | "colour" | "occasion"; label: string; options: FilterOption[] };

export type ShopItemData = { occasions: string[]; colours: ColourKey[]; budget: BudgetKey | null; intent: Intent };

export function shopItemData(product: Product, intent: Intent = "gift"): ShopItemData {
  return { occasions: product.occasionTags ?? [], colours: productColours(product), budget: budgetBand(product), intent };
}

/**
 * Filter groups for a set of products. A group appears only when at least
 * two of its options apply and none applies to every product — a filter
 * that can't change the list is not offered. With `allOccasions`, every
 * occasion that at least one product carries is offered (even one all of
 * them carry), so a link such as ?occasion=romantic always has its option.
 */
export function filterGroups(products: Product[], groups: FilterGroup["id"][], { allOccasions = false, selected = {} }: { allOccasions?: boolean; selected?: Partial<Record<FilterGroup["id"], string[]>> } = {}): FilterGroup[] {
  const total = products.length;
  const result: FilterGroup[] = [];
  const useful = (options: FilterOption[]) => options.filter((o) => o.count > 0 && o.count < total);

  if (groups.includes("occasion")) {
    const all = Object.entries(OCCASION_FILTER_LABELS).map(([key, label]) => ({ key, label, count: products.filter((p) => p.occasionTags?.includes(key)).length }));
    const options = allOccasions ? all : useful(all);
    if (allOccasions ? options.length > 0 : options.length >= 2) result.push({ id: "occasion", label: "Occasion", options });
  }
  if (groups.includes("budget")) {
    const options = (
      (Object.keys(BUDGET_LABELS) as BudgetKey[]).map((key) => ({ key, label: BUDGET_LABELS[key], count: products.filter((p) => budgetBand(p) === key).length }))
    );
    // Both bands must be present, otherwise the choice can't narrow anything.
    // "Bouquet price": the bands are the displayed (starting) price, not an
    // order total with delivery or add-ons.
    if (useful(options).length === 2 || selected.budget?.length) result.push({ id: "budget", label: "Bouquet price", options });
  }
  if (groups.includes("colour")) {
    const options = (
      (Object.keys(COLOUR_LABELS) as ColourKey[]).map((key) => ({ key, label: COLOUR_LABELS[key], count: products.filter((p) => productColours(p).includes(key)).length }))
    );
    if (useful(options).length >= 2 || selected.colour?.length) result.push({ id: "colour", label: "Colour", options });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Occasion membership: the admin's assignments (product_occasions), loaded by
// src/server/services/OccasionMembership.ts. The catalogue's own occasion
// tags are never used as a fallback — a cleared assignment stays cleared.
// ---------------------------------------------------------------------------

/** slug → assigned occasion slugs. */
export type Membership = Map<string, string[]>;

/** The launch range with each product's occasions taken from the admin's assignments. */
export function launchWithMembership(membership: Membership): Product[] {
  return launchProducts().map((product) => ({ ...product, occasionTags: [...(membership.get(product.slug) ?? [])] }));
}

/** Slugs whose occasions the storefront reads from the database. */
export const launchSlugs = () => launchProducts().map((product) => product.slug);

/** Every catalogue product (each has a product page an older occasion page can list). */
export const catalogueSlugs = () => productCatalog.map((product) => product.slug);

// ---------------------------------------------------------------------------
// Eligibility: what can honestly be promoted right now.
// ---------------------------------------------------------------------------

/** Launch products a journey can show as gifts. Housewarming also counts pooja-assigned launch products. */
export function giftProducts(route: string, membership: Membership): Product[] {
  return launchWithMembership(membership).filter((product) => occasionProductEligible(product.slug, route, product.occasionTags ?? []));
}

/**
 * Homepage carousel occasions, in the owner's order. Each card links to its
 * occasion page and counts exactly what that page lists. `feature` names the
 * bouquet whose photograph leads the card while it is eligible.
 */
export const CAROUSEL_OCCASIONS: { key: string; label: string; feature?: string }[] = [
  { key: "birthday", label: "Birthday", feature: "colour-pop-love" },
  { key: "anniversary", label: "Anniversary", feature: "timeless-hug" },
  { key: "wedding", label: "Wedding" },
  { key: "engagement", label: "Engagement" },
  { key: "housewarming", label: "Housewarming & Pooja" },
  { key: "sympathy", label: "Condolence" },
];

const BOUQUET_CATEGORIES = new Set(["Bouquets", "Lilies"]);

/**
 * Carousel occasions outside the launch range (Condolence → sympathy) list
 * public bouquets only: assigned catalogue Bouquets/Lilies, never add-ons or
 * other product types, so the card and its page count the same list.
 */
export const BOUQUET_ONLY_ROUTES = new Set(CAROUSEL_OCCASIONS.map((item) => item.key).filter((key) => !LAUNCH_OCCASION_ROUTES.has(key)));

const isBouquet = (slug: string) => {
  const product = productCatalog.find((item) => item.slug === slug);
  return !!product && BOUQUET_CATEGORIES.has(product.category) && !product.isAddon;
};

/** Shared storefront/admin membership rule; removing an assignment is authoritative. */
export function occasionProductEligible(slug: string, route: string, assigned: string[]): boolean {
  if (!catalogueSlugs().includes(slug)) return false;
  const launch = launchSlugs().includes(slug);
  if (LAUNCH_OCCASION_ROUTES.has(route) && !launch) return false;
  if (BOUQUET_ONLY_ROUTES.has(route) && !isBouquet(slug)) return false;
  return assigned.includes(route) || (launch && route === "housewarming" && assigned.includes("pooja"));
}

/** Existing type suitability and public gates. Gift tags never imply ceremony suitability. */
export function ceremonyProducts(route: string, garlands: GarlandDesign[]): GarlandDesign[] {
  return CEREMONY_GARLAND_ROUTES.has(route) ? garlands.filter((design) => isListedGarland(design) && design.occasionTags?.includes(route)) : [];
}

/** Routes whose ceremony flowers are live garlands (shown once garlands are promoted and public). */
export const CEREMONY_GARLAND_ROUTES = new Set(["wedding", "engagement"]);

/** Whether a journey has anything eligible to show. Live garlands count only once the owner promotes garlands. */
export function journeyEligible(route: string, membership: Membership, garlands: GarlandDesign[] = []): boolean {
  return giftProducts(route, membership).length > 0 || (garlandsPromoted() && ceremonyProducts(route, garlands).length > 0);
}

/** Every occasion page; all are rendered on request from the admin's assignments (src/pages/occasions/[slug].astro). */
export const LIVE_OCCASION_ROUTES = new Set(OCCASION_PAGES.map((occasion) => occasion.slug));

/**
 * What an occasion page lists. Launch occasions (birthday, anniversary,
 * wedding, engagement, housewarming, mom-to-be) show the launch range only,
 * as assigned in the admin. The older pages (thank-you, romantic, sympathy…)
 * keep their wider scope — every catalogue product assigned to the occasion.
 * Editorial references never restore removed admin assignments.
 * `membership` must cover catalogueSlugs() for the older pages.
 */
export function occasionPageProducts(occasion: OccasionMeta, membership: Membership): Product[] {
  if (LAUNCH_OCCASION_ROUTES.has(occasion.slug)) return giftProducts(occasion.slug, membership);
  return productCatalog.filter((product) => occasionProductEligible(product.slug, occasion.slug, membership.get(product.slug) ?? []))
    .map((product) => ({ ...product, occasionTags: [...(membership.get(product.slug) ?? [])] }));
}

export type CarouselOccasion = { key: string; label: string; href: string; products: Product[]; feature?: string };

/**
 * The homepage carousel's occasions that currently have eligible public
 * products, from the admin's assignments. `products` is exactly what
 * /occasions/<key> lists (occasionPageProducts), so a card's count always
 * matches its page. `membership` must cover catalogueSlugs() (Condolence
 * can list bouquets outside the launch range).
 */
export function carouselOccasions(membership: Membership): CarouselOccasion[] {
  return CAROUSEL_OCCASIONS.flatMap(({ key, label, feature }) => {
    const page = OCCASION_PAGES.find((item) => item.slug === key);
    const products = page ? occasionPageProducts(page, membership) : [];
    return products.length > 0 ? [{ key, label, href: `/occasions/${key}`, products, feature }] : [];
  });
}

/**
 * Small text links under the hero's actions: the two leading occasions (each
 * only while it has eligible bouquets) and "More occasions". Ordinary links,
 * not a second deck — the deck itself is further down the page.
 */
export function heroOccasionLinks(membership: Membership): { label: string; href: string }[] {
  return [
    ...(["birthday", "anniversary"] as const)
      .filter((route) => journeyEligible(route, membership))
      .map((route) => ({ label: route === "birthday" ? "Birthday" : "Anniversary", href: `/occasions/${route}` })),
    { label: "More occasions", href: "/occasions" },
  ];
}

/** Homepage first-screen shortcuts; each appears only when its destination has public products. */
export function homeShortcuts(_membership: Membership, publicGarlands: GarlandDesign[] = []): { label: string; href: string; primary?: boolean }[] {
  const bouquets = launchProducts().length > 0;
  const garlands = garlandsPromoted() && publicGarlands.some(isListedGarland);
  const ceremonyRoute = ["wedding", "engagement"].find((route) => garlands && ceremonyProducts(route, publicGarlands).length > 0);
  return [
    ...(bouquets ? [{ label: "Browse bouquets", href: "/categories/bouquets", primary: true }] : []),
    ...(garlands ? [{ label: "Choose garlands", href: "/categories/garlands" }] : []),
    ...(ceremonyRoute ? [{ label: "Flowers for a ceremony", href: `/occasions/${ceremonyRoute}?for=ceremony` }] : []),
    { label: "Help me choose", href: "/occasions" },
  ];
}

// ---------------------------------------------------------------------------
// The ten buying needs (docs/occasion-journeys.md) and where each lands today.
// ---------------------------------------------------------------------------

export type NeedDestination = {
  need: string;
  /** Where to send the shopper, or null when the answer is a WhatsApp enquiry. */
  href: string | null;
  /** Shown under the need on /occasions. */
  note: string;
  count: number;
  enquiry: string;
};

export function needDestinations(membership: Membership, publicGarlands: GarlandDesign[] = []): NeedDestination[] {
  const range = launchWithMembership(membership);
  const n = (route: string) => giftProducts(route, membership).length;
  const tagged = (...tags: string[]) => range.filter((p) => tags.some((t) => p.occasionTags?.includes(t))).length;
  const withTags = (...tags: string[]) => tags.filter((t) => tagged(t) > 0);
  const weddingCeremony = garlandsPromoted() && ceremonyProducts("wedding", publicGarlands).length > 0;
  const engagementCeremony = garlandsPromoted() && ceremonyProducts("engagement", publicGarlands).length > 0;
  const ceremonyNote = weddingCeremony ? "Public ceremony garlands; availability and price are confirmed on WhatsApp." : "Our ceremony range isn't online yet — tell us what you need on WhatsApp.";
  const thanks = withTags("congratulations", "thank-you");
  const gentle = withTags("get-well-soon", "i-am-sorry");
  const list: NeedDestination[] = [
    { need: "Birthday", href: n("birthday") ? "/occasions/birthday" : null, note: "Bouquets with prices, by colour and budget.", count: n("birthday"), enquiry: "birthday flowers" },
    { need: "Anniversary, love & proposal", href: n("anniversary") ? "/occasions/anniversary" : null, note: "Roses and lilies with prices.", count: n("anniversary"), enquiry: "anniversary flowers" },
    {
      need: "Congratulations, thanks & farewell",
      href: thanks.length ? `/categories/bouquets?occasion=${thanks.join(",")}` : null,
      note: "Bright bouquets from our range.",
      count: tagged(...thanks),
      enquiry: "congratulations or thank-you flowers",
    },
    {
      need: "Get well & apology",
      href: gentle.length ? `/categories/bouquets?occasion=${gentle.join(",")}` : null,
      note: tagged("get-well-soon") ? "Gentle bouquets from our range." : "Apology bouquets from our range; for get-well flowers, ask us on WhatsApp.",
      count: tagged(...gentle),
      enquiry: "get-well or apology flowers",
    },
    {
      need: "Condolence",
      href: tagged("sympathy") ? "/categories/bouquets?occasion=sympathy" : "/occasions/sympathy",
      note: tagged("sympathy") ? "Quiet bouquets from our range; we check timing with you first." : "Quiet flowers; we check timing and delivery with you first.",
      count: tagged("sympathy"),
      enquiry: "condolence flowers",
    },
    { need: "Wedding ceremony", href: "/occasions/wedding?for=ceremony", note: ceremonyNote, count: 0, enquiry: "wedding ceremony flowers" },
    {
      need: "Engagement & reception",
      href: n("engagement") || engagementCeremony ? `/occasions/engagement?for=${engagementCeremony ? "ceremony" : "gift"}` : null,
      note: engagementCeremony ? "Ceremony garlands and gifts; availability is confirmed on WhatsApp." : n("engagement") ? "Gift bouquets; ask on WhatsApp about ceremony flowers." : "Tell us whether it's for the ceremony or a gift — we'll reply with options.",
      count: n("engagement"),
      enquiry: "engagement or reception flowers",
    },
    { need: "Haldi & Mehendi", href: null, note: "Ask on WhatsApp about suitable flowers and décor for your ceremony.", count: 0, enquiry: "Haldi or Mehendi flowers" },
    {
      need: "Baby shower, new baby & naming ceremony",
      href: n("mom-to-be") ? "/occasions/mom-to-be?for=gift" : null,
      note: n("mom-to-be") ? "Gift bouquets for the family; ceremony requirements are checked on WhatsApp." : "Tell us about the ceremony on WhatsApp.",
      count: n("mom-to-be"),
      enquiry: "baby shower, new baby or naming ceremony flowers",
    },
    {
      need: "Housewarming & pooja",
      href: n("housewarming") ? "/occasions/housewarming?for=gift" : null,
      note: n("housewarming") ? "Housewarming gift bouquets; pooja flower requirements are checked on WhatsApp." : "Pooja flowers and housewarming gifts are confirmed on WhatsApp.",
      count: n("housewarming"),
      enquiry: "housewarming or pooja flowers",
    },
  ];
  return list;
}

/** The WhatsApp enquiry text for a journey without products (optional details left for the customer). */
export function journeyEnquiryText(noun: string, intent?: string): string {
  return [
    `Hi Fresh Petals, I'm looking for ${noun}.`,
    ...(intent ? [`For: ${intent}`] : []),
    "Date (optional): ",
    "Delivery area (optional): ",
    "Budget or colours (optional): ",
  ].join("\n");
}

/** One consistent line about where we deliver (src/data/seoLanding.ts AREA_FAQ says the same). */
/** The verified delivery coverage, short (shipping policy: starting in these two areas; nearby addresses checked before payment). */
export const SERVICE_AREA_SHORT = "Delivering in Chamarajpet and Basavanagudi, Bengaluru — nearby addresses are checked on WhatsApp before you pay.";
export const SERVICE_AREA_LINE = "Bengaluru — delivery starting in Chamarajpet and Basavanagudi; your area, timing and fee are confirmed on WhatsApp.";
