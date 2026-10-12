// Flower-specific garland collections (/categories/garlands/<flower>) and the
// garland listing's own search-landing copy. A collection is a filter
// membership of the live garland designs (src/data/garlands.ts): it lists
// whatever is public right now, and with no public design it is neither
// indexable nor linked.
//
// Copy rules. Everything here describes what the photographs and catalogue
// titles show (colours, bands, hangers, tassels). Flower filters are assigned
// from the photographs, so the exact flowers, the length, single or pair,
// preparation time and price are never stated: they are listed as points to
// confirm on WhatsApp. No delivery speed, durability or price claim.
import type { GarlandFilterKey } from "./garlandRules";
import type { LandingFaq, LandingLink } from "./seoLanding";

export const GARLANDS_PATH = "/categories/garlands";
export const GARLAND_GUIDE_PATH = "/guides/choosing-wedding-garlands";

/** Where garlands are delivered, as published. Nearby addresses are checked on WhatsApp. */
export const GARLAND_COVERAGE =
  "We make and deliver garlands in Bengaluru, starting with Chamarajpet and Basavanagudi. For a nearby address, send it on WhatsApp and we confirm whether we can deliver there before anything is made.";

/** What every garland enquiry settles before an order is accepted. */
export const GARLAND_CONFIRM_POINTS: { label: string; detail: string }[] = [
  { label: "Colour", detail: "The shades in the photograph, or the ones that match your outfits." },
  { label: "Flowers", detail: "The collections are grouped from the photographs. We confirm the exact flowers for your date." },
  { label: "Length", detail: "Tell us the length you want, or who will wear it, and we confirm what we can make." },
  { label: "Single or pair", detail: "Say whether you need one garland, a pair for the couple, or more." },
  { label: "Ceremony date", detail: "Share the date and time so we can check flower availability." },
  { label: "Quote", detail: "We send the price on WhatsApp. Nothing is charged on this website." },
];

export type GarlandCollection = {
  key: Extract<GarlandFilterKey, "rose" | "lotus" | "tuberose">;
  path: string;
  /** Short link label ("Rose garlands"). */
  label: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Selection guidance grounded in the designs' photographs and titles. */
  guidance: { heading: string; body: string }[];
  faqs: LandingFaq[];
};

