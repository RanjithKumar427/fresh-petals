// The WhatsApp quotation message for a garland design. Shared by the server-
// rendered links and the product page's quantity script, so both send the
// same text. It names the public design code and title, the listed price
// when the owner has set one, the quantity, and only options the customer
// actually chose. It never multiplies the price into a total (what the price
// covers — single or pair, length — is confirmed in the chat), and asks for
// no pincode or delivery slot. Occasion/date and delivery area are left blank
// for the customer to fill in WhatsApp.
export type GarlandEnquiry = {
  code: string;
  title: string;
  quantity: number;
  /** The listed price exactly as shown on the page, e.g. "₹5,000"; omitted when none is set. */
  price?: string | null;
  /** Confirmed sold unit; quantities are stated in it once confirmed (never multiplied into a total). */
  unit?: "single" | "pair" | "set" | null;
  /** Options the customer chose, e.g. "Finish: Gold tassels". */
  options?: string[];
  /** Absolute URL of the design page. */
  url?: string;
  /** The occasion the shopper came from, e.g. "Wedding" (optional). */
  occasion?: string | null;
  /** What it's for, e.g. "For the ceremony" (optional). */
  purpose?: string | null;
};

const UNIT_WORDS = { single: ["garland", "garlands"], pair: ["pair", "pairs"], set: ["set", "sets"] } as const;

export function garlandEnquiryText({ code, title, quantity, price, unit = null, options = [], url, occasion = null, purpose = null }: GarlandEnquiry): string {
  const count = Math.max(1, Math.floor(quantity) || 1);
  const unitWord = unit ? ` ${UNIT_WORDS[unit][count === 1 ? 0 : 1]}` : "";
  const lines = [
    price ? "Hi Fresh Petals, I'd like to enquire about this garland." : "Hi Fresh Petals, I'd like a quotation for this garland.",
    `Design: ${code} — ${title}`,
  ];
  if (price) lines.push(`Listed price: ${price}${unit ? ` per ${UNIT_WORDS[unit][0]}` : ""}`);
  lines.push(
    `Quantity: ${count}${unitWord}`,
    `Options: ${options.length > 0 ? options.join("; ") : "none chosen — please advise"}`
  );
  if (url) lines.push(`Link: ${url}`);
  if (purpose) lines.push(`For: ${purpose}`);
  lines.push(occasion ? `Occasion: ${occasion}` : "Occasion: ", "Date (optional): ", "Delivery area (optional): ");
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
}: {
  code: string;
  quantity?: number;
  options?: { name: string; value: string }[];
  /** Occasion route the shopper came from (validated by the enquiry check). */
  occasion?: string | null;
  purpose?: "ceremony" | "gift" | null;
}): string {
  const params = new URLSearchParams({ code, qty: String(Math.max(1, Math.floor(quantity) || 1)) });
  for (const option of options) params.append("opt", `${option.name}::${option.value}`);
  if (occasion) params.set("occ", occasion);
  if (purpose) params.set("for", purpose);
  return `${GARLAND_ENQUIRY_PATH}?${params.toString()}`;
}
