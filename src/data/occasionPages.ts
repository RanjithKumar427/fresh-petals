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
  /**
   * How to choose for this recipient or event: short, practical points shown
   * with the page's copy. They describe kinds of flowers and what to tell us,
   * never a product that may not be listed, a delivery time or a price.
   */
  choosing?: string[];
  fallbackProductSlugs: string[];
};

export const OCCASION_PAGES: OccasionMeta[] = [
  {
    name: "Birthday",
    slug: "birthday",
    eyebrow: "Birthday Flowers",
    description:
      "Fresh bouquets, baskets, flower boxes and hampers for birthday gifting.",
    heroNote:
      "Choose a birthday-ready flower gift and confirm today’s flower availability on WhatsApp.",
    choosing: [
      "If you know their favourite colour, choose by colour; the colour filter above narrows the list.",
      "Bright mixed designs with gerberas or sunflowers suit friends and family; roses in one colour suit a partner.",
      "A design in a vase stands on a table as it arrives, which helps at an office or a busy home.",
    ],
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
    choosing: [
      "For a partner, red roses are the direct choice; pink, peach or lilies are softer.",
      "For parents or another couple, a lily design or a mixed bouquet reads as a shared gift rather than a romantic one.",
      "Tell us the date early: particular flowers depend on that day's market.",
    ],
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
      "Fresh wedding flowers, bridal accessories, garlands and event flower requirements.",
    heroNote:
      "Wedding and event flower pricing depends on flower type, quantity, date and market rate.",
    choosing: [
      "For the ceremony, choose garlands by design code, and tell us the muhurtham date and time and the venue city.",
      "As a gift for the couple, send a bouquet to the home or the venue; share the venue address and when guests arrive.",
    ],
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
    choosing: [
      "For the ceremony, choose garlands by design code, and say whether you need one garland or a pair.",
      "As a gift for the couple, send a bouquet to the home or the venue; share the address and the time.",
    ],
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
    choosing: [
      "List the flowers the pooja needs — loose flowers, jasmine, garlands or a toran — with roughly how much, and the time you need them by.",
      "Loose flowers and jasmine are priced at the day's market rate, quoted for your date.",
    ],
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
    // The gift list is bouquets only (BOUQUET_ONLY_ROUTES): no hamper, basket, plant or toran is claimed for it.
    description:
      "Gift bouquets for a housewarming or Gruhapravesam, as assigned to the occasion. Pooja flowers, a toran or a hamper for the new home can be discussed on WhatsApp.",
    heroNote:
      "Choose a gift bouquet below, or tell us on WhatsApp what the pooja or the new home needs and we confirm what we can make.",
    choosing: [
      "For the Gruhapravesam pooja, tell us what the priest has asked for (loose flowers, garlands, a toran) and the muhurtham time.",
      "As a gift for the hosts, a design in a vase needs nothing at the new home; a wrapped bouquet needs a vase and water.",
    ],
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
    choosing: [
      "A single-colour bouquet or a flower box suits a host, a teacher or a colleague.",
      "Add a card with a short note; it matters more than the size of the design.",
    ],
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
    choosing: [
      "Check whether the hospital ward allows flowers; many ICUs do not, so send them home instead.",
      "Choose lightly scented flowers, and a design in a vase, so nothing needs arranging.",
    ],
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
    choosing: [
      "Choose their favourite flower or colour rather than the largest design.",
      "Share the card message when you order; a few honest words matter more than the size of the design.",
    ],
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
    // The gift list is bouquets only (BOUQUET_ONLY_ROUTES): no hamper or basket is claimed for it.
    description:
      "Gift bouquets for a baby shower or Seemantham, as assigned to the occasion. Ceremony flowers or a hamper can be discussed on WhatsApp.",
    heroNote:
      "Add a message card when you choose the bouquet, and confirm the flowers and delivery on WhatsApp.",
    choosing: [
      "Soft colours — pastel, white or pink — are the usual choice for a baby shower or Seemantham.",
      "If the mother prefers mild scents, choose roses, gerberas or gypsophila rather than lilies.",
    ],
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
    choosing: [
      "If the mother prefers mild scents, choose roses, gerberas or gypsophila rather than lilies.",
      "A design in a vase, or a small plant, saves the family arranging anything.",
    ],
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
    choosing: [
      "White flowers — lilies, roses or chrysanthemums — are the usual choice for condolence.",
      "Tell us whether the flowers go to the home or to a service, and when they are needed, so we can tell you whether they can reach in time.",
    ],
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
      "A simple flower surprise for someone special, confirmed with you on WhatsApp.",
    choosing: [
      "Small and simple works: a single-colour bouquet or a flower box.",
      "Say whether it is a surprise when you send the order.",
    ],
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
    choosing: [
      "Bright designs suit results, promotions and new jobs.",
      "For an office, a design in a vase stands on a desk as it arrives.",
    ],
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
    choosing: [
      "Red roses for a proposal; tulips or blush lilies for a softer romantic gift.",
      "Share the card message when you order, and say whether it is a surprise.",
    ],
    fallbackProductSlugs: [
      "flower-chocolate-hamper",
      "candle-diffuser-addon",
      "premium-card-addon",
    ],
  },
];
