// The city this storefront serves. Delivery lookups only honour
// delivery_zones rows whose `city` matches, so zones seeded for any other
// city (the existing rows are all Hyderabad) are never presented to a
// customer as deliverable here — they fall through to the same
// "we'll confirm manually on WhatsApp" answer as an unknown pincode.
//
// Bengaluru delivery zones (pincodes, fees, same-day/morning capability)
// are a pending business decision: none are invented in code or seeded.
// Once they exist in delivery_zones with city "Bengaluru" (or "Bangalore"),
// the pincode checker and homepage area list pick them up with no code
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
