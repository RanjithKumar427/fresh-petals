// Car Decoration (/categories/car-decoration): vehicle flower decoration,
// car gajamala, new-vehicle delivery garlands, wedding cars, two-wheeler
// garlands and vehicle pooja. One source for the category page, the product
// pages and the tests.
//
// Copy rules (as for garlands, src/data/garlandCollections.ts):
//   - Everything is quoted on WhatsApp (src/shared/quoteOnly.ts). No price,
//     flower count, length, preparation time, availability or delivery speed
//     is stated: none is recorded.
//   - Each product says how it is fulfilled. "Delivered" products are garlands
//     or strings handed over ready to tie; "on-site" products are fitted to the
//     vehicle by our team, which we can only offer where we can reach on the
//     day, so it is confirmed per enquiry. Nothing promises on-site work in
//     every service city.
//   - Every photograph is a real job photographed before publication, with
//     registration plates blanked (scripts/car-decoration/). A photograph that
//     shows the style rather than the product as listed is reviewed as
//     "illustrative" in src/data/productPhotos.ts, and the product page labels
//     it as a representative photograph.
import type { Product } from "./productCatalog";

export const CAR_DECORATION_CATEGORY = "Car Decoration";
export const CAR_DECORATION_SLUG = "car-decoration";
export const CAR_DECORATION_PATH = `/categories/${CAR_DECORATION_SLUG}`;

export type CarFulfilment = "delivered" | "on-site";
export type CarDecorationFacts = {
  fulfilment: CarFulfilment;
  /** What it is made for, in words ("Cars", "Bikes and scooters"). */
  vehicle: string;
  /** The picture is an AI-generated concept of the style, not a photograph of our work. */
  concept?: boolean;
};

/** Per product, by slug. A Car Decoration product without an entry fails the catalogue test. */
export const CAR_DECORATION_FACTS: Record<string, CarDecorationFacts> = {
  "new-car-rose-gajamala": { fulfilment: "delivered", vehicle: "Cars and SUVs" },
  "vehicle-pooja-bonnet-posy": { fulfilment: "on-site", vehicle: "Cars, SUVs and vans" },
  "gerbera-rose-ribbon-car-decoration": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "red-rose-heart-car-decoration": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "gerbera-diagonal-bonnet-sash": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "windscreen-flower-border-car-decoration": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "wedding-car-centre-line-decoration": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "full-car-decoration-marigold-border": { fulfilment: "on-site", vehicle: "Cars, SUVs and MPVs" },
  "red-yellow-rose-bonnet-spray": { fulfilment: "on-site", vehicle: "Cars and SUVs" },
  "bike-scooter-flower-garland": { fulfilment: "delivered", vehicle: "Bikes and scooters", concept: true },
  "white-rose-pearl-wedding-car-decoration": { fulfilment: "on-site", vehicle: "Cars", concept: true },
};

export const isCarDecoration = (product: Pick<Product, "category">) => product.category === CAR_DECORATION_CATEGORY;
export const carDecorationFacts = (slug: string): CarDecorationFacts | undefined => CAR_DECORATION_FACTS[slug];

export const FULFILMENT_COPY: Record<CarFulfilment, { label: string; short: string; detail: string }> = {
  delivered: {
    label: "Delivered, ready to tie",
    short: "Garland delivery",
    detail:
      "We make the garland or strings and deliver them to your address. You or your driver tie them on: delivery does not include fitting them to the vehicle. Tell us the vehicle and where the garland should sit, and we confirm the size when we quote.",
  },
  "on-site": {
    label: "Decorated on site",
    short: "On-site decoration",
    detail:
      "Our team fits the flowers to the vehicle at your home, venue or showroom. On-site work depends on where the vehicle is and the time, so we confirm on WhatsApp whether we can come before anything is booked. If we can't, we tell you, and say whether the garlands can be delivered instead.",
  },
};

/** Shown on every Car Decoration page. Plain safety points, not a legal statement. */
export const VEHICLE_SAFETY: string[] = [
  "Keep the windscreen, rear window, side mirrors, headlamps, indicators and the registration plates clear of flowers.",
  "Nothing should hang over the bonnet edge, the wheels or the exhaust, or loose enough to flap at speed.",
  "Decorated cars are for slow, short drives — a procession, the drive home from a showroom or temple, or a wedding exit — not highway or long trips.",
  "Tie or tape flowers so they come off by hand: no glue, wire or anything that scratches paint, chrome or wraps. Remove the decoration before washing the vehicle.",
  "On a bike or scooter, the garland must not reach the handlebar controls, brakes, wheels, chain or the rider's view. Ride slowly, or remove it before a longer ride.",
  "Remove fresh flowers the same day if you can: wilting petals and wet strings can stain light paint in the sun.",
];

/** What a quote needs. Asked for in the category page draft and listed on product pages. */
export const CAR_ENQUIRY_POINTS: { label: string; detail: string }[] = [
  { label: "The vehicle", detail: "Car, SUV, bike or scooter — the model helps, and its colour if you want the flowers to match." },
  { label: "Delivery or on site", detail: "Whether you want the garlands delivered, or our team to decorate the vehicle where it is." },
  { label: "Date and time", detail: "The pooja, delivery from the showroom, or the wedding time." },
  { label: "Where", detail: "The city and the address or venue. We confirm whether we can deliver or come there on your date." },
  { label: "Flowers and colours", detail: "The style in the photograph, or the colours and flowers you have in mind." },
];

export const CAR_ENQUIRY_DRAFT = [
  "Hi Fresh Petals, I'd like car / vehicle flower decoration.",
  "Vehicle (car, SUV, bike, scooter; model): ",
  "Delivered garlands or on-site decoration: ",
  "Occasion (new vehicle, pooja, wedding): ",
  "Date and time: ",
  "Address or venue: ",
  "Flowers or colours: ",
  "",
  "Please confirm availability and the price.",
].join("\n");

/** The category page's sections, by fulfilment. Products without facts are left out (the test catches them). */
export function carDecorationSections<T extends Pick<Product, "slug">>(products: T[]): { id: string; label: string; note: string | null; products: T[] }[] {
  const order: CarFulfilment[] = ["on-site", "delivered"];
  return order
    .map((fulfilment) => ({
      id: fulfilment === "on-site" ? "decorated-on-site" : "garlands-delivered",
      label: fulfilment === "on-site" ? "Decorated on site" : "Garlands delivered ready to tie",
      note: FULFILMENT_COPY[fulfilment].detail,
      products: products.filter((product) => CAR_DECORATION_FACTS[product.slug]?.fulfilment === fulfilment),
    }))
    .filter((section) => section.products.length > 0);
}
