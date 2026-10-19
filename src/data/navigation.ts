// Site navigation for the launch: one source for the desktop header, the
// mobile menu, the footer and the category strip. Categories appear when
// they are ready (src/data/launchCatalogue.ts); occasions when their page
// has eligible products (occasionJourneys.menuOccasions, from this
// deployment's snapshot of the admin's assignments — the header is prebuilt,
// so its occasion menu changes with a deployment).
//
// Earlier departments (flowerboxes, subscriptions, hampers, add-ons, …) are
// not promoted here; their products and pages are untouched and stay
// reachable by URL and search. The previous menu data is preserved in
// src/components/MegaNav.astro (unused).
//
// Pooja flowers is linked as a collection (13 Oct 2026): the page is public
// and indexed but nothing on the site linked to it. It is a single link, not
// a launch category in launchCatalogue.ts, so it changes no product,
// occasion page or homepage range.
import { GARLAND_PREVIEW, readyCategories } from "./launchCatalogue";
import { BOUQUET_FLOWER_GROUPS } from "./catalogueRange";

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href: string; links?: NavLink[]; extra?: NavLink };

export const POOJA_FLOWERS_LINK: NavLink = { label: "Pooja flowers", href: "/categories/pooja-flowers" };
// The whole public flower catalogue. Linked first.
export const ALL_FLOWERS_LINK: NavLink = { label: "All flowers", href: "/categories/all-flowers" };

// "All bouquets" is the full public bouquet range; its sections are the
// recorded-flower groups of /categories/bouquets (rose and lily overlap).
const groupLinks = (categoryId: string, href: string): NavLink[] =>
  categoryId === "bouquets" ? BOUQUET_FLOWER_GROUPS.map((group) => ({ label: group.menuLabel, href: `${href}#${group.id}` })) : [];

const shopLinks: NavLink[] = [
  ALL_FLOWERS_LINK,
  ...readyCategories().flatMap((category) => [{ label: `All ${category.label.toLowerCase()}`, href: category.href }, ...groupLinks(category.id, category.href)]),
  POOJA_FLOWERS_LINK,
  // Local preview only: the garland drafts, clearly labelled.
  ...(GARLAND_PREVIEW ? [{ label: "Garlands / Poola Mala — draft preview", href: "/categories/garlands" }] : []),
];

// The occasion index leads the menu, so "Shop by Occasion" always has a real
// destination of its own (/occasions), whatever the assignments are.
export const OCCASIONS_HREF = "/occasions";

export const CUSTOM_ORDERS_HREF = "/custom-orders";

/** The header's navigation, given the occasion entries that currently have products. */
export function siteNav(occasions: { label: string; href: string }[]): NavItem[] {
  return [
    { label: "Shop Flowers", href: readyCategories()[0]?.href ?? "/categories/bouquets", links: shopLinks },
    {
      label: "Shop by Occasion",
      href: OCCASIONS_HREF,
      links: [{ label: "All occasions", href: OCCASIONS_HREF }, ...occasions.map(({ label, href }) => ({ label, href }))],
      extra: { label: "Another occasion? Ask for a custom order", href: CUSTOM_ORDERS_HREF },
    },
    { label: "Custom Orders", href: CUSTOM_ORDERS_HREF },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];
}
