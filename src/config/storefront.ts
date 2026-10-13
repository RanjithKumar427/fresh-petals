// The city whose delivery_zones rows the website's delivery ESTIMATOR will
// quote. This is not the service area: orders are taken for every city in
// src/data/serviceCities.ts. The estimator is narrower on purpose. It only
// quotes a fee or a slot from a delivery_zones row whose `city` matches, and
// the existing rows (all Hyderabad, seeded for an earlier storefront with
// fees and same-day flags nobody has confirmed since) are never quoted.
//
// So for every pincode today the estimator answers "Delivery charges will be
// confirmed on WhatsApp", which is a statement about the estimate, never
// that a city is unavailable. No fee, pincode or same-day capability is
// invented in code or seeded. When the owner confirms zones for a city, add
// its rows (and its name here) and the checker quotes them with no other
// change.
export const STOREFRONT_CITY = "Bengaluru";

/** Lower-cased names a delivery_zones.city value may use for this city. */
export const STOREFRONT_CITY_ALIASES = ["bengaluru", "bangalore"];

export function isStorefrontCity(city: string | null | undefined): boolean {
  return STOREFRONT_CITY_ALIASES.includes((city ?? "").trim().toLowerCase());
}

/** The business WhatsApp number every order and enquiry link uses. */
export const WHATSAPP_NUMBER = "919652012274";

/** A wa.me link that opens a chat with the business, with an editable draft. */
export function whatsappLink(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