export const GARLAND_COLLECTIONS: GarlandCollection[] = [
  {
    key: "rose",
    path: `${GARLANDS_PATH}/rose`,
    label: "Rose garlands",
    title: "Rose Wedding Garlands in Bengaluru | Fresh Petals",
    description:
      "Rose wedding garlands (varmala, poola mala) photographed by Fresh Petals in Bengaluru: red, pink, peach and ivory designs. Price and details on WhatsApp.",
    h1: "Rose Wedding Garlands",
    intro:
      "Rose garlands for the wedding exchange (varmala, jaimala, poola mala), made to order in Bengaluru (Bangalore). Each design below is a photograph of a garland we can make; open one to see it in full and enquire with its design code.",
    guidance: [
      {
        heading: "Start with the colour",
        body: "The photographs include single-colour red, pink, peach, ivory and white rose garlands, and two-colour designs such as red with white or pink with white. Pick the one closest to your outfits, then tell us if you want a shade changed.",
      },
      {
        heading: "Look at how the roses are divided",
        body: "Some designs are roses from top to bottom. Others are broken up with rings, bands or whole sections of baby's breath, or alternate blocks of two rose colours. The more filler, the lighter the colour reads from a distance.",
      },
      {
        heading: "Check the hangers and tassels",
        body: "The top of the garland is finished with pearl strands, gold-coloured bead strands or cord, and the ends with rose tassels, gold-coloured cones or bead tassels. If you prefer a different finish from the photograph, ask for it when you enquire.",
      },
    ],
    faqs: [
      {
        question: "Can a rose garland be made in a different colour from the photograph?",
        answer:
          "Ask us on WhatsApp with the design code and the colours you want. Roses depend on what is available for your date, so we confirm the colours we can make before you order.",
      },
      {
        question: "Are the garlands in the photographs sold as a pair?",
        answer:
          "Many photographs show two garlands together, but the listing does not fix a quantity. Tell us whether you need one, a pair or more, and we quote for that.",
      },
    ],
  },
  {
    key: "lotus",
    path: `${GARLANDS_PATH}/lotus`,
    label: "Lotus garlands",
    title: "Lotus Wedding Garlands in Bengaluru | Fresh Petals",
    description:
      "Lotus wedding garlands photographed by Fresh Petals in Bengaluru: closed-bud and open pink lotus designs, some with jasmine or roses. Price on WhatsApp.",
    h1: "Lotus Wedding Garlands",
    intro:
      "Lotus garlands for the wedding exchange (varmala, poola mala), made to order in Bengaluru (Bangalore). Most are pink lotus, shown as closed buds or opened flowers; open a design to see it in full and enquire with its design code.",
    guidance: [
      {
        heading: "Closed buds or open flowers",
        body: "Closed-bud designs keep a slim, even line of pointed pink buds. Open-lotus designs fold the petals back so each flower shows its layers and looks fuller. The design titles say which is which.",
      },
      {
        heading: "Lotus alone, or with another flower",
        body: "Some designs are lotus from top to bottom, with green leaves or baby's breath between the flowers. Others set a lotus band or spaced lotus into a white jasmine garland, or combine lotus with red roses. White lotus appears in a few designs.",
      },
      {
        heading: "Check the ends",
        body: "Many lotus designs finish with lotus tassels or clusters of buds, on pearl or gold-coloured bead hangers. Lotus is seasonal, so ask us early: we confirm whether it is available for your date.",
      },
    ],
    faqs: [
      {
        question: "Is lotus available all year?",
        answer:
          "Not reliably. Send us your ceremony date on WhatsApp with the design code and we confirm whether lotus is available for it, or suggest the closest design we can make.",
      },
      {
        question: "Can I have a lotus garland with jasmine?",
        answer:
          "Several designs in this collection combine the two. Share the design code, or tell us how much of each you want, and we confirm what we can make.",
      },
    ],
  },
  {
    key: "tuberose",
    path: `${GARLANDS_PATH}/tuberose`,
    label: "Tuberose garlands",
    title: "Tuberose Wedding Garlands in Bengaluru | Fresh Petals",
    description:
      "Tuberose (rajnigandha, sampangi) wedding garlands photographed by Fresh Petals in Bengaluru: white garlands with coloured bands and rose panels. Price on WhatsApp.",
    h1: "Tuberose Wedding Garlands",
    intro:
      "Tuberose (rajnigandha, sampangi) garlands for the wedding exchange, made to order in Bengaluru (Bangalore). These are the dense white garlands, usually marked with coloured bands; open a design to see it in full and enquire with its design code.",
    guidance: [
      {
        heading: "Choose the band colours",
        body: "The white body stays the same; the bands change the look. The photographs show red and gold-coloured bands, blue, teal and green bands, and multicolour sets. Match them to the outfits or to each other for a pair.",
      },
      {
        heading: "Plain bands or flower panels",
        body: "Some designs carry narrow bands near the top and at the tassels only. Others have a broad panel of red or pink roses or buds in the middle, which makes the garland look richer from the front.",
      },
      {
        heading: "Check the tassels",
        body: "The ends are finished with rose tassels, tassel balls, frill tassels or gold-coloured trim. Tell us if you want the tassels from one design on another.",
      },
    ],
    faqs: [
      {
        question: "Can the band colours be changed?",
        answer:
          "Ask us on WhatsApp with the design code and the colours you want. We confirm what we can make for your date before you order.",
      },
      {
        question: "What is tuberose called locally?",
        answer:
          "Tuberose is also known as rajnigandha, sampangi and sugandharaja. If you know the garland by another name, send us a photograph and we will tell you whether we can make it.",
      },
    ],
  },
];

export const garlandCollection = (key: string) => GARLAND_COLLECTIONS.find((collection) => collection.key === key) ?? null;

/** The collections that currently list at least one design, with their counts. */
export function populatedCollections<T extends { garland: { filters: string[] } }>(garlands: T[]) {
  return GARLAND_COLLECTIONS.map((collection) => ({
    collection,
    count: garlands.filter((product) => product.garland.filters.includes(collection.key)).length,
  })).filter((entry) => entry.count > 0);
}

/** /categories/garlands: the page for wedding garland, flower garland and poola mala searches. */
export const GARLANDS_LANDING = {
  title: "Wedding Garlands in Bengaluru | Poola Mala | Fresh Petals",
  description:
    "Wedding garlands (poola mala, varmala, jaimala) made to order in Bengaluru: rose, lotus, tuberose and designer designs with photographs. Price on WhatsApp.",
  intro:
    "Wedding garlands (poola mala, varmala, jaimala) made to order in Bengaluru (Bangalore). Filter by the main flower, open a design to see it in full, and enquire on WhatsApp with its design code. We confirm the flowers, length and price with you there. No pincode or delivery slot is needed to browse.",
  faqs: [
    {
      question: "How do I order a wedding garland?",
      answer:
        "Open the design you like and tap Enquire on WhatsApp. The message carries the design code and quantity. We reply with availability for your date and the price, and nothing is made or charged until you confirm.",
    },
    {
      question: "Where do you deliver garlands?",
      answer: GARLAND_COVERAGE,
    },
    {
      question: "Why is there no price on the page?",
      answer:
        "Garland prices depend on the flowers, the length and the date. We send the price for the design you choose on WhatsApp before you order.",
    },
  ] satisfies LandingFaq[],
  links: [
    { href: GARLAND_GUIDE_PATH, label: "How to choose a wedding garland" },
    { href: "/occasions/wedding", label: "Wedding flowers" },
    { href: "/categories/pooja-flowers", label: "Pooja flowers" },
    { href: "/custom-orders", label: "Custom orders" },
  ] satisfies LandingLink[],
};
