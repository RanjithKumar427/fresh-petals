// The buying guides: one entry per published guide. The directory (/guides),
// the footer, the sitemap and the "more guides" links all read this list.
//
// A guide helps someone choose; it is not an article about being the best
// florist. Dates are the days the content was written or last changed.
export type Guide = {
  slug: string;
  path: string;
  /** Short link label. */
  label: string;
  /** H1 and Article headline. */
  heading: string;
  title: string;
  description: string;
  /** What the guide helps decide, for the directory. */
  summary: string;
  published: string;
  updated: string;
  /** Listed by a live sitemap already (the garland guide follows garland publication). */
  liveSitemap?: boolean;
};

export const GUIDES_PATH = "/guides";

export const GUIDES: Guide[] = [
  {
    slug: "choosing-a-flower-bouquet",
    path: `${GUIDES_PATH}/choosing-a-flower-bouquet`,
    label: "Choosing a flower bouquet",
    heading: "How to choose a flower bouquet",
    title: "How to Choose a Flower Bouquet | Roses, Lilies or Mixed | Fresh Petals",
    description: "Choosing a bouquet: how rose, mixed and lily designs differ, wrapped or in a vase, which suit a birthday or an anniversary, and what happens if a flower is unavailable.",
    summary: "Roses, lilies or mixed; wrapped or in a vase; which designs are listed for which occasion.",
    published: "2026-10-13",
    updated: "2026-10-13",
  },
  {
    slug: "choosing-wedding-garlands",
    path: `${GUIDES_PATH}/choosing-wedding-garlands`,
    label: "Choosing a wedding garland",
    heading: "How to choose a wedding garland",
    title: "How to Choose a Wedding Garland | Fresh Petals",
    description: "Choosing a wedding garland (varmala, jaimala, poola mala): rose, lotus and tuberose designs compared in photographs, and what to confirm before ordering.",
    summary: "Rose, lotus and tuberose designs compared in photographs, design codes, and what to confirm about pair, length and date.",
    published: "2026-10-12",
    updated: "2026-10-14",
    liveSitemap: true,
  },
  {
    slug: "jasmine-pooja-flowers-and-gajra",
    path: `${GUIDES_PATH}/jasmine-pooja-flowers-and-gajra`,
    label: "Jasmine, pooja flowers and gajra",
    heading: "Jasmine, pooja flowers and gajra: which to order",
    title: "Jasmine, Pooja Flowers & Gajra: Which to Order | Fresh Petals",
    description: "Loose jasmine or strung gajra, the two pooja flower boxes, baskets and bulk flowers compared, with their listed prices and what to tell us before ordering.",
    summary: "Loose flowers or finished gajra, the two pooja boxes, baskets, and bulk requirements.",
    published: "2026-10-13",
    updated: "2026-10-13",
  },
  {
    slug: "sending-flowers-to-another-city",
    path: `${GUIDES_PATH}/sending-flowers-to-another-city`,
    label: "Sending flowers to another city",
    heading: "Sending flowers to someone in another city",
    title: "Sending Flowers to Another City in India | Fresh Petals",
    description: "How to send flowers to someone in another city: choosing the recipient city, the design, the receiving details we need, and what is confirmed on WhatsApp before you pay.",
    summary: "The recipient city, the design, the receiving details, and what is confirmed before you pay.",
    published: "2026-10-13",
    updated: "2026-10-13",
  },
];

export const guide = (slug: string): Guide => {
  const found = GUIDES.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`Unknown guide: ${slug}`);
  return found;
};

export const BOUQUET_GUIDE = guide("choosing-a-flower-bouquet");
export const GARLAND_GUIDE = guide("choosing-wedding-garlands");
export const POOJA_GUIDE = guide("jasmine-pooja-flowers-and-gajra");
export const SENDING_GUIDE = guide("sending-flowers-to-another-city");

/** The guide that helps choose a catalogue product of this category, if any. */
export function guideForCategory(category: string): Guide | null {
  if (/^(bouquets|lilies)$/i.test(category)) return BOUQUET_GUIDE;
  if (/pooja|strings|torans|flowerbox|baskets/i.test(category)) return POOJA_GUIDE;
  return null;
}
