// Site navigation for the launch: one source for the desktop header, the
// mobile menu, the footer and the category strip. Built from
// src/data/launchCatalogue.ts, so a category or occasion appears only when
// it is ready and its page lists launch products.
//
// Earlier departments (pooja flowers, flowerboxes, subscriptions, hampers,
// add-ons, …) are no longer promoted here; their products and pages are
// untouched and stay reachable by URL and search. The previous menu data
// is preserved in src/components/MegaNav.astro (unused).
import { GARLAND_PREVIEW, launchGroups, populatedOccasions, readyCategories } from "./launchCatalogue";

export type NavLink = { label: string; href: string };
export type NavItem = { label: string; href: string; links?: NavLink[]; extra?: NavLink };

const shopLinks: NavLink[] = [
  ...readyCategories().flatMap((category) => [
    { label: `All ${category.label.toLowerCase()}`, href: category.href },
    ...launchGroups(category.id).map(({ group }) => ({ label: group.label, href: `${category.href}#${group.id}` })),
  ]),
  // Local preview only: the garland drafts, clearly labelled.
  ...(GARLAND_PREVIEW ? [{ label: "Garlands / Poola Mala — draft preview", href: "/categories/garlands" }] : []),
];

const occasionLinks: NavLink[] = populatedOccasions().map(({ label, href }) => ({ label, href }));

export const CUSTOM_ORDERS_HREF = "/custom-orders";

export const SITE_NAV: NavItem[] = [
  { label: "Shop Flowers", href: readyCategories()[0]?.href ?? "/categories/bouquets", links: shopLinks },
  {
    label: "Shop by Occasion",
    href: occasionLinks[0]?.href ?? CUSTOM_ORDERS_HREF,
    links: occasionLinks,
    extra: { label: "Another occasion? Ask for a custom order", href: CUSTOM_ORDERS_HREF },
  },
  { label: "Custom Orders", href: CUSTOM_ORDERS_HREF },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];
