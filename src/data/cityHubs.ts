// City pages (/locations/<city>): one entry per published hub in
// src/data/serviceCities.ts. The layout is shared (CityHubPage.astro); the
// words here are written for each city, not produced by swapping a name.
//
// What a hub may say. Each city has an editorial emphasis (what the page
// leads with). It is a starting point for the page, not a measured ranking
// of demand and not a limit on what can be ordered there. Products are never
// typed here: a section names a *source* (a bouquet group, an occasion, a
// garland collection, pooja records) and the page lists whatever is public
// in that source when it is rendered, so an unpublished design disappears
// and an empty section is not shown.
//
// What a hub may not say: delivery speed, a fee, a pincode list, a branch or
// dispatch address, local reviews, lead times, sizes, stem counts, or a story
// about an order delivered in the city. Photographs are design examples.
import type { LandingFaq, LandingLink } from "./seoLanding";
import type { GarlandFilterKey } from "./garlandRules";

export type HubSource =
  /** The first `each` bouquets of every launch group (roses, mixed, lilies). */
  | { kind: "bouquet-mix"; each: number }
  /** Bouquets the admin has assigned to an occasion. */
  | { kind: "occasion"; route: "birthday" | "anniversary"; limit: number }
  /** One wrapped bouquet and one vase arrangement, read from the records. */
  | { kind: "presentation" }
  /** Public garland designs: `each` per flower collection. */
  | { kind: "garlands"; filters: GarlandFilterKey[]; each: number }
  /** Pooja catalogue records by slug. */
  | { kind: "pooja"; slugs: string[] };

export type HubSection = {
  id: string;
  heading: string;
  body: string[];
  /** Heading of the comparison list built from the listed products' records. */
  compareHeading: string;
  sources: HubSource[];
  links: LandingLink[];
};

export type CityHub = {
  /** Registry slug (src/data/serviceCities.ts). */
  slug: string;
  title: string;
  description: string;
  h1: string;
  /** Date the page's content was last written (sitemap lastmod). */
  updated: string;
  /** One line under the H1 naming what this page leads with. */
  emphasis: string;
  intro: string[];
  sections: HubSection[];
  faqs: LandingFaq[];
  links: LandingLink[];
};

const GUIDE: LandingLink = { href: "/guides/choosing-wedding-garlands", label: "How to choose a wedding garland" };
const BOUQUETS: LandingLink = { href: "/categories/bouquets", label: "All bouquets" };
const GARLANDS: LandingLink = { href: "/categories/garlands", label: "All wedding garlands" };
const POOJA: LandingLink = { href: "/categories/pooja-flowers", label: "Pooja flowers" };
const BIRTHDAY: LandingLink = { href: "/occasions/birthday", label: "Birthday flowers" };
const ANNIVERSARY: LandingLink = { href: "/occasions/anniversary", label: "Anniversary flowers" };
const OCCASIONS: LandingLink = { href: "/occasions", label: "All occasions" };
const CUSTOM: LandingLink = { href: "/custom-orders", label: "Custom orders" };

