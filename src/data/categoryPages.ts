// Category pages (/categories/<slug>): which addresses exist, what each is
// called, its introduction and which public products it lists. Shared by the
// prebuilt category pages (src/pages/categories/[slug].astro) and the tests,
// so a page's intro can be checked against the products it actually lists.
//
// Membership rules, in order (categoryProducts):
//   1. derived collections: All Flowers and the flower pages (Rose, Lilies),
//      read from recorded product facts (src/data/catalogueRange.ts);
//   2. recorded collections (subscriptions, flower boxes, baskets, wrapped
//      bouquets, vases, stems): their own products, with related choices
//      listed separately (RECORDED_COLLECTIONS);
//   3. otherwise the product's category, a collection tag, or a menu rule.
// An introduction describes the range a page lists and how its products
// differ; it never names a product type the page does not list as on sale.
import type { Product } from "./productCatalog";
import { allFlowersRange, arrangementsWith, stemsOf, RECORDED_COLLECTIONS, type CollectionMembership } from "./catalogueRange";
import { FLOWER_PAGES } from "./collectionGuidance";

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const titleFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((word) => {
      if (word === "and") return "&";
      if (word === "pooja") return "Pooja";
      if (word === "diy") return "DIY";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

// Introductions, reviewed 16 Nov 2026 against the products each page lists.
// They name forms and differences, not individual products (a product can be
// unpublished between releases) and no counts. An empty page says what is
// not listed and where to go instead; it never offers what is not on sale.
export const CATEGORY_INTROS: Record<string, string> = {
  "all-flowers":
    "Every fresh-flower product we list, grouped by how it is presented: wrapped bouquets, vase arrangements, flowers in a box or basket, and stems.",

  lilies:
    "Lily bouquets and arrangements first — white, pink, orange and other colours, wrapped, in a box or in a vase — then lily stems sold loose for arranging yourself. Lilies usually arrive partly in bud and open over the following days; remove the pollen as they open. Choose a design and we confirm the lilies available for your date on WhatsApp.",

  roses:
    "Rose stems sold loose, by the stem, for arranging yourself or for an event. Tell us how many stems and which colour; colours depend on the day's market and the price follows the day's rate. For ready-made rose designs, see Rose Bouquets & Arrangements.",

  "fragrant-lilies":
    "Lily designs where scent is part of the gift. How strong the scent is depends on the lily variety supplied: oriental lilies, including stargazers, are usually strongly scented, while Asiatic lilies have little scent, so the Asiatic vase design is listed under Lilies instead. If scent matters, say so on WhatsApp and we confirm the variety for your date.",

  "pooja-flowers":
    "Fresh flowers for daily pooja, festivals and temple offerings, listed by form and priced on the day's flower market.",

  flowerbox:
    "Two kinds of flower box. Gift boxes arrive arranged — lilies or gypsophila set in a box, ready to hand over. Loose-flower boxes are packed for you to arrange in your own vase. A box planned with you for a home with pets is also here. The weekly box plan and vase equipment are listed separately below.",

  baskets:
    "Fresh flowers arranged in a basket: a designed statice basket, a seasonal flower basket, a gift basket that can also carry add-ons such as chocolates or a card, and a custom basket made to your brief and budget. Choose the gift basket if you want extras in the same presentation.",

  offers:
    "Budget bands rather than fixed designs: choose a band, or ask what is on offer today, and we suggest flowers that fit from what is fresh that day. The flowers and the final price are confirmed on WhatsApp before you pay.",

  "add-ons":
    "Extras to add to a flower order — sweets, a greeting card, a candle, diffuser or room mist, a clear glass vase, a florist cutter and event table decor. Each is priced separately from the flowers; add it when you choose a design's options, or mention it on WhatsApp.",

  subscriptions:
    "Recurring flower plans, with delivery days, start date and price agreed on WhatsApp. Flower care products are listed separately; they are not plans.",

  "dried-flowers":
    "Dried stems that need no water: a wrapped dried bunch, and a dried arrangement for a vase made to order. Keep them dry and out of strong sun. Colours and stems depend on the dried stock available, and we confirm them on WhatsApp.",

  "plants-and-succulents":
    "Live plants: a mini succulent on its own, and fresh flowers paired with a small plant or succulent. The plant variety and pot depend on availability; we confirm both on WhatsApp.",

  vases:
    "Vases sold on their own: a clear glass vase, and a decor vase quoted by type and size. Below them are arrangements that already come in a vase, and flowers that need a vase of your own.",

  "floral-tools":
    "Care equipment for flowers arranged at home: a florist cutter for trimming stems and flower food for vase water. Both suit loose flowers, flower boxes and subscription plans.",

  // P0.1 trust containment (see pet-friendly-flowerbox in
  // productCatalog.ts): we hold no verified list of which flowers are safe
  // for pets, so this asserts none.
  "pet-friendly":
    "A flower box for homes with cats or dogs, planned with you: tell us about your pet on WhatsApp and we go through that day's flowers together before confirming. We cannot guarantee that any flower is safe for pets, so keep every arrangement out of their reach.",

  "flower-strings-and-torans":
    "Fresh flower torans for doorways, pooja rooms and functions, made to the length you need and priced on the day's flower market. For hair flowers such as gajra and poola jada, see Floral Torans & Strings.",

  "room-mist-and-diffuser":
    "Room mist or a diffuser to add to a flower gift; the scent is confirmed when you order. Candles and diffusers are also listed under Add-ons.",

  hampers:
    "Flowers combined with other gifts in one presentation: flowers with chocolates, flowers with a small plant, a housewarming hamper with optional extras, and a gift basket that can carry add-ons. The contents are agreed on WhatsApp before you pay; single extras are under Add-ons.",

  wedding:
    "Wedding flowers made to order: event garlands priced on the day, bridal flower accessories such as gajra and poola jada, and fresh torans for the venue or home. For ceremony garlands with photographs and design codes, see Garlands.",

  "by-stems":
    "Loose stems sold by the stem — roses and lilies — for arranging yourself or adding to an event. Tell us how many stems and the colour; the price follows the day's flower market. A box of mixed loose flowers is listed separately below.",

  "eid-al-adha":
    "No Eid al-Adha designs are listed at the moment. For an Eid gift, see White Flowers, or describe what you would like on WhatsApp for a custom arrangement.",

  "tuberose-rajnigandha":
    "Tuberose (rajnigandha) is not listed online at the moment. If you need it for pooja or decoration, ask on WhatsApp and we tell you whether it is available for your date.",

  hydrangeas:
    "No hydrangea designs are listed at the moment. For soft-toned designs, see Pastel Flowers, or ask on WhatsApp whether hydrangeas are available for your date.",

  sunflower:
    "Sunflower designs: sunflowers on their own in a glass vase, and sunflowers wrapped with white roses and chrysanthemums. A bright, informal choice for birthdays, congratulations and thank-you gifts.",

  orchid:
    "No orchid designs are listed at the moment. Ask on WhatsApp whether orchids are available for your date, or see Lilies for another formal gift.",

  rose:
    "Every design that includes roses: single-colour rose bouquets (red, pink, white, peach or lavender) and mixed designs where roses sit with lilies, sunflowers or gerberas, followed by rose stems sold loose. Choose a single colour when the colour carries the message, a mixed design for a brighter gift.",

  "pastel-flowers":
    "Soft-toned designs — blush pink, peach, lilac, lavender and pale blue — in roses, chrysanthemums, gerberas, gypsophila, asters and statice. Most are wrapped; a gypsophila flower box and a statice basket are also here. For bright colours, see Selected Bouquets or Yellow Flowers.",

  "pink-flowers":
    "Pink designs in roses, tulips, lilies, gerberas and gypsophila: wrapped bouquets, a pink lily flower box and a pastel gypsophila box. For softer mixed tones, see Pastel Flowers.",

  "white-flowers":
    "White designs in roses, lilies and chrysanthemums, for thank-you gifts, sympathy and calm occasions. Most are wrapped. For white lilies only, see Lilies.",

  "red-flowers":
    "Red designs for romantic gifts; red roses are the classic choice. For romantic designs in other colours, see Romantic, and for every design with roses, see Rose Bouquets & Arrangements.",

  "yellow-flowers":
    "Yellow designs in sunflowers, chrysanthemums and daisies, wrapped or in a glass vase, plus a lily vase arrangement in warm sunrise tones. Orange and coral lily designs are under Lilies.",

  "blue-flowers":
    "Designs with blue gypsophila (baby's breath): blue gypsophila on its own, with white roses, or with white chrysanthemums. For other cool tones, see White Flowers.",

  // An owner-curated shortlist: no request or sales figures stand behind it (docs/seo/owner-checklist.md).
  "bestselling-bouquets":
    "A shortlist picked by Fresh Petals: bright, mixed-colour designs with gerberas, sunflowers, daisies and roses, some in a glass vase. It is a selection, not a sales ranking.",

  "mini-bouquets":
    "No designs are listed as mini bouquets at the moment: bouquet sizes are not recorded yet. For a smaller gift, choose any design and ask on WhatsApp for a smaller version; we confirm the flowers and price for your date.",

  "bouquets-with-vases":
    "Bouquets and arrangements whose record includes a vase, so they stand on a table as they arrive and the recipient needs nothing else. For wrapped designs, add a vase when you choose the options.",

  "hand-tied-bouquets":
    "Bouquets whose record lists wrapping or hand-tying, with no vase, box or basket: handed over as they are, then put in water. A vase can be added when you choose the options.",

  "floral-torans-and-strings":
    "Flower strings and torans: fresh torans for doorways and pooja rooms, priced on the day's market by length, and bridal flowers such as gajra and poola jada, quoted to the event.",

  "handcrafted-torans-and-streamers":
    "Handcrafted (non-flower) torans and streamers are not sold at the moment. For fresh flower torans, see Flower Strings & Torans.",

  "pooja-urli-boxes":
    "Urli arrangements and pooja boxes are not listed online at the moment. Tell us on WhatsApp what you need for the pooja or festival, and we confirm whether we can make it for your date.",

  "fairy-lights-tim-tim-lights":
    "Fairy lights and tim tim lights are not sold at the moment. For festive decor with fresh flowers, see Flower Strings & Torans.",

  "diyas-and-tea-light-holders":
    "Diyas and tea-light holders are not sold at the moment. For pooja and festival flowers, see Pooja Flowers and Flower Strings & Torans.",

  "all-decor":
    "Decor that lasts beyond fresh flowers: dried flowers, a decor vase, a mini succulent and table decor quoted for events. Torans, lights and diyas are not part of this range; fresh flower torans are under Flower Strings & Torans.",

  "all-gifts":
    "Everything suited to giving: bouquet and lily designs suggested for a formal gift, gift flower boxes and baskets, hampers, and extras such as chocolates, a greeting card, a candle or room mist. Extras are priced separately from the flowers.",

  "flowers-and-jewellery":
    "Floral jewellery is not listed online at the moment. For bridal flowers such as gajra and poola jada, see Bridal Flower Accessories under Wedding, or ask on WhatsApp.",

  stationery:
    "Stationery here is a greeting card added to a flower order, with your message shared on WhatsApp. Planners and journals are not sold at the moment.",

  "planners-and-journal":
    "Planners and journals are not sold at the moment. To send a message with flowers, add a greeting card from Add-ons.",

  "diy-kits":
    "Not a kit with tools: the DIY flower box is loose fresh flowers packed in a box, with basic care guidance, for arranging in your own vase. A vase, florist cutter and flower food are sold separately if you need them.",

  diy:
    "Not a kit with tools: the DIY flower box is loose fresh flowers packed in a box, with basic care guidance, for arranging in your own vase. A vase, florist cutter and flower food are sold separately if you need them.",

  skincare:
    "Skincare gifts are not sold at the moment. For extras to add to flowers, see Add-ons.",

  tea:
    "Tea gifts are not sold at the moment. For extras to add to flowers, see Add-ons.",

  // Collection tags (pages created by a product tag).
  "premium-gifting":
    "Designs Fresh Petals suggests for a formal or generous gift: single-flower and mixed bouquets, lily designs, a gift flower box and a custom basket. Each is priced on WhatsApp for your date.",

  romantic:
    "Designs for partners and anniversaries: red and peach roses, tulips, white lilies with roses, stargazer and blush lilies, and a rustic gerbera and chrysanthemum bouquet. For red only, see Red Flowers.",

  "daily-use":
    "For regular home needs: daily pooja flowers and a custom recurring plan. For one-off pooja flowers, see Pooja Flowers; for every plan, see Subscriptions.",

  jasmine:
    "Jasmine (malli / mallige) listed online is a recurring delivery plan, priced on the day's market rate. For jasmine on a single date, loose or as gajra, ask on WhatsApp.",

  "flower-strings-torans":
    "Flower strings and torans: fresh torans for doorways and pooja rooms, priced on the day's market by length, and bridal flowers such as gajra and poola jada, quoted to the event.",

  "bulk-orders":
    "Bulk flowers for temples and events are not listed online at the moment. Tell us the flowers, quantity, date and city on WhatsApp for a quotation; for wedding garlands with photographs, see Garlands.",

  gifting:
    "Gifts and gift extras: gift flower boxes and baskets, flowers with chocolates, a budget gift band, and extras such as chocolates, a greeting card, a candle, room mist, dried flowers, a succulent or a decor vase. Extras are priced separately from the flowers.",

  events:
    "For events: a custom flower basket and table decor, each quoted to your setup, date and quantity. For garlands and torans, see Wedding.",

  custom:
    "Made to your brief rather than chosen from a photograph: a custom flower basket, event table decor, a dried flower vase arrangement, bridal flower accessories and a custom flower plan. Share the occasion, date, budget and any reference pictures on WhatsApp for a quotation.",

  budget:
    "Budget bands rather than fixed designs: flowers under ₹499 and bouquets under ₹999. Choose a band and we suggest what fits from the day's flowers, with the price confirmed before you pay.",

  "same-day":
    "Today's offers, from the flowers available on the day. Same-day delivery is not a confirmed service; ask on WhatsApp what can reach your address, and when.",

  "market-price":
    "Products priced at the day's flower market rate rather than a set price. Ask on WhatsApp for today's rate for the quantity you need.",

  "room-mist-diffuser":
    "Scent add-ons for a flower gift: a candle or diffuser, and room mist. The scent is confirmed when you order.",

  "premium-decor":
    "Decor quoted to order: a decor vase, a dried flower vase arrangement and event table decor. Type, size and price are confirmed on WhatsApp.",

  "home-decor":
    "A dried flower bunch for home styling; it needs no water. For more decor, see All Decor.",

  "plants-succulents":
    "Live plants: a mini succulent on its own, and fresh flowers paired with a small plant or succulent. The plant variety and pot depend on availability; we confirm both on WhatsApp.",

  "desk-decor":
    "A mini succulent for a desk or shelf. For more decor, see All Decor.",

  housewarming:
    "Housewarming gifts: fresh flowers with a small plant, and a housewarming hamper with optional extras. For flower designs suited to a housewarming, see the Housewarming occasion page.",

  bride:
    "Bridal flower accessories made to order: floral hair styling, poola jada and gajra. Share the function, date and a reference picture on WhatsApp; we quote once the design is agreed.",

  "premium-flowers":
    "Lily stems sold loose, for arranging yourself; colour and quantity depend on the day's stock. For lily bouquets and arrangements, see Lilies.",
};

export const CATEGORY_NAMES: Record<string, string> = {
  "all-flowers": "All Flowers",
  "pooja-flowers": "Pooja Flowers",
  flowerbox: "Flowerbox",
  baskets: "Baskets",
  offers: "Offers",
  "add-ons": "Add-ons",
  subscriptions: "Subscriptions",
  "dried-flowers": "Dried Flowers",
  "plants-and-succulents": "Plants & Succulents",
  vases: "Vases",
  "floral-tools": "Floral Tools",
  // The URL is kept; the name makes no pet-safety claim.
  "pet-friendly": "Flowers for Homes with Pets",
  "flower-strings-and-torans": "Flower Strings & Torans",
  "room-mist-and-diffuser": "Room Mist & Diffuser",
  hampers: "Hampers",
  wedding: "Wedding",
  "by-stems": "By Stems",
  "eid-al-adha": "Eid Al-Adha",
  lilies: "Lilies: Bouquets, Arrangements & Stems",
  roses: "Roses by Stem",
  "fragrant-lilies": "Fragrant Lilies",
  "tuberose-rajnigandha": "Tuberose / Rajnigandha",
  hydrangeas: "Hydrangeas",
  sunflower: "Sunflower",
  orchid: "Orchid",
  rose: "Rose Bouquets & Arrangements",
  "pastel-flowers": "Pastel Flowers",
  "pink-flowers": "Pink Flowers",
  "white-flowers": "White Flowers",
  "red-flowers": "Red Flowers",
  "yellow-flowers": "Yellow Flowers",
  "blue-flowers": "Blue Flowers",
  // The URL is kept; the name says what it is, an owner-curated selection.
  "bestselling-bouquets": "Selected Bouquets",
  "hand-tied-bouquets": "Wrapped & Hand-Tied Bouquets",
  "mini-bouquets": "Mini Bouquets",
  "bouquets-with-vases": "Bouquets With Vases",
  "floral-torans-and-strings": "Floral Torans & Strings",
  "handcrafted-torans-and-streamers": "Handcrafted Torans & Streamers",
  "pooja-urli-boxes": "Pooja Urli Boxes",
  "fairy-lights-tim-tim-lights": "Fairy Lights / Tim Tim Lights",
  "diyas-and-tea-light-holders": "Diyas & Tea Light Holders",
  "all-decor": "All Decor",
  "all-gifts": "All Gifts",
  "flowers-and-jewellery": "Flowers & Jewellery",
  stationery: "Stationery",
  "planners-and-journal": "Planners & Journal",
  "diy-kits": "DIY Kits",
  skincare: "Skincare",
  tea: "Tea",
  // Collection-tag pages had names built from the slug ("Flower Strings Torans").
  "flower-strings-torans": "Floral Torans & Strings",
  "room-mist-diffuser": "Candles, Diffusers & Room Mist",
  "plants-succulents": "Plants & Succulents",
  "premium-gifting": "Premium Gifting",
  romantic: "Romantic Flowers",
  "daily-use": "Flowers for Daily Use",
  jasmine: "Jasmine (Malli)",
  "bulk-orders": "Bulk Flowers",
  diy: "DIY Flowers",
  gifting: "Gifts & Extras",
  events: "Event Flowers & Decor",
  custom: "Custom Flowers & Decor",
  budget: "Budget Flowers",
  "same-day": "Today's Offers",
  "market-price": "Market-Price Flowers",
  "premium-decor": "Premium Decor",
  "home-decor": "Home Decor",
  "desk-decor": "Desk Decor",
  housewarming: "Housewarming Gifts",
  bride: "Bridal Flowers",
  "premium-flowers": "Premium Flowers: Lily Stems",
};

export const MANUAL_CATEGORY_SLUGS = [
  "all-flowers",
  "eid-al-adha",
  "fragrant-lilies",
  "lilies",
  "tuberose-rajnigandha",
  "hydrangeas",
  "sunflower",
  "orchid",
  "rose",
  "pastel-flowers",
  "pink-flowers",
  "white-flowers",
  "red-flowers",
  "yellow-flowers",
  "blue-flowers",
  "bestselling-bouquets",
  "mini-bouquets",
  "bouquets-with-vases",
  "floral-torans-and-strings",
  "handcrafted-torans-and-streamers",
  "pooja-urli-boxes",
  "fairy-lights-tim-tim-lights",
  "diyas-and-tea-light-holders",
  "all-decor",
  "all-gifts",
  "flowers-and-jewellery",
  "stationery",
  "planners-and-journal",
  "diy-kits",
  "skincare",
  "tea",
];

// Menu categories whose slug matches no product category or collection
// tag, mapped to the real products that genuinely belong there (checked
// against flowerTypes / whatsIncluded / existing tags — nothing invented).
// Menu slugs with no genuine products (Eid al-Adha, Tuberose, Hydrangeas,
// Orchid, Handcrafted Torans, Pooja Urli Boxes, Fairy Lights, Diyas,
// Flowers & Jewellery, Planners & Journal, Skincare, Tea) stay empty and
// are noindexed until real products exist.
const hasTag = (product: Pick<Product, "collectionTags">, tags: string[]) =>
  tags.some((tag) => product.collectionTags?.includes(tag));
export const MENU_CATEGORY_RULES: Record<string, (product: Product) => boolean> = {
  sunflower: (product) => (product.flowerTypes ?? []).some((type) => /sunflower/i.test(type)),
  "floral-torans-and-strings": (product) => hasTag(product, ["flower-strings-torans"]),
  "all-decor": (product) => hasTag(product, ["home-decor", "desk-decor", "premium-decor"]),
  "all-gifts": (product) => hasTag(product, ["gifting", "premium-gifting", "hampers"]),
  stationery: (product) => product.slug === "premium-card-addon",
  "diy-kits": (product) => hasTag(product, ["diy"]),
};


/** Every category address the build generates: product categories, collection tags and menu categories. */
export function categorySlugs(catalogue: Pick<Product, "category" | "collectionTags">[]): string[] {
  // /categories/garlands and /categories/bouquets have their own routes.
  return Array.from(new Set([...catalogue.map((product) => slugify(product.category)), ...catalogue.flatMap((product) => product.collectionTags ?? []), ...MANUAL_CATEGORY_SLUGS])).filter((slug) => slug !== "garlands" && slug !== "bouquets");
}

/** The page's own products (counted), its labelled related choices (not counted) and its count noun. */
export function categoryProducts<T extends Product>(slug: string, publicCatalogue: T[]): CollectionMembership<T> {
  if (slug === "all-flowers") return { primary: allFlowersRange(publicCatalogue), related: [] };
  const flower = FLOWER_PAGES[slug];
  if (flower) return { primary: [...arrangementsWith(publicCatalogue, flower), ...stemsOf(publicCatalogue, flower)], related: [] };
  const recorded = RECORDED_COLLECTIONS[slug]?.(publicCatalogue);
  if (recorded) return recorded;
  return {
    primary: publicCatalogue.filter((product) => slugify(product.category) === slug || product.collectionTags?.includes(slug) || MENU_CATEGORY_RULES[slug]?.(product) === true),
    related: [],
  };
}

/** Name and introduction for a category address. */
export function categoryMeta(slug: string): { name: string; slug: string; description: string } {
  const name = CATEGORY_NAMES[slug] ?? titleFromSlug(slug);
  return { name, slug, description: CATEGORY_INTROS[slug] ?? defaultIntro(name) };
}

// A category with no written introduction (one added later through a new tag or category).
const defaultIntro = (name: string) => `${name}: the designs listed under this name. Choose one and send it on WhatsApp; we confirm the flowers, price and delivery for your date before you pay.`;
