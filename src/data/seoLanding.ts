// Search-landing copy for the pages that answer distinct flower searches.
// One entry per search intent, mapped to an existing page. These pages are
// national: the homepage is the brand and coverage destination, and a search
// that names a city belongs to that city's page (/locations/<city>,
// src/data/cityHubs.ts) where one is published. No neighbourhood or keyword
// doorway pages.
//
// Every claim here is either a verified fact about how ordering works
// (cart → WhatsApp; availability, final price, slot and fee confirmed there
// before payment; no payment taken on the website — see cart.astro) or is
// computed at build time from the catalogue and the database prices the
// page itself shows (product counts, lowest "From ₹" price). Coverage is the
// owner-confirmed city list (src/data/serviceCities.ts). No delivery speed,
// same-day, fee, rating or discount claims: none are confirmed.
import { COVERAGE_SENTENCE, serviceCityCount } from "./serviceCities";

export type LandingLink = { href: string; label: string };
export type LandingFaq = { question: string; answer: string };

export type LandingContent = {
  /** <title> — primary query first, brand last, ~60 chars. */
  title: string;
  /** Meta description — ~150 chars, what the page genuinely offers. */
  description: string;
  h1: string;
  /** Visible intro paragraphs under the page's H1. */
  intro: string[];
  faqs: LandingFaq[];
  links: LandingLink[];
};

const ORDERING_FAQ: LandingFaq = {
  question: "How does ordering work?",
  answer:
    "Add flowers to your cart and send it to us on WhatsApp. We confirm availability, the final price, your delivery date, slot and fee there before you pay. No payment is taken on this website.",
};

// Delivery coverage, as confirmed by the owner: the cities in the registry.
// The count is derived. No fee, time window or every-address claim is made.
const CITY_COUNT = serviceCityCount();
export const AREA_FAQ: LandingFaq = {
  question: "Which cities do you deliver to?",
  answer: `We take orders for ${CITY_COUNT} cities across India; the full list is on the delivery cities page. Tell us the recipient city, the address and the date on WhatsApp: we confirm whether we can deliver there on that date, and the final total including delivery, before you pay.`,
};

/**
 * Five homepage FAQs — each answer restates the published policy pages
 * (/shipping, /refunds, /terms, /faqs); nothing beyond them. Same-day
 * delivery is described as the FAQ page does (not confirmed), not as the
 * shipping page's slot list (see docs/occasion-journeys.md, open decisions).
 */
export const HOME_FAQS: (LandingFaq & { link?: LandingLink })[] = [
  AREA_FAQ,
  {
    question: "Can you deliver on a particular date — or today?",
    answer:
      "Tell us your date, preferred time and address on WhatsApp. Same-day and express delivery are not confirmed services. Availability and delivery arrangements are agreed before your order is accepted.",
    link: { href: "/shipping", label: "Delivery information" },
  },
  {
    question: "How much is delivery?",
    answer:
      "It depends on the city, the address, the order size and the timing. Delivery charges are confirmed on WhatsApp before you pay; where the basket can estimate a charge for a pincode it says so, and otherwise it tells you the charge will be confirmed.",
  },
  {
    question: "What if a flower isn't available?",
    answer:
      "Flowers vary naturally in shade, size and bloom stage. If a flower in your bouquet isn't available, we tell you before you pay and suggest an alternative — or you can cancel.",
  },
  {
    question: "How do I pay?",
    answer:
      "Nothing is paid on this website. We agree the complete quote and payment arrangements on WhatsApp before accepting your order, then share payment details. We never ask for OTPs or banking passwords.",
  },
];

export const HOME_LANDING: LandingContent = {
  title: "Flower Delivery Across India | Bouquets & Garlands | Fresh Petals",
  description: `Choose bouquets, wedding garlands and pooja flowers for delivery across our ${CITY_COUNT} service cities in India. Share the city and date; price and availability on WhatsApp.`,
  h1: "Flower Delivery Across India",
  intro: [
    `Choose bouquets, wedding garlands and pooja flowers for delivery across our ${CITY_COUNT} service cities. Share the recipient city and date; we confirm availability, price and delivery details on WhatsApp.`,
    "Add what you like to your basket and send it to us. No payment is taken on this website.",
  ],
  faqs: [ORDERING_FAQ, AREA_FAQ],
  links: [
    { href: "/categories/bouquets", label: "Flower bouquets" },
    { href: "/categories/bouquets#roses", label: "Rose bouquets" },
    { href: "/categories/bouquets#lilies", label: "Lily bouquets" },
    { href: "/occasions/birthday", label: "Birthday flowers" },
    { href: "/occasions/anniversary", label: "Anniversary flowers" },
    { href: "/categories/garlands", label: "Wedding garlands" },
    { href: "/categories/pooja-flowers", label: "Pooja flowers" },
    { href: "/locations", label: "Delivery cities" },
    { href: "/custom-orders", label: "Custom orders" },
  ],
};