export const CITY_HUBS: CityHub[] = [
  {
    slug: "bengaluru",
    title: "Flower Delivery in Bengaluru (Bangalore) | Fresh Petals",
    description:
      "Flowers for delivery in Bengaluru (Bangalore): compare rose, lily and mixed bouquets, pooja flowers and jasmine, and made-to-order wedding garlands. Price and date confirmed on WhatsApp.",
    h1: "Flowers for delivery in Bengaluru",
    updated: "2026-10-13",
    emphasis: "This page starts with three things: choosing a bouquet, flowers for a pooja, and wedding garlands.",
    intro: [
      "Bengaluru, still Bangalore to many who search for it, is where this website began. Whether you live in the city or are sending flowers to someone here, choose a design below and send it to us on WhatsApp with the date and the delivery address.",
      "We reply with whether those flowers are available for your date, the price and the delivery details. Nothing is charged on this website.",
    ],
    sections: [
      {
        id: "bouquets",
        heading: "Choosing a bouquet",
        body: [
          "Our bouquets fall into three groups, and the quickest way to choose is to decide which group fits the person. Roses carry one clear colour. Mixed bouquets are brighter and less formal. Lilies are fewer, larger flowers, and usually arrive with some buds still closed.",
          "One design from each group is shown here; the bouquet collection lists all of them side by side.",
        ],
        compareHeading: "What is in each of these",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [BOUQUETS, { href: "/categories/bouquets#roses", label: "Rose bouquets" }, { href: "/categories/bouquets#lilies", label: "Lily bouquets" }],
      },
      {
        id: "pooja",
        heading: "Flowers for a pooja",
        body: [
          "For a pooja the useful questions are the form and the quantity: loose flowers, loose jasmine (mallige), or a basket that is ready to carry. Loose flowers and jasmine follow the day's flower market, so their price is quoted for your date.",
          "Tell us what the pooja is and roughly how much you need. Pack sizes are not fixed on the website; we confirm them with you.",
        ],
        compareHeading: "How these three differ",
        sources: [{ kind: "pooja", slugs: ["daily-pooja-flowers", "jasmine-malli", "pooja-basket"] }],
        links: [POOJA, { href: "/categories/pooja-flowers#loose", label: "Loose and daily flowers" }, { href: "/categories/pooja-flowers#bulk", label: "Bulk and ceremony flowers" }],
      },
      {
        id: "garlands",
        heading: "Wedding garlands",
        body: [
          "Garlands for the exchange (varmala, jaimala, poola mala) are made to order from a photographed design. Start with the main flower: rose designs differ mostly by colour, lotus designs by how the lotus is combined with other flowers, and tuberose designs are the palest.",
          "Open a design to see it in full and enquire with its code. Length, single or pair, and the exact flowers for your date are settled on WhatsApp before anything is made.",
        ],
        compareHeading: "The designs shown, by main flower",
        sources: [{ kind: "garlands", filters: ["rose", "lotus", "tuberose"], each: 1 }],
        links: [GARLANDS, GUIDE, { href: "/occasions/wedding", label: "Wedding flowers" }],
      },
    ],
    faqs: [
      {
        question: "Do you deliver across Bengaluru?",
        answer:
          "Bengaluru is one of the cities we take orders for. Send us the delivery address and the date on WhatsApp and we confirm whether we can deliver there on that date, and the delivery charge, before you pay.",
      },
      {
        question: "I searched for Bangalore. Is this the same place?",
        answer: "Yes. Bengaluru and Bangalore are the same city, and an order marked either way reaches the same team.",
      },
      {
        question: "Can I order a bouquet and pooja flowers together?",
        answer:
          "Yes. Add both to your basket and send it once. Bouquets are quoted on WhatsApp, and pooja items show their own price or the day's market price; the reply covers everything in the basket.",
      },
    ],
    links: [BOUQUETS, POOJA, GARLANDS, BIRTHDAY, ANNIVERSARY, GUIDE],
  },

  {
    slug: "hyderabad",
    title: "Send Flowers to Hyderabad | Birthday & Anniversary Bouquets | Fresh Petals",
    description:
      "Send flowers to Hyderabad: bouquets chosen for birthdays and anniversaries, and made-to-order garlands for a ceremony. Tell us the date; price and availability on WhatsApp.",
    h1: "Send flowers to Hyderabad",
    updated: "2026-10-13",
    emphasis: "This page starts with gifts for a birthday or an anniversary, then garlands for a ceremony.",
    intro: [
      "Most flowers sent to Hyderabad are for a date that matters: a birthday, an anniversary, or a ceremony at home. This page is arranged that way, so start with the occasion and choose from the designs listed for it.",
      "When you write to us, give the date first. We confirm what can be made for that day in Hyderabad, the price and the delivery details on WhatsApp.",
    ],
    sections: [
      {
        id: "birthday",
        heading: "For a birthday",
        body: [
          "These are the bouquets currently listed for birthdays. If you know the person's favourite colour, choose by colour; if you do not, a mixed bouquet is the safer choice because no single colour has to be right.",
          "Add the name and a short card message when you send the order, and say whether the flowers are a surprise.",
        ],
        compareHeading: "The flowers in each birthday design",
        sources: [{ kind: "occasion", route: "birthday", limit: 3 }],
        links: [BIRTHDAY, BOUQUETS],
      },
      {
        id: "anniversary",
        heading: "For an anniversary",
        body: [
          "Anniversary bouquets are usually chosen by what the colour says. Red roses are the direct choice; pink and peach are softer; lilies suit a couple who would find red roses too much.",
          "If the anniversary is your parents' or a friend's, tell us, and we suggest from what is available that day.",
        ],
        compareHeading: "The flowers in each anniversary design",
        sources: [{ kind: "occasion", route: "anniversary", limit: 3 }],
        links: [ANNIVERSARY, { href: "/categories/bouquets#roses", label: "Rose bouquets" }],
      },
      {
        id: "ceremony",
        heading: "For a ceremony",
        body: [
          "For a wedding or an engagement, garlands (poola mala, varmala) are made to order from a photographed design. Rose designs are the widest group; lotus designs are chosen when the lotus itself should be noticed.",
          "A garland enquiry needs the ceremony date, the design code and whether you need one garland or a pair.",
        ],
        compareHeading: "The designs shown, by main flower",
        sources: [{ kind: "garlands", filters: ["rose", "lotus"], each: 2 }],
        links: [GARLANDS, GUIDE, POOJA],
      },
    ],
    faqs: [
      {
        question: "I live outside Hyderabad. Can I send flowers to someone there?",
        answer:
          "Yes. Choose a design, then give us the recipient's name, phone number and address in Hyderabad along with the date. Availability, the price and payment are agreed with you on WhatsApp.",
      },
      {
        question: "Can the flowers arrive on the birthday itself?",
        answer:
          "Tell us the date and the time of day you prefer. We confirm what we can do for that date before you pay. We do not promise same-day or timed delivery on the website.",
      },
      {
        question: "Do you make garlands in Hyderabad?",
        answer:
          "Garland orders are taken for Hyderabad. Each one is made to order, so send the design code and the ceremony date and we confirm whether it can be made and delivered for that day.",
      },
    ],
    links: [BIRTHDAY, ANNIVERSARY, BOUQUETS, GARLANDS, OCCASIONS, CUSTOM],
  },

  {
    slug: "chennai",
    title: "Flowers in Chennai | Wedding Garlands, Jasmine & Pooja Flowers | Fresh Petals",
    description:
      "Flowers for delivery in Chennai: compare rose, lotus and tuberose wedding garlands, jasmine and gajra, and flowers for a pooja. Price and availability confirmed on WhatsApp.",
    h1: "Flowers for delivery in Chennai",
    updated: "2026-10-13",
    emphasis: "This page starts with comparing garlands, then jasmine and gajra, then flowers for a pooja.",
    intro: [
      "For Chennai this page begins with the flowers that are worn and offered rather than given: garlands (maalai) for a wedding, jasmine and gajra, and flowers for a pooja. Bouquets are a link away if a gift is what you need.",
      "Every garland here is a photograph of a design we can make. Prices are not shown for garlands; send the design code and your date on WhatsApp and we reply with the price and whether it can be made for that day.",
    ],
    sections: [
      {
        id: "garlands",
        heading: "Comparing wedding garlands",
        body: [
          "Compare by the main flower first, because it decides the colour and the weight of the garland. Rose garlands give the strongest colour. Lotus garlands are built around whole lotus flowers and read as more formal. Tuberose garlands are white to ivory and the lightest in colour.",
          "Then look at how each is finished: the hangers at the top and the tassels at the ends are visible in every photograph, and can be changed on request.",
        ],
        compareHeading: "Side by side, by main flower",
        sources: [{ kind: "garlands", filters: ["rose", "lotus", "tuberose"], each: 2 }],
        links: [
          { href: "/categories/garlands/rose", label: "Rose garlands" },
          { href: "/categories/garlands/lotus", label: "Lotus garlands" },
          { href: "/categories/garlands/tuberose", label: "Tuberose garlands" },
          GUIDE,
        ],
      },
      {
        id: "jasmine",
        heading: "Jasmine and gajra",
        body: [
          "Jasmine (malli) comes two ways: loose, for offering or for stringing at home, and already strung as gajra for hair. Decide which you need before you write, and tell us the quantity of loose flowers or the number and length of the strings.",
          "Jasmine prices change with each day's market, so the price is quoted for your date.",
        ],
        compareHeading: "Loose jasmine or gajra",
        sources: [{ kind: "pooja", slugs: ["jasmine-malli", "jasmine-gajra"] }],
        links: [{ href: "/categories/pooja-flowers#strings", label: "Strings, gajra and torans" }, { href: "/categories/pooja-flowers#loose", label: "Loose and daily flowers" }],
      },
      {
        id: "pooja",
        heading: "Flowers for a pooja",
        body: [
          "For a pooja at home, a daily mix or a packed box is usually enough. For a temple offering or a function, ask for bulk flowers and give the date and the quantity.",
          "Some photographs in this section show the kind of flowers supplied rather than the exact pack; what you receive is confirmed with you first.",
        ],
        compareHeading: "Which to ask for",
        sources: [{ kind: "pooja", slugs: ["daily-pooja-flowers", "pooja-flower-box", "temple-bulk-flowers"] }],
        links: [POOJA, { href: "/categories/pooja-flowers#bulk", label: "Bulk and ceremony flowers" }],
      },
    ],
    faqs: [
      {
        question: "Why is there no price on the garlands?",
        answer:
          "A garland's price depends on the flowers, the length and the date. We send the price for the design you choose on WhatsApp before you order, and nothing is made until you confirm.",
      },
      {
        question: "Can a garland be made in different colours from the photograph?",
        answer:
          "Ask with the design code and the colours you want. It depends on the flowers available for your date in Chennai, so we confirm what can be made before you order.",
      },
      {
        question: "Do you send jasmine every day?",
        answer:
          "Regular jasmine and pooja flowers are listed as subscriptions, and each plan is agreed on WhatsApp first: the days, the start date, the quantity and whether we can deliver to your address in Chennai on that schedule.",
      },
    ],
    links: [GARLANDS, GUIDE, POOJA, BOUQUETS, { href: "/occasions/wedding", label: "Wedding flowers" }, CUSTOM],
  },

  {
    slug: "pune",
    title: "Flower Bouquets for Delivery in Pune | Fresh Petals",
    description:
      "Bouquets for delivery in Pune, chosen by occasion: what suits a birthday or an anniversary, and whether to send a wrapped bouquet or flowers in a vase. Price on WhatsApp.",
    h1: "Bouquets for delivery in Pune",
    updated: "2026-10-13",
    emphasis: "This page starts with choosing a bouquet by occasion, then how the gift is presented.",
    intro: [
      "This page is for choosing a bouquet for someone in Pune. It takes the two decisions in order: which design suits the occasion, and how it should arrive, wrapped by hand or already arranged in a vase.",
      "Send your choice on WhatsApp with the date and the address in Pune. We confirm the flowers for that day, the price and the delivery details before you pay.",
    ],
    sections: [
      {
        id: "occasion",
        heading: "Start with the occasion",
        body: [
          "A birthday bouquet can be as bright as you like. An anniversary bouquet is usually one colour, chosen for what it says. The designs below are the ones currently listed for each, so the same bouquet may appear under more than one occasion elsewhere on the site.",
          "For any other reason, a thank-you, a new home, a recovery, the occasion pages list what suits it.",
        ],
        compareHeading: "The flowers in each design",
        sources: [
          { kind: "occasion", route: "birthday", limit: 3 },
          { kind: "occasion", route: "anniversary", limit: 3 },
        ],
        links: [BIRTHDAY, ANNIVERSARY, OCCASIONS],
      },
      {
        id: "presentation",
        heading: "Wrapped, or in a vase",
        body: [
          "A wrapped bouquet is handed over and then needs a vase at the other end. A vase arrangement arrives ready to put on a table, which matters if the flowers are going to an office or to someone who may not have a vase to hand.",
          "A vase can also be added to a wrapped bouquet; ask when you send the order. What each design comes with is read from its record below.",
        ],
        compareHeading: "How each of these is presented",
        sources: [{ kind: "presentation" }],
        links: [BOUQUETS, { href: "/categories/bouquets#mixed", label: "Mixed bouquets" }, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "Can I add a card message?",
        answer:
          "Yes. Write the message when you send the order, or add it with the product's gift details before sending your basket. We confirm it with you on WhatsApp.",
      },
      {
        question: "The flowers are going to an office in Pune. Does that change anything?",
        answer:
          "Tell us it is an office, with the recipient's name, phone number and the hours someone can receive it. A vase arrangement is often easier there than a wrapped bouquet.",
      },
      {
        question: "What if the bouquet I chose is not available that day?",
        answer:
          "We tell you before you pay and suggest the nearest alternative from the flowers available for your date, or you can cancel.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, OCCASIONS, CUSTOM],
  },

  {
    slug: "mumbai",
    title: "Send a Bouquet to Mumbai | Birthday & Anniversary Flowers | Fresh Petals",
    description:
      "Send a bouquet to someone in Mumbai: what we need from you as the sender, and designs for birthdays and anniversaries. Date, price and delivery details confirmed on WhatsApp.",
    h1: "Send a bouquet to Mumbai",
    updated: "2026-10-13",
    emphasis: "This page starts with what a sender needs to give us, then designs for birthdays and anniversaries.",
    intro: [
      "Many bouquets for Mumbai are ordered by someone who is not there. If that is you, this page covers what we need from you and which designs are listed for a birthday or an anniversary.",
      "You do not need the recipient's pincode to start. Send the design, the date and the recipient's address on WhatsApp; we confirm availability, price and the delivery details with you, the sender.",
    ],
    sections: [
      {
        id: "sending",
        heading: "Sending to someone in Mumbai",
        body: [
          "Three things make the order go smoothly: the recipient's name and phone number, a full address with a landmark, and whether the flowers are meant to be a surprise, so we know before anyone is called.",
          "If you have not decided on a design, these three show the range: one rose bouquet, one mixed bouquet and one lily bouquet.",
        ],
        compareHeading: "What is in each of these",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [BOUQUETS, CUSTOM],
      },
      {
        id: "birthday",
        heading: "Birthday designs",
        body: [
          "These are the bouquets currently listed for birthdays. Choose by the person's taste rather than by size: someone who likes strong colour will prefer a mixed bouquet, someone quieter a single-colour one.",
        ],
        compareHeading: "The flowers in each birthday design",
        sources: [{ kind: "occasion", route: "birthday", limit: 3 }],
        links: [BIRTHDAY],
      },
      {
        id: "anniversary",
        heading: "Anniversary designs",
        body: [
          "These are the bouquets currently listed for anniversaries. If you are sending to your own partner, the rose bouquets are the usual choice; for another couple's anniversary, lilies or a softer colour read as a gift from a friend.",
        ],
        compareHeading: "The flowers in each anniversary design",
        sources: [{ kind: "occasion", route: "anniversary", limit: 3 }],
        links: [ANNIVERSARY, { href: "/categories/bouquets#roses", label: "Rose bouquets" }],
      },
    ],
    faqs: [
      {
        question: "Who do you contact, me or the recipient?",
        answer:
          "You. Availability, the price and payment are agreed with the sender on WhatsApp. Tell us if the flowers are a surprise and how you would like the recipient to be reached.",
      },
      {
        question: "Do I need the exact pincode in Mumbai?",
        answer:
          "No. A full address with a landmark is enough to start. If we need anything more to confirm the delivery, we ask you on WhatsApp.",
      },
      {
        question: "Can you deliver to Navi Mumbai or Thane?",
        answer:
          "Navi Mumbai and Thane are listed separately among our delivery cities. Choose the right one as the recipient city so the order is marked correctly.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, OCCASIONS, { href: "/locations", label: "All delivery cities" }],
  },
];

export const cityHub = (slug: string | undefined): CityHub | null => CITY_HUBS.find((hub) => hub.slug === slug) ?? null;

/** Shown on every hub: what the photographs are, and what they are not. */
export const HUB_PHOTO_NOTE =
  "The photographs show our designs. They are examples of what we make, not pictures of orders delivered in this city, and flowers vary naturally in shade and size.";
