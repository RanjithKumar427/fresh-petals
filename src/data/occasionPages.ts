// The occasion pages: names, copy and (for the older, non-launch pages) the
// editorial extras listed after the products assigned to the occasion. Every
// page is rendered on request from the admin's occasion assignments
// (src/pages/occasions/[slug].astro, src/data/occasionJourneys.ts).
export type OccasionMeta = {
  name: string;
  slug: string;
  description: string;
  eyebrow: string;
  heroNote: string;
  fallbackProductSlugs: string[];
};

export const OCCASION_PAGES: OccasionMeta[] = [
  {
    name: "Birthday",
    slug: "birthday",
    eyebrow: "Birthday Flowers",
    description:
      "Fresh bouquets, baskets, flower boxes and hampers for birthday gifting in Bengaluru.",
    heroNote:
      "Choose a birthday-ready flower gift and confirm today’s flower availability on WhatsApp.",
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "gift-basket",
      "premium-card-addon",
    ],
  },
  {
    name: "Anniversary",
    slug: "anniversary",
    eyebrow: "Anniversary Flowers",
    description:
      "Romantic rose bouquets, premium gift bouquets, hampers and flower baskets for anniversaries.",
    heroNote:
      "Best for romantic gifting, surprise deliveries and premium flower combinations.",
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "candle-diffuser-addon",
    ],
  },
  {
    name: "Wedding",
    slug: "wedding",
    eyebrow: "Wedding Flowers",
    description:
      "Fresh wedding flowers, bridal accessories, garlands, jasmine gajra and event flower requirements.",
    heroNote:
      "Wedding and event flower pricing depends on flower type, quantity, date and market rate.",
    fallbackProductSlugs: [
      "bridal-flower-accessories",
      "event-garlands",
      "jasmine-gajra",
      "fresh-flower-toran",
      "temple-bulk-flowers",
      "jasmine-malli",
    ],
  },
  {
    // Built only when it has products (see the filter below): garland
    // designs once they are public, or the drafts in a local preview.
    name: "Engagement",
    slug: "engagement",
    eyebrow: "Engagement Flowers",
    description: "Garlands for engagement ceremonies, made to order and quoted on WhatsApp.",
    heroNote: "Garlands are made to order; the flowers, length and price are confirmed with you on WhatsApp.",
    fallbackProductSlugs: [],
  },
  {
    name: "Pooja",
    slug: "pooja",
    eyebrow: "Pooja Flowers",
    description:
      "Fresh pooja flowers, jasmine, torans, pooja flower boxes and baskets for rituals and daily worship.",
    heroNote:
      "Morning pooja flower availability and delivery slots are confirmed on WhatsApp.",
    fallbackProductSlugs: [
      "daily-pooja-flowers",
      "jasmine-malli",
      "pooja-flower-box",
      "pooja-flowerbox",
      "pooja-basket",
      "fresh-flower-toran",
      "temple-bulk-flowers",
    ],
  },
  {
    name: "Housewarming",
    slug: "housewarming",
    eyebrow: "Housewarming Flowers",
    description:
      "Flower hampers, baskets, plants, decor flowers and torans for housewarming gifting and pooja.",
    heroNote:
      "Ideal for Gruhapravesam, new home gifting, pooja decor and premium flower hampers.",
    fallbackProductSlugs: [
      "housewarming-flower-hamper",
      "plant-and-flower-hamper",
      "fresh-flower-toran",
      "flower-basket",
    ],
  },
  {
    name: "Thank You",
    slug: "thank-you",
    eyebrow: "Thank You Flowers",
    description:
      "Simple flower gifts, bouquets, baskets and hampers to say thank you with fresh flowers.",
    heroNote:
      "Add a message card and confirm the final gift combination on WhatsApp.",
    fallbackProductSlugs: [
      "gift-flower-box",
      "flower-chocolate-hamper",
      "premium-card-addon",
      "mini-succulent-gift",
    ],
  },
  {
    name: "Get Well Soon",
    slug: "get-well-soon",
    eyebrow: "Get Well Soon Flowers",
    description:
      "Soft flower arrangements, plants and simple fresh flower gifts for get well soon messages.",
    heroNote:
      "Choose gentle flowers or a simple plant gift and confirm delivery availability.",
    fallbackProductSlugs: [
      "mini-succulent-gift",
      "gift-flower-box",
      "premium-card-addon",
    ],
  },
  {
    name: "I Am Sorry",
    slug: "i-am-sorry",
    eyebrow: "Sorry Flowers",
    description:
      "Rose bouquets, soft flower boxes and premium cards for apology gifting.",
    heroNote:
      "Add a message note and confirm the flower style before order.",
    fallbackProductSlugs: [
      "gift-flower-box",
      "premium-card-addon",
      "flower-chocolate-hamper",
    ],
  },
  {
    name: "Mom To Be",
    slug: "mom-to-be",
    eyebrow: "Mom To Be Flowers",
    description:
      "Soft premium bouquets, hampers, baskets and gentle flower gifts for mom-to-be celebrations.",
    heroNote:
      "Best for baby shower gifting, soft pastel flowers, hampers and thoughtful message cards.",
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "housewarming-flower-hamper",
      "premium-card-addon",
      "mini-succulent-gift",
    ],
  },
  {
    name: "New Mom",
    slug: "new-mom",
    eyebrow: "New Mom Flowers",
    description:
      "Thoughtful flower gifts, plants, hampers and soft bouquets for new mom gifting.",
    heroNote:
      "Keep it gentle, fresh and gift-ready with a message card confirmed on WhatsApp.",
    fallbackProductSlugs: [
      "mini-succulent-gift",
      "flower-chocolate-hamper",
      "premium-card-addon",
    ],
  },
  {
    name: "Sympathy",
    slug: "sympathy",
    eyebrow: "Sympathy Flowers",
    description:
      "Simple, respectful flower arrangements for sympathy, remembrance and support messages.",
    heroNote:
      "Choose soft flowers and a simple note. Final availability and delivery timing are confirmed on WhatsApp.",
    fallbackProductSlugs: [
      "premium-card-addon",
    ],
  },
  {
    name: "Just Because",
    slug: "just-because",
    eyebrow: "Just Because Flowers",
    description:
      "Fresh everyday flowers, flowerboxes, stems and small gifts for no-reason surprises.",
    heroNote:
      "A simple flower surprise for someone special, confirmed quickly on WhatsApp.",
    fallbackProductSlugs: [
      "loose-flower-box",
      "mini-succulent-gift",
    ],
  },
  {
    name: "Congratulations",
    slug: "congratulations",
    eyebrow: "Congratulations Flowers",
    description:
      "Premium bouquets, hampers, baskets and flower gifts for achievements, milestones and celebrations.",
    heroNote:
      "Send a premium fresh flower gift with a message card and optional add-ons.",
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "gift-basket",
      "premium-card-addon",
      "plant-and-flower-hamper",
    ],
  },
  {
    name: "Romantic",
    slug: "romantic",
    eyebrow: "Romantic Flowers",
    description:
      "Rose bouquets, romantic hampers, candles, cards and premium arrangements for love-filled gifting.",
    heroNote:
      "Best for anniversaries, proposals, apology gifting and special romantic surprises.",
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "candle-diffuser-addon",
      "premium-card-addon",
    ],
  },
];
