// Search-landing copy for the pages that answer distinct Bengaluru
// (Bangalore) flower searches. One entry per search intent, mapped to an
// existing page — no neighbourhood or keyword doorway pages.
//
// Every claim here is either a verified fact about how ordering works
// (cart → WhatsApp; availability, final price, slot and fee confirmed there
// before payment; no payment taken on the website — see cart.astro) or is
// computed at build time from the catalogue and the database prices the
// page itself shows (product counts, lowest "From ₹" price). No delivery
// speed, same-day, coverage, rating or discount claims: none are confirmed
// for Bengaluru yet.

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

// Initial delivery coverage, as stated by the owner. No fee, time window
// or wider coverage is claimed.
const AREA_FAQ: LandingFaq = {
  question: "Which parts of Bengaluru do you deliver to?",
  answer:
    "We're starting with Chamarajpet and Basavanagudi. If you're nearby, message us on WhatsApp: we confirm whether we can deliver to your address, the delivery timing and the final total including delivery before you pay.",
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
      "It depends on the pincode, distance, order size and time slot. The basket may show an estimate for supported pincodes; we confirm the delivery charge on WhatsApp before you pay.",
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
  title: "Flowers & Bouquets in Bangalore | Fresh Petals Bengaluru",
  description:
    "Hand-tied rose, lily and mixed-flower bouquets in Bengaluru (Bangalore), starting with Chamarajpet and Basavanagudi. Choose online, confirm price and delivery on WhatsApp.",
  h1: "Flowers & Bouquets in Bengaluru",
  intro: [
    "Fresh Petals is a WhatsApp-first flower shop in Bengaluru (Bangalore), starting with deliveries in Chamarajpet and Basavanagudi. Browse hand-tied rose, lily and mixed-flower bouquets, add what you like to your cart, and send it to us on WhatsApp.",
    "We confirm availability, delivery timing and the final total including delivery before you pay — no payment is taken on this website.",
  ],
  faqs: [ORDERING_FAQ, AREA_FAQ],
  links: [
    { href: "/categories/bouquets", label: "Flower bouquets" },
    { href: "/categories/bouquets#roses", label: "Rose bouquets" },
    { href: "/categories/bouquets#lilies", label: "Lily bouquets" },
    { href: "/occasions/birthday", label: "Birthday flowers" },
    { href: "/occasions/anniversary", label: "Anniversary flowers" },
    { href: "/custom-orders", label: "Custom orders" },
  ],
};

export const CATEGORY_LANDING: Record<string, LandingContent> = {
  bouquets: {
    title: "Flower Bouquets in Bangalore | Fresh Petals Bengaluru",
    description:
      "Hand-tied rose, lily and mixed-flower bouquets in Bengaluru (Bangalore), starting with Chamarajpet and Basavanagudi. Choose online, confirm on WhatsApp.",
    h1: "Flower Bouquets in Bengaluru",
    intro: [
      "Our launch range: rose bouquets, mixed-flower bouquets with gerberas, sunflowers, chrysanthemums and daisies, and lily bouquets, each wrapped and finished by hand. Deliveries start in Chamarajpet and Basavanagudi.",
      "Pick a bouquet, add a delivery date and recipient details, and send your cart on WhatsApp. We confirm the flowers available that day, delivery timing and the final total including delivery before you pay.",
    ],
    faqs: [
      {
        question: "Can I change the flowers or colours in a bouquet?",
        answer:
          "Yes. Mention the change when you send your cart on WhatsApp. Flowers depend on what is fresh that day, so we confirm any substitutions and the final price with you before you pay.",
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
    title: "Pooja Flowers & Jasmine in Bangalore | Fresh Petals Bengaluru",
    description:
      "Daily pooja flowers, jasmine (malli / mallige), pooja flower boxes, baskets and temple bulk flowers in Bengaluru, priced on the day's flower market.",
    h1: "Pooja Flowers in Bengaluru",
    intro: [
      "Fresh flowers for daily pooja, festivals and temple offerings in Bengaluru (Bangalore): daily pooja flower packs, jasmine (malli / mallige), pooja flower boxes, pooja baskets and temple bulk flowers.",
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
      { href: "/categories/subscriptions", label: "Pooja flower subscriptions" },
      { href: "/categories/flowerbox", label: "Flower boxes" },
      { href: "/categories/baskets", label: "Flower baskets" },
      { href: "/occasions/wedding", label: "Wedding flowers" },
    ],
  },

  subscriptions: {
    title: "Flower Subscriptions in Bangalore | Fresh Petals Bengaluru",
    description:
      "Daily pooja flower, jasmine (malli) and weekly flowerbox subscriptions in Bengaluru (Bangalore). Plans, delivery days and prices confirmed on WhatsApp.",
    h1: "Flower Subscriptions in Bengaluru",
    intro: [
      "Regular fresh flowers for homes in Bengaluru (Bangalore): a daily pooja flower subscription, a jasmine (malli) subscription, a weekly flowerbox and custom plans for homes, pooja and events.",
      "Choose a plan and send it on WhatsApp. We confirm your delivery days, start date, pincode and price before the first delivery.",
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
    title: "Birthday Flowers in Bangalore | Fresh Petals Bengaluru",
    description:
      "Birthday bouquets with roses, lilies and bright mixed flowers in Bengaluru (Bangalore). Choose online, confirm the date and price on WhatsApp.",
    h1: "Birthday Flowers in Bengaluru",
    intro: [
      "Birthday bouquets from our launch range — rose bouquets, bright mixed flowers and lilies — with deliveries starting in Chamarajpet and Basavanagudi.",
      "Add the birthday date, recipient name and a message when you send your cart on WhatsApp. We confirm the flowers, delivery timing and the final total including delivery before you pay.",
    ],
    faqs: [ORDERING_FAQ, AREA_FAQ],
    links: [
      { href: "/categories/bouquets", label: "All bouquets" },
      { href: "/occasions/anniversary", label: "Anniversary flowers" },
      { href: "/custom-orders", label: "Custom orders" },
    ],
  },

  anniversary: {
    title: "Anniversary Flowers in Bangalore | Fresh Petals Bengaluru",
    description:
      "Anniversary bouquets with roses, lilies and romantic arrangements in Bengaluru (Bangalore). Choose online, confirm the date and price on WhatsApp.",
    h1: "Anniversary Flowers in Bengaluru",
    intro: [
      "Anniversary bouquets from our launch range — red, pink and peach rose bouquets and lilies — with deliveries starting in Chamarajpet and Basavanagudi.",
      "Add your anniversary date and a card message when you send your cart on WhatsApp. We confirm the flowers, delivery timing and the final total including delivery before you pay.",
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

// Pages kept for navigation but excluded from search: /categories/same-day
// promises a delivery speed not confirmed for Bengaluru, and
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
