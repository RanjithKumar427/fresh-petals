// The one source of public business facts, for visible copy and structured
// data alike (homepage, About, Contact, guides). Only facts that are verified
// or already shown on the site:
//   - the public name and its one-word spelling;
//   - the canonical domain (Astro.site) and the WhatsApp number every order
//     link uses (src/config/storefront.ts);
//   - the business's existing Instagram account;
//   - the owner-confirmed service cities (src/data/serviceCities.ts);
//   - how ordering works: chosen online, confirmed and paid for on WhatsApp;
//   - the FP mark in public/ (favicon.svg, apple-touch-icon.png).
//
// Deliberately absent, because none is verified: founding date, registrations,
// credentials, a street address, branches, opening hours, ratings, delivery
// times. Structured data is an Organization, never a LocalBusiness.
//
// Where the business started is not stated anywhere on the site: the owner
// has not confirmed it (an earlier About page said Bengaluru, while the
// Instagram handle and the published feedback are labelled Hyderabad). The
// 59 cities are delivery coverage, never branches.
import { WHATSAPP_NUMBER } from "../config/storefront";
import { serviceCityCount, serviceableCities } from "./serviceCities";

export const BUSINESS = {
  name: "Fresh Petals",
  /** The same name written as one word, as some customers type it. */
  alternateName: "FreshPetals",
  instagram: "https://www.instagram.com/freshpetals.hyderabad/",
  whatsappNumber: WHATSAPP_NUMBER,
  /** As shown to customers. */
  whatsappDisplay: "+91 96520 12274",
  /** As a schema.org telephone. */
  telephone: "+91-96520-12274",
  /** The FP mark (180×180 PNG in public/). */
  logoPath: "/apple-touch-icon.png",
  ordering: "Choose online and send your basket or enquiry on WhatsApp. We confirm availability, the price and the delivery details there before you pay. No payment is taken on this website.",
} as const;

export const businessSummary = () =>
  `${BUSINESS.name} takes orders for bouquets, made-to-order wedding garlands and pooja flowers in ${serviceCityCount()} cities across India. ${BUSINESS.ordering}`;

type Site = URL | string | undefined;
const root = (site: Site) => new URL("/", site).toString();
export const organizationId = (site: Site) => `${root(site)}#organization`;
export const websiteId = (site: Site) => `${root(site)}#website`;

/** A reference to the one Organization node (publisher, author, about). */
export const organizationRef = (site: Site) => ({ "@id": organizationId(site) });

/** The full Organization node. Emitted once per page that describes the business. */
export function organizationNode(site: Site) {
  return {
    "@type": "Organization",
    "@id": organizationId(site),
    name: BUSINESS.name,
    alternateName: BUSINESS.alternateName,
    url: root(site),
    logo: new URL(BUSINESS.logoPath, site).toString(),
    sameAs: [BUSINESS.instagram],
    areaServed: serviceableCities().map((city) => ({ "@type": "City", name: city.name })),
    contactPoint: { "@type": "ContactPoint", telephone: BUSINESS.telephone, contactType: "customer service", availableLanguage: "en" },
  };
}

/** A short Organization node for pages that only need to name the publisher. */
export function publisherNode(site: Site) {
  return { "@type": "Organization", "@id": organizationId(site), name: BUSINESS.name, url: root(site), logo: new URL(BUSINESS.logoPath, site).toString() };
}

export function websiteNode(site: Site) {
  return { "@type": "WebSite", "@id": websiteId(site), name: BUSINESS.name, alternateName: BUSINESS.alternateName, url: root(site), inLanguage: "en-IN", publisher: organizationRef(site) };
}
