// The WhatsApp quotation message for a garland design. Shared by the server-
// rendered links and the product page's quantity script, so both send the
// same text. It names the public design code and title, the quantity, and
// only options the customer actually chose. Garlands are quote-only
// (src/shared/quoteOnly.ts): the message carries no amount and ends by
// asking for the price and availability. It asks for no pincode or delivery
// slot. It asks only for what the page could not know: the ceremony date,
// one garland or a pair (when the sold unit is not recorded), and colour,
// length or other changes; then asks us to confirm the final flowers,
// dimensions, price and delivery.
import { QUOTE_ONLY_CLOSING } from "../shared/quoteOnly";

export type GarlandEnquiry = {
  code: string;
  title: string;
  quantity: number;
  /** Confirmed sold unit; quantities are stated in it once confirmed . */
  unit?: "single" | "pair" | "set" | null;
  /** Options the customer chose, e.g. "Finish: Gold tassels". */
  options?: string[];
  /** Absolute URL of the design page. */
  url?: string;
  /** The occasion the shopper came from, e.g. "Wedding" (optional). */
  occasion?: string | null;
  /** What it's for, e.g. "For the ceremony" (optional). */
  purpose?: string | null;
  /** Recipient city's display name, from the registry (optional). */
  city?: string | null;
};

const UNIT_WORDS = { single: ["garland", "garlands"], pair: ["pair", "pairs"], set: ["set", "sets"] } as const;

export function garlandEnquiryText({ code, title, quantity, unit = null, options = [], url, occasion = null, purpose = null, city = null }: GarlandEnquiry): string {
  const count = Math.max(1, Math.floor(quantity) || 1);
  const unitWord = unit ? ` ${UNIT_WORDS[unit][count === 1 ? 0 : 1]}` : "";
  const lines = [
    "Hi Fresh Petals, I'd like to enquire about this garland.",
    `Design: ${code} — ${title}`,
  ];
  if (url) lines.push(`Link: ${url}`);
  if (city) lines.push(`Recipient city: ${city}`);
  // With a recorded unit the count says it ("2 pairs"). Without one, the
  // count stays a plain number and single-or-pair is asked on its own line:
  // a quantity of 2 is not read as one pair.
  lines.push(`Quantity: ${count}${unitWord}`);
  if (!unit) lines.push("Single garland or pair (each): ");
  if (options.length > 0) lines.push(`Options: ${options.join("; ")}`);
  if (purpose) lines.push(`For: ${purpose}`);
  if (occasion) lines.push(`Occasion: ${occasion}`);
  lines.push(
    "Ceremony date: ",
    "Colours, length or other changes (optional): ",
    "Delivery area (optional): ",
    "",
    "Please confirm the final flowers, length and delivery for this date.",
    QUOTE_ONLY_CLOSING
  );
  return lines.join("\n");
}

/** Path of the live enquiry check (src/pages/garland-enquiry.ts). */
export const GARLAND_ENQUIRY_PATH = "/garland-enquiry";

/**
 * Link for "Enquire / Ask for a quote on WhatsApp". It goes through the live
 * enquiry check, which confirms the garland is still public and builds the
 * WhatsApp message from the saved details — so an unpublished garland can't
 * be enquired about, even from a page still held in a cache.
 */
export function garlandEnquiryHref({
  code,
  quantity = 1,
  options = [],
  occasion,
  purpose,
  city,
}: {
  code: string;
  quantity?: number;
  options?: { name: string; value: string }[];
  /** Occasion route the shopper came from (validated by the enquiry check). */
  occasion?: string | null;
  purpose?: "ceremony" | "gift" | null;
  /** Recipient city slug (validated against the registry by the enquiry check). */
  city?: string | null;
}): string {
  const params = new URLSearchParams({ code, qty: String(Math.max(1, Math.floor(quantity) || 1)) });
  for (const option of options) params.append("opt", `${option.name}::${option.value}`);
  if (occasion) params.set("occ", occasion);
  if (purpose) params.set("for", purpose);
  if (city) params.set("city", city);
  return `${GARLAND_ENQUIRY_PATH}?${params.toString()}`;
}
