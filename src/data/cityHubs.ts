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
  /** Bouquets of one launch group (roses, mixed or lilies). */
  | { kind: "bouquet-group"; group: "roses" | "mixed" | "lilies"; limit: number }
  /** Public garland designs: `each` per browsing group. */
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
  /**
   * A few other published hubs worth offering from this page (registry
   * slugs): cities in the same region, each a separate destination. Never
   * the whole list; that is /locations.
   */
  nearby?: string[];
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
    nearby: ["mysuru", "chennai"],
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
    nearby: ["vijayawada", "visakhapatnam"],
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
    nearby: ["coimbatore", "bengaluru"],
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
    nearby: ["mumbai"],
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
    nearby: ["pune"],
  },
  // ---------------------------------------------------------------------
  // Release 2 (written 13 Oct 2026): ten more hubs. Each is built around a task a
  // buyer has to get through, not a claim about what sells in the city.
  // ---------------------------------------------------------------------

  {
    slug: "delhi",
    title: "Send Flowers to Delhi | Choose by Occasion or Flower | Fresh Petals",
    description:
      "Flowers for delivery in Delhi: start from the occasion, a birthday or an anniversary, or from the flower, roses, lilies or a mixed bouquet. Price and date confirmed on WhatsApp.",
    h1: "Send flowers to Delhi",
    updated: "2026-10-13",
    emphasis: "Two ways in: by the occasion, or by the kind of flower.",
    intro: [
      "There are two sensible ways to choose flowers for someone in Delhi, and they suit different people. If you know the occasion but not the person's taste, start from the occasion. If you know they love lilies, or cannot stand red roses, start from the flower.",
      "Either way ends the same: send the design, the date and the address in Delhi on WhatsApp, and we confirm availability, the price and the delivery details before you pay.",
    ],
    sections: [
      {
        id: "occasion",
        heading: "If you are starting from the occasion",
        body: [
          "The first design here is one listed for birthdays and the second one listed for anniversaries; the assignments are kept up to date by the shop, so these change when they do. The occasion pages list every design for each.",
          "If the date is close, say so in your first message, because what can be made depends on the flowers available that day.",
        ],
        compareHeading: "What each occasion design contains",
        sources: [
          { kind: "occasion", route: "birthday", limit: 1 },
          { kind: "occasion", route: "anniversary", limit: 1 },
        ],
        links: [BIRTHDAY, ANNIVERSARY, OCCASIONS],
      },
      {
        id: "flower",
        heading: "If you are starting from the flower",
        body: [
          "Every bouquet belongs to one of three groups. A rose bouquet is a statement of one colour. A lily bouquet has fewer, larger flowers and opens over several days. A mixed bouquet has no single flower in charge, which makes it the easiest to give when you are unsure.",
          "One design from each group that is not already shown above is listed here, with what its record says it contains.",
        ],
        compareHeading: "One from each flower group",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [{ href: "/categories/bouquets#roses", label: "Rose bouquets" }, { href: "/categories/bouquets#lilies", label: "Lily bouquets" }, { href: "/categories/bouquets#mixed", label: "Mixed bouquets" }],
      },
    ],
    faqs: [
      {
        question: "Is Delhi the same as Gurugram or Noida for delivery?",
        answer:
          "No. Delhi, Gurugram, Noida, Greater Noida, Faridabad and Ghaziabad are separate cities in our list. Choose the one the address is actually in, so the order is marked correctly and we check the right place.",
      },
      {
        question: "I only know the occasion. Is that enough to order?",
        answer:
          "Yes. Pick a design listed for that occasion, or tell us the occasion and a rough budget on WhatsApp and we suggest from what is available for your date.",
      },
      {
        question: "Can I ask for a different flower in a bouquet?",
        answer:
          "Ask when you send the order. Changes depend on the flowers available that day, and we confirm any substitution and the price before you pay.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, OCCASIONS, CUSTOM],
    nearby: ["gurugram", "noida", "jaipur"],
  },

  {
    slug: "gurugram",
    title: "Flowers for Delivery in Gurugram (Gurgaon) | Home or Office | Fresh Petals",
    description:
      "Flowers for a home or an office in Gurugram (Gurgaon): whether to send a wrapped bouquet or a vase arrangement, and the receiving details we need. Price confirmed on WhatsApp.",
    h1: "Flowers for a home or office in Gurugram",
    updated: "2026-10-13",
    emphasis: "Decide where the flowers will be received first; the right design follows from that.",
    intro: [
      "For Gurugram, which many people still type as Gurgaon, the useful first question is not which flower but where the bouquet will be handed over: at a flat, at a gated society's entrance, or at an office reception.",
      "That decides whether a wrapped bouquet or a vase arrangement is the better choice, and what we need to know to get it to the right person. Price, availability and delivery details are confirmed on WhatsApp.",
    ],
    sections: [
      {
        id: "presentation",
        heading: "Wrapped bouquet or vase arrangement",
        body: [
          "A wrapped bouquet is the classic gift, but someone has to find a vase and water for it. At home that is easy. At an office desk it often is not, and the flowers sit in their wrapping until the evening.",
          "A vase arrangement arrives ready to stand on a desk or a counter. The two designs here show the difference; what each comes with is read from its record.",
        ],
        compareHeading: "How these two arrive",
        sources: [{ kind: "presentation" }],
        links: [BOUQUETS, { href: "/categories/bouquets#mixed", label: "Mixed bouquets" }],
      },
      {
        id: "receiving",
        heading: "Receiving details that matter",
        body: [
          "For a home: the tower and flat number, the society's name, and whether the gate needs a call to the resident. For an office: the company name, the floor, the recipient's phone number and the hours someone can accept a delivery.",
          "Put these in the address note when you send your basket. These designs are a starting point if you have not chosen yet, one from each group not shown above.",
        ],
        compareHeading: "What is in each of these",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [{ href: "/categories/bouquets#lilies", label: "Lily bouquets" }, { href: "/categories/bouquets#roses", label: "Rose bouquets" }, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "I searched for Gurgaon. Is this the right page?",
        answer: "Yes. Gurgaon and Gurugram are the same city. Orders marked either way are treated as Gurugram.",
      },
      {
        question: "Can flowers be delivered to an office reception?",
        answer:
          "Tell us it is an office and who should receive the flowers if the recipient is away from the desk. We confirm what is possible for that address and date on WhatsApp before you pay.",
      },
      {
        question: "Can I add a vase to a wrapped bouquet?",
        answer:
          "A glass vase is listed as an add-on. Ask for it when you send the order and it is included in the price we confirm.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, CUSTOM],
    nearby: ["delhi", "noida"],
  },

  {
    slug: "noida",
    title: "Send Flowers to Noida | Design, Message & Gift Details | Fresh Petals",
    description:
      "Sending flowers to someone in Noida: choose the design, write the card message and give the recipient's details. Noida and Greater Noida are listed separately. Price on WhatsApp.",
    h1: "Send flowers to someone in Noida",
    updated: "2026-10-13",
    emphasis: "Three things to settle for a gift: the design, the message, and the recipient's details.",
    intro: [
      "This page is written for someone arranging a gift for another person in Noida. It goes through the three things you decide: which design, what the card says, and the details we need about the recipient.",
      "One thing to check first: Noida and Greater Noida are different cities in our list. If the address is in Greater Noida, choose Greater Noida as the recipient city instead.",
    ],
    sections: [
      {
        id: "design",
        heading: "First, the design",
        body: [
          "If the flowers mark a birthday, these are the designs currently listed for one. When you are choosing for someone whose taste you do not know well, look at the list of flowers rather than the name of the bouquet: it tells you the colours they will actually see.",
        ],
        compareHeading: "The flowers in each design",
        sources: [{ kind: "occasion", route: "birthday", limit: 3 }],
        links: [BIRTHDAY, OCCASIONS, BOUQUETS],
      },
      {
        id: "message",
        heading: "Then the message and the gift details",
        body: [
          "On a product page, the gift panel takes a card message and a delivery date before the bouquet goes into your basket; the basket then asks for the recipient's name and phone number. Keep the message short enough to fit a card, and sign it, so the recipient knows who it is from.",
          "Say whether the flowers are a surprise. These lily and mixed designs are alternatives if roses are not right for the person.",
        ],
        compareHeading: "Alternatives, by what they contain",
        sources: [
          { kind: "bouquet-group", group: "lilies", limit: 2 },
          { kind: "bouquet-group", group: "mixed", limit: 1 },
        ],
        links: [{ href: "/categories/bouquets#lilies", label: "Lily bouquets" }, ANNIVERSARY, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "The address is in Greater Noida. Which city do I choose?",
        answer:
          "Greater Noida. It is a separate city in our list and does not have its own page yet, so choose it as the recipient city on any product page or in the basket, or ask from the delivery cities page.",
      },
      {
        question: "What do you need to know about the recipient?",
        answer:
          "Their name, a phone number, the full address with sector and a landmark, and the date. The basket asks for these; nothing about the recipient is needed just to browse or ask a price.",
      },
      {
        question: "Can I change the message after I send the order?",
        answer: "Yes. Tell us on WhatsApp before you confirm; nothing is final until you have agreed the details and the price.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, { href: "/locations", label: "All delivery cities" }],
    nearby: ["delhi", "gurugram"],
  },

  {
    slug: "kolkata",
    title: "Send Flowers to Kolkata | Family Birthdays & Anniversaries | Fresh Petals",
    description:
      "Flowers for family in Kolkata (Calcutta): designs for a birthday or an anniversary, and how rose, lily and mixed bouquets compare. Date, price and delivery confirmed on WhatsApp.",
    h1: "Flowers for family in Kolkata",
    updated: "2026-10-13",
    emphasis: "For a parent's, sibling's or relative's day: who it is for, then roses, lilies or mixed.",
    intro: [
      "A lot of flowers sent to Kolkata, or Calcutta as it is still often searched, go to family: a mother's birthday, parents' anniversary, an aunt who is unwell. Choosing for family is different from choosing for a partner, and this page is arranged around that.",
      "Tell us who the flowers are for when you write. We confirm the design for your date, the price and the delivery details on WhatsApp.",
    ],
    sections: [
      {
        id: "family",
        heading: "Who is it for",
        body: [
          "For a parent or an older relative, a single strong colour can feel like a romantic gesture; softer colours, lilies or a mixed bouquet usually sit better. For a sibling or a cousin, anything bright works.",
          "One design listed for birthdays is shown here as a starting point; the anniversary page lists the designs kept for that occasion.",
        ],
        compareHeading: "What this design contains",
        sources: [{ kind: "occasion", route: "birthday", limit: 1 }],
        links: [BIRTHDAY, ANNIVERSARY, { href: "/occasions/sympathy", label: "Sympathy flowers" }],
      },
      {
        id: "roses",
        heading: "Roses",
        body: ["Rose bouquets differ from each other mainly in colour, so comparing them is quick: read the colour in each record below and choose the one that suits the relationship."],
        compareHeading: "Rose designs compared",
        sources: [{ kind: "bouquet-group", group: "roses", limit: 2 }],
        links: [{ href: "/categories/bouquets#roses", label: "Rose bouquets" }],
      },
      {
        id: "lilies-mixed",
        heading: "Lilies and mixed bouquets",
        body: [
          "Lilies are the quieter choice and last as the buds open. A mixed bouquet is the cheerful one. If you cannot decide between them, think about the room the flowers will stand in: lilies suit a calm room, a mixed bouquet lifts a plain one.",
        ],
        compareHeading: "Lily and mixed designs compared",
        sources: [
          { kind: "bouquet-group", group: "lilies", limit: 2 },
          { kind: "bouquet-group", group: "mixed", limit: 2 },
        ],
        links: [{ href: "/categories/bouquets#lilies", label: "Lily bouquets" }, { href: "/categories/bouquets#mixed", label: "Mixed bouquets" }, BOUQUETS],
      },
    ],
    faqs: [
      {
        question: "I searched for Calcutta. Is this the same city?",
        answer: "Yes. Kolkata and Calcutta are the same city in our list.",
      },
      {
        question: "My parents do not use WhatsApp. Is that a problem?",
        answer:
          "No. The order is agreed with you. We need a phone number at the address so the delivery can be handed over; give us whichever number will be answered.",
      },
      {
        question: "Which bouquet suits an older relative?",
        answer:
          "There is no rule, but lilies and softer rose colours are the usual choices. Tell us the relationship and the occasion and we suggest from the flowers available for your date.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, OCCASIONS, CUSTOM],
  },

  {
    slug: "ahmedabad",
    title: "Flower Bouquets for Delivery in Ahmedabad | Colour & Presentation | Fresh Petals",
    description:
      "Bouquets for delivery in Ahmedabad (Amdavad): compare designs by colour and by how they are presented, and how to choose when the price is quoted, not displayed.",
    h1: "Bouquets for delivery in Ahmedabad",
    updated: "2026-10-13",
    emphasis: "Compare by colour, then by presentation, then ask for the price.",
    intro: [
      "Our bouquets do not show a price on the page: each is quoted on WhatsApp for your date. That changes how you choose. This page for Ahmedabad, Amdavad to many, sets out a way to compare designs on what you can see, and then get the figures before you commit.",
      "Nothing is charged on this website, and asking for a price does not place an order.",
    ],
    sections: [
      {
        id: "colour",
        heading: "Compare by colour",
        body: [
          "Start with the rose bouquets, because they make colour easy to compare: each is built around one or two shades, listed in its record. Decide which colour suits the occasion before you look at anything else.",
        ],
        compareHeading: "Rose designs, by their recorded flowers",
        sources: [{ kind: "bouquet-group", group: "roses", limit: 3 }],
        links: [{ href: "/categories/bouquets#roses", label: "Rose bouquets" }, ANNIVERSARY],
      },
      {
        id: "presentation",
        heading: "Compare by presentation",
        body: [
          "The same flowers read differently depending on how they arrive. A hand-wrapped bouquet looks like a gift being given. A vase arrangement looks like part of the room. Each record below says what the design comes in.",
        ],
        compareHeading: "How each is presented",
        sources: [{ kind: "presentation" }, { kind: "bouquet-group", group: "lilies", limit: 1 }],
        links: [{ href: "/categories/bouquets#mixed", label: "Mixed bouquets" }, { href: "/categories/bouquets#lilies", label: "Lily bouquets" }],
      },
      {
        id: "price",
        heading: "Choosing without a displayed price",
        body: [
          "Shortlist two or three designs and add them all to your basket, then send it. We reply with a price for each for your date, and you keep the one that fits. If you have a budget, say it in the note and we tell you which designs fall within it.",
          "These remaining designs complete the range, so the shortlist can be made from one page.",
        ],
        compareHeading: "The rest of the range",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [BOUQUETS, CUSTOM, BIRTHDAY],
      },
    ],
    faqs: [
      {
        question: "Why is there no price on the bouquets?",
        answer:
          "Bouquet prices depend on the flowers available for your date. We send the price on WhatsApp once you choose a design, and nothing is charged until you agree to it.",
      },
      {
        question: "Can I ask for prices on several bouquets at once?",
        answer: "Yes. Add them to your basket and send it once; the reply covers each design. Remove the ones you do not want before confirming.",
      },
      {
        question: "I searched for Amdavad. Is this the same city?",
        answer: "Yes. Amdavad and Ahmedabad are the same city in our list.",
      },
    ],
    links: [BOUQUETS, BIRTHDAY, ANNIVERSARY, OCCASIONS, CUSTOM],
  },

  {
    slug: "jaipur",
    title: "Flowers in Jaipur | Bouquets & Wedding Garland Designs | Fresh Petals",
    description:
      "Flowers for delivery in Jaipur: gift bouquets, and wedding garland (varmala, jaimala) designs to choose by photograph and code, with what a ceremony enquiry needs.",
    h1: "Bouquets and wedding garlands for Jaipur",
    updated: "2026-10-13",
    emphasis: "Gift bouquets first, then choosing a garland design and what a ceremony enquiry needs.",
    intro: [
      "This page covers two different orders for Jaipur. A bouquet is a gift chosen in a few minutes. A pair of garlands for a wedding (varmala, jaimala) is chosen from photographs and settled in a conversation, usually well before the day.",
      "Both are confirmed on WhatsApp: availability for your date, the price and the delivery details, before anything is made or paid for.",
    ],
    sections: [
      {
        id: "bouquets",
        heading: "Gift bouquets",
        body: ["Three designs that show the range: a rose bouquet, a mixed bouquet and a lily bouquet. The full collection lists the rest."],
        compareHeading: "What is in each of these",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [BOUQUETS, BIRTHDAY, ANNIVERSARY],
      },
      {
        id: "garland-design",
        heading: "Choosing a garland design",
        body: [
          "Each garland on the site is a photograph with a design code. Choose by looking: the overall colour against the outfits, how full the garland is, and the finish at the top and the ends. The flower groups on the site are a way of browsing the photographs, not a list of every flower in a garland.",
          "Note the code of the design you like. It is what we work from.",
        ],
        compareHeading: "The designs shown, by browsing group",
        sources: [{ kind: "garlands", filters: ["rose", "lotus", "tuberose"], each: 1 }],
        links: [GARLANDS, GUIDE],
      },
      {
        id: "ceremony",
        heading: "What a ceremony enquiry needs",
        body: [
          "Send the design code, the ceremony date and time, whether you need one garland or a pair, and the city and venue. If the outfits are decided, a photograph of the colours helps.",
          "Length, the exact flowers for your date and the price are confirmed in the reply; none of them is fixed on the page. Designs grouped as designer or mixed are shown here.",
        ],
        compareHeading: "Designer and mixed designs",
        sources: [{ kind: "garlands", filters: ["designer-mixed"], each: 3 }],
        links: [{ href: "/occasions/wedding", label: "Wedding flowers" }, GUIDE, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "How early should I enquire about wedding garlands?",
        answer:
          "As soon as you have a date. We do not publish a preparation time; whether a design can be made for your date is confirmed when you enquire.",
      },
      {
        question: "Do the photographs show a pair?",
        answer:
          "Many photographs show two garlands together, but the listing does not fix a quantity. Say whether you need one, a pair or more and we quote for that.",
      },
      {
        question: "Can I order a bouquet and garlands together?",
        answer: "Garlands are enquired about by design code and bouquets through the basket. You can send both to the same WhatsApp chat and we handle them together.",
      },
    ],
    links: [BOUQUETS, GARLANDS, GUIDE, { href: "/occasions/wedding", label: "Wedding flowers" }, CUSTOM],
    nearby: ["delhi"],
  },

  {
    slug: "coimbatore",
    title: "Flowers in Coimbatore | Garlands, Jasmine & Pooja Flowers | Fresh Petals",
    description:
      "Flowers for delivery in Coimbatore (Kovai): browse rose, lotus and tuberose garland designs separately, and choose the right form of jasmine and pooja flowers.",
    h1: "Garlands, jasmine and pooja flowers for Coimbatore",
    updated: "2026-10-13",
    emphasis: "Garlands one flower group at a time, then the forms jasmine and pooja flowers come in.",
    intro: [
      "For Coimbatore, Kovai to those who live there, this page takes garlands one group at a time instead of mixing them, so you can look at rose designs next to rose designs. After that come jasmine and pooja flowers, where the decision is the form you need.",
      "Garlands are quoted on WhatsApp by design code. Pooja items show their own price or the day's market price.",
    ],
    sections: [
      {
        id: "rose",
        heading: "Rose garland designs",
        body: ["Within this group the designs differ in colour and in how the colour is broken up. Compare the photographs for the one closest to what you have in mind, then ask whether the shade can be matched for your date."],
        compareHeading: "Rose group designs shown",
        sources: [{ kind: "garlands", filters: ["rose"], each: 3 }],
        links: [{ href: "/categories/garlands/rose", label: "All rose garlands" }],
      },
      {
        id: "lotus",
        heading: "Lotus garland designs",
        body: ["In this group look at whether the lotus is shown as closed buds or opened flowers, because the two look quite different when worn."],
        compareHeading: "Lotus group designs shown",
        sources: [{ kind: "garlands", filters: ["lotus"], each: 3 }],
        links: [{ href: "/categories/garlands/lotus", label: "All lotus garlands" }],
      },
      {
        id: "tuberose",
        heading: "Tuberose garland designs",
        body: ["These are the pale garlands. What separates one from another is the coloured banding and any panels set into the white, so compare those."],
        compareHeading: "Tuberose group designs shown",
        sources: [{ kind: "garlands", filters: ["tuberose"], each: 3 }],
        links: [{ href: "/categories/garlands/tuberose", label: "All tuberose garlands" }, GUIDE],
      },
      {
        id: "forms",
        heading: "Jasmine and pooja flowers: which form",
        body: [
          "The same flower is sold in different forms, and ordering the wrong one is the common mistake. Loose jasmine is for offering or stringing yourself. Gajra is already strung. Daily pooja flowers are a loose mix; a basket is packed to carry.",
          "Tell us the form and roughly how much. Pack sizes are not fixed on the website.",
        ],
        compareHeading: "Four forms compared",
        sources: [{ kind: "pooja", slugs: ["jasmine-malli", "jasmine-gajra", "daily-pooja-flowers", "pooja-basket"] }],
        links: [POOJA, { href: "/categories/pooja-flowers#strings", label: "Strings, gajra and torans" }],
      },
    ],
    faqs: [
      {
        question: "Does a garland in the rose group contain only roses?",
        answer:
          "Not necessarily. The groups are how the photographs are sorted for browsing. The exact flowers in a garland are confirmed for your date when you enquire with its design code.",
      },
      {
        question: "Why do jasmine prices say market price?",
        answer: "Jasmine and loose flowers change price with each day's market. We quote the day's price on WhatsApp before you confirm.",
      },
      {
        question: "I searched for Kovai. Is this the same city?",
        answer: "Yes. Kovai and Coimbatore are the same city in our list.",
      },
    ],
    links: [GARLANDS, GUIDE, POOJA, BOUQUETS],
    nearby: ["chennai", "bengaluru", "mysuru"],
  },

  {
    slug: "visakhapatnam",
    title: "Send Flowers to Visakhapatnam (Vizag) | Bouquets & Ceremony Flowers | Fresh Petals",
    description:
      "Flowers for Visakhapatnam (Vizag): send a bouquet as a gift, and arrange flowers for a ceremony as a separate request. Each is confirmed on WhatsApp for your date.",
    h1: "Bouquets and ceremony flowers for Visakhapatnam",
    updated: "2026-10-13",
    emphasis: "Two requests that are best kept apart: a bouquet to send, and flowers for a ceremony.",
    intro: [
      "People writing to us about Visakhapatnam, or Vizag, often have two needs at once: a bouquet for someone, and flowers for a function. They are confirmed differently, so this page keeps them apart.",
      "A bouquet is one design for one address on one date. Ceremony flowers are a quantity for an event, and need more of a conversation. Both start on WhatsApp.",
    ],
    sections: [
      {
        id: "bouquet",
        heading: "Sending a bouquet",
        body: [
          "Choose a design and add it to your basket with the date and the recipient's details. These are listed for anniversaries, with two mixed bouquets for any other reason to send flowers.",
        ],
        compareHeading: "The flowers in each bouquet",
        sources: [
          { kind: "occasion", route: "anniversary", limit: 2 },
          { kind: "bouquet-group", group: "mixed", limit: 2 },
        ],
        links: [BOUQUETS, ANNIVERSARY, BIRTHDAY],
      },
      {
        id: "ceremony",
        heading: "A separate ceremony-flower request",
        body: [
          "For a function, send a second message, not a note on the bouquet order. Say what the ceremony is, the date and time, the venue, and what you need: garlands for the event, flowers in bulk, or a wedding garland chosen by design code.",
          "Event garlands and bulk flowers are quoted for your requirement. Keeping this request separate means a question about one does not hold up the other.",
        ],
        compareHeading: "What each of these is for",
        sources: [{ kind: "pooja", slugs: ["event-garlands", "temple-bulk-flowers"] }, { kind: "garlands", filters: ["tuberose", "rose"], each: 1 }],
        links: [GARLANDS, { href: "/categories/pooja-flowers#bulk", label: "Bulk and ceremony flowers" }, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "I searched for Vizag. Is this the same city?",
        answer: "Yes. Vizag and Visakhapatnam are the same city in our list.",
      },
      {
        question: "Can the bouquet and the ceremony flowers arrive together?",
        answer:
          "Ask, and give both addresses and times. They are confirmed as two requests, and we tell you what can be arranged for each before you pay.",
      },
      {
        question: "How much do bulk flowers cost?",
        answer: "Bulk and event flowers are quoted for the quantity and the date. Send your requirement on WhatsApp and we reply with the price.",
      },
    ],
    links: [BOUQUETS, GARLANDS, POOJA, CUSTOM, { href: "/occasions/wedding", label: "Wedding flowers" }],
    nearby: ["vijayawada", "hyderabad"],
  },

  {
    slug: "vijayawada",
    title: "Poola Mala in Vijayawada | Wedding Garland Designs by Code | Fresh Petals",
    description:
      "Poola mala (wedding garlands) for Vijayawada: choose a photographed design by its code, say whether you need one or a pair, and give the ceremony date. Price on WhatsApp.",
    h1: "Poola mala designs for Vijayawada",
    updated: "2026-10-13",
    emphasis: "Three things settle a poola mala order: the design code, one or a pair, and the ceremony date.",
    intro: [
      "A poola mala order for Vijayawada comes down to three answers, and this page takes them in turn: which design, how many, and for when. Every design on the site has a code such as FP-G001, and the code is how we know exactly which photograph you mean.",
      "Prices are not shown for garlands. We send the price for your design and date on WhatsApp, and nothing is made until you confirm.",
    ],
    sections: [
      {
        id: "code",
        heading: "1. Choose the design and note its code",
        body: [
          "Open a design to see the whole photograph, including the top and the tassels. The code is on the photograph and on the design's page. If two designs are close, send both codes and say what you like in each.",
        ],
        compareHeading: "Codes of the designs shown",
        sources: [{ kind: "garlands", filters: ["rose", "lotus"], each: 3 }],
        links: [GARLANDS, { href: "/categories/garlands/rose", label: "Rose garlands" }, { href: "/categories/garlands/lotus", label: "Lotus garlands" }],
      },
      {
        id: "pair",
        heading: "2. One, or a pair",
        body: [
          "Photographs often show two garlands, because they are made for the couple to exchange. The listing itself does not fix a number. Tell us whether you need a single garland, a pair, or additional garlands for others in the ceremony, and we quote for exactly that.",
        ],
        compareHeading: "More designs, with their codes",
        sources: [{ kind: "garlands", filters: ["designer-mixed", "tuberose"], each: 2 }],
        links: [{ href: "/categories/garlands/tuberose", label: "Tuberose garlands" }, GUIDE],
      },
      {
        id: "date",
        heading: "3. The ceremony date, and anything else it needs",
        body: [
          "Give the date and the time of the muhurtham, and where the garlands should be delivered. If the ceremony also needs garlands for the event or flowers in quantity, ask in the same chat and we quote them alongside.",
        ],
        compareHeading: "Other ceremony requirements",
        sources: [{ kind: "pooja", slugs: ["event-garlands", "temple-bulk-flowers"] }],
        links: [{ href: "/occasions/wedding", label: "Wedding flowers" }, { href: "/categories/pooja-flowers#bulk", label: "Bulk and ceremony flowers" }, CUSTOM],
      },
    ],
    faqs: [
      {
        question: "Where do I find a garland's code?",
        answer: "On the corner of its photograph in the listing and at the top of its own page. It starts with FP-G.",
      },
      {
        question: "Is the price for one garland or for a pair?",
        answer: "The price we send is for the number you ask for. Tell us one or a pair when you enquire, so the quote matches.",
      },
      {
        question: "How long is each garland?",
        answer: "Lengths are not listed on the website. Tell us the length you want, or who will wear it, and we confirm what can be made.",
      },
    ],
    links: [GARLANDS, GUIDE, { href: "/occasions/wedding", label: "Wedding flowers" }, POOJA],
    nearby: ["visakhapatnam", "hyderabad"],
  },

  {
    slug: "mysuru",
    title: "Flowers in Mysuru (Mysore) | Jasmine, Pooja Flowers & Bouquets | Fresh Petals",
    description:
      "Flowers for delivery in Mysuru (Mysore): loose jasmine or strung gajra, what to tell us for a pooja, and bouquets to give. Availability and price confirmed on WhatsApp.",
    h1: "Jasmine, pooja flowers and bouquets for Mysuru",
    updated: "2026-10-13",
    emphasis: "Loose jasmine or strings first, then what a pooja needs, then a bouquet to give.",
    intro: [
      "For Mysuru, or Mysore, this page begins with jasmine, because the first question there is always the same: loose, or already strung. It then covers what to tell us for a pooja, and ends with bouquets for when the flowers are a gift.",
      "We do not state where our jasmine is grown or name a variety. What is available, and its price, follow the day's market and are confirmed on WhatsApp.",
    ],
    sections: [
      {
        id: "jasmine",
        heading: "Loose jasmine, or strings and gajra",
        body: [
          "Loose jasmine (mallige) is what you want for offering or for stringing at home to your own length. Gajra and strings arrive ready to wear or to hang. A doorway toran is a different product again, made for the entrance.",
          "For loose flowers tell us the quantity; for strings, the number and the length you need.",
        ],
        compareHeading: "Three forms compared",
        sources: [{ kind: "pooja", slugs: ["jasmine-malli", "jasmine-gajra", "fresh-flower-toran"] }],
        links: [{ href: "/categories/pooja-flowers#strings", label: "Strings, gajra and torans" }, { href: "/categories/pooja-flowers#loose", label: "Loose and daily flowers" }],
      },
      {
        id: "pooja",
        heading: "What to tell us for a pooja",
        body: [
          "Say what the pooja is, the date and the time you need the flowers by, and whether you want them loose, boxed or in a basket. Two boxes are listed: one assorted and priced on the day's market, the other a flowerbox with a starting price.",
        ],
        compareHeading: "Loose, boxed or in a basket",
        sources: [{ kind: "pooja", slugs: ["daily-pooja-flowers", "pooja-flower-box", "pooja-flowerbox", "pooja-basket"] }],
        links: [POOJA, { href: "/categories/pooja-flowers#boxes", label: "Boxes and baskets" }, { href: "/categories/subscriptions", label: "Flower subscriptions" }],
      },
      {
        id: "bouquets",
        heading: "A bouquet to give",
        body: ["When the flowers are a gift and not an offering, these three show the range of bouquets. They are quoted on WhatsApp and can go in the same basket as pooja flowers."],
        compareHeading: "What is in each bouquet",
        sources: [{ kind: "bouquet-mix", each: 1 }],
        links: [BOUQUETS, BIRTHDAY, ANNIVERSARY],
      },
    ],
    faqs: [
      {
        question: "Is this Mysore Mallige?",
        answer:
          "We do not claim a variety or an origin for our jasmine. It is fresh jasmine from the day's market; if a particular kind matters to you, ask and we tell you what is available for your date.",
      },
      {
        question: "How much jasmine is in one order?",
        answer: "Pack sizes are not fixed on the website. Tell us how much you need and we confirm the quantity and the day's price.",
      },
      {
        question: "I searched for Mysore. Is this the same city?",
        answer: "Yes. Mysore and Mysuru are the same city in our list.",
      },
    ],
    links: [POOJA, BOUQUETS, GARLANDS, { href: "/categories/subscriptions", label: "Flower subscriptions" }],
    nearby: ["bengaluru", "coimbatore"],
  },
];

export const cityHub = (slug: string | undefined): CityHub | null => CITY_HUBS.find((hub) => hub.slug === slug) ?? null;

/** Shown on every hub: what the photographs are, and what they are not. */
export const HUB_PHOTO_NOTE =
  "The photographs show our designs. They are examples of what we make, not pictures of orders delivered in this city, and flowers vary naturally in shade and size.";