export const CATEGORY_LANDING: Record<string, LandingContent> = {
  bouquets: {
    title: "Flower Bouquets Online | Rose, Lily & Mixed | Fresh Petals",
    description:
      `Hand-tied rose, lily and mixed-flower bouquets for delivery in ${CITY_COUNT} cities across India. Compare the designs, then get the price for your date on WhatsApp.`,
    h1: "Flower Bouquets",
    intro: [
      "Our launch range: rose bouquets, mixed-flower bouquets with gerberas, sunflowers, chrysanthemums and daisies, and lily bouquets, each wrapped and finished by hand, for delivery in the cities we serve across India.",
      "Pick a bouquet, add the recipient city, a delivery date and recipient details, and send your cart on WhatsApp. We confirm the flowers available that day, delivery timing and the final total including delivery before you pay.",
    ],
    faqs: [
      {
        question: "Can I change the flowers or colours in a bouquet?",
        answer:
          "Yes. Mention the change when you send your cart on WhatsApp. Flowers depend on what is fresh that day, so we confirm any substitutions and the final price with you before you pay.",
      },
      {
        question: "Roses, lilies or mixed flowers: how do I choose?",
        answer:
          "Roses give one clear colour, so choose them when the colour carries the message. Lilies are fewer, larger flowers and suit a quieter, more formal gift. Mixed bouquets are the brightest and the most informal. Each section above lists the flowers in every design.",
      },
      {
        question: "How do I get a price for a particular date?",
        answer:
          "Add the bouquets you like to your basket with the delivery date, or tap Enquire on WhatsApp on any design. We reply with the price and whether those flowers are available for that date. Nothing is charged on this website.",
      },
      AREA_FAQ,
    ],
    links: [
      { href: "/occasions/birthday", label: "Birthday flowers" },
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/custom-orders", label: "Custom orders" },
    ],
  },

  "pooja-flowers": {
    title: "Pooja Flowers & Jasmine (Malli, Mallige) | Fresh Petals",
    description:
      "Daily pooja flowers, jasmine (malli / mallige), pooja flower boxes, baskets and temple bulk flowers, priced on the day's flower market. Availability for your city confirmed on WhatsApp.",
    h1: "Pooja Flowers",
    intro: [
      "Fresh flowers for daily pooja, festivals and temple offerings: loose pooja flowers, jasmine (malli / mallige), pooja flower boxes and baskets, gajra and torans, and bulk flowers for temples and functions.",
      "Loose and pooja flower prices move with the daily flower market, so items marked “market price” are quoted on WhatsApp for your date. For regular pooja flowers, see our flower subscriptions.",
    ],
    faqs: [
      {
        question: "Why do some pooja flowers show “market price”?",
        answer:
          "Jasmine and loose pooja flowers change price with each day's market. We quote the day's price on WhatsApp before you confirm the order.",
      },
      AREA_FAQ,
    ],
    links: [
      { href: "/categories/garlands", label: "Wedding garlands" },
      { href: "/categories/subscriptions", label: "Pooja flower subscriptions" },
      { href: "/categories/flowerbox", label: "Flower boxes" },
      { href: "/categories/baskets", label: "Flower baskets" },
      { href: "/occasions/wedding", label: "Wedding flowers" },
    ],
  },

  subscriptions: {
    title: "Flower Subscriptions | Pooja Flowers & Jasmine | Fresh Petals",
    description:
      "Daily pooja flower, jasmine (malli) and weekly flowerbox subscriptions. Plans, delivery days, your city and prices confirmed on WhatsApp.",
    h1: "Flower Subscriptions",
    intro: [
      "Regular fresh flowers for homes: a daily pooja flower subscription, a jasmine (malli) subscription, a weekly flowerbox and custom plans for homes, pooja and events.",
      "Choose a plan and send it on WhatsApp. We confirm your delivery days, start date, city and address, and price before the first delivery.",
    ],
    faqs: [
      {
        question: "Can I pause or change my subscription?",
        answer:
          "Message us on WhatsApp with the change you need. Changes to delivery days or flowers are confirmed with you there.",
      },
      AREA_FAQ,
    ],
    links: [
      { href: "/categories/pooja-flowers", label: "Pooja flowers" },
      { href: "/categories/flowerbox", label: "Flower boxes" },
      { href: "/categories/bouquets", label: "Flower bouquets" },
    ],
  },
};

export const OCCASION_LANDING: Record<string, LandingContent> = {
  birthday: {
    title: "Birthday Flowers & Bouquets | Send Birthday Flowers | Fresh Petals",
    description:
      `Birthday bouquets with roses, lilies and bright mixed flowers, for delivery in ${CITY_COUNT} cities across India. Choose online, confirm the date and price on WhatsApp.`,
    h1: "Birthday Flowers",
    intro: [
      "Birthday bouquets from our launch range — rose bouquets, bright mixed flowers and lilies — for someone in any of the cities we deliver to.",
      "Add the recipient city, the birthday date, the recipient's name and a message when you send your cart on WhatsApp. We confirm the flowers, delivery timing and the final total including delivery before you pay.",
    ],
    faqs: [ORDERING_FAQ, AREA_FAQ],
    links: [
      { href: "/categories/bouquets", label: "All bouquets" },
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/custom-orders", label: "Custom orders" },
    ],
  },

  anniversary: {
    title: "Anniversary Flowers & Rose Bouquets | Fresh Petals",
    description:
      `Anniversary bouquets with roses, lilies and romantic arrangements, for delivery in ${CITY_COUNT} cities across India. Choose online, confirm the date and price on WhatsApp.`,
    h1: "Anniversary Flowers",
    intro: [
      "Anniversary bouquets from our launch range — red, pink and peach rose bouquets and lilies — for a couple in any of the cities we deliver to.",
      "Add the recipient city, your anniversary date and a card message when you send your cart on WhatsApp. We confirm the flowers, delivery timing and the final total including delivery before you pay.",
    ],
    faqs: [ORDERING_FAQ, AREA_FAQ],
    links: [
      { href: "/categories/bouquets#roses", label: "Rose bouquets" },
      { href: "/categories/bouquets", label: "All bouquets" },
      { href: "/occasions/birthday", label: "Birthday flowers" },
      { href: "/custom-orders", label: "Custom orders" },
    ],
  },
};

/**
 * /occasions/wedding once ceremony garlands are public. The page for wider
 * wedding flower needs; /categories/garlands is the page for garland searches.
 */
export const WEDDING_LANDING = {
  title: "Wedding Flowers | Ceremony Garlands & Bouquets | Fresh Petals",
  description:
    "Wedding flowers: made-to-order ceremony garlands with photographs, and gift bouquets, for delivery across India. Tell us the city and date; price and availability on WhatsApp.",
  h1: "Wedding Flowers",
};

/**
 * Ceremony occasions that are indexable on the strength of their public
 * garlands alone. Engagement lists the same garlands as wedding, so it stays
 * out of search until it has its own gift range.
 */
export const CEREMONY_INDEXABLE_OCCASIONS = new Set(["wedding"]);

/**
 * Tag pages that list exactly the same products as another category page
 * (checked on the live site, 12 Oct 2026). They stay reachable; their
 * canonical names the page to index and they are left out of sitemap.xml.
 */
export const CANONICAL_CATEGORY: Record<string, string> = {
  "flower-strings-torans": "floral-torans-and-strings",
  diy: "diy-kits",
};

// Reward pages that only restate /rewards (manual referral and loyalty, no
// programme details of their own). Reachable, not indexed.
export const NOINDEX_STATIC_PAGES = new Set(["/loyalty", "/refer-a-friend"]);

// Pages kept for navigation but excluded from search: /categories/same-day
// promises a delivery speed that is not confirmed, and
// /occasions/pooja competes with /categories/pooja-flowers (the page mapped
// to pooja-flower searches) for the same query.
export const NOINDEX_CATEGORY_SLUGS = new Set(["same-day"]);
export const NOINDEX_OCCASION_SLUGS = new Set(["pooja"]);

/** Lowest numeric "₹" amount across price labels, or null if none are numeric. */
export function lowestPrice(products: { priceLabel: string }[]): number | null {
  const amounts = products
    .map((product) => product.priceLabel.match(/₹\s?([\d,]+)/)?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number(value.replace(/,/g, "")));
  return amounts.length ? Math.min(...amounts) : null;
}
