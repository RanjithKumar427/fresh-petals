// The one rule for what is sold by WhatsApp quotation only. Bouquets and
// garlands are chosen on the website and priced on WhatsApp: customers never
// see their amounts, and no amount is put into a page, a basket, a WhatsApp
// draft or structured data. The database keeps every price; the admin still
// shows and edits them.
//
// Pure and dependency-free, so the same rule runs on the server
// (ProductPricing.ts, garlands.ts), in components and in browser scripts.
// Pages reach it through withAuthoritativePrice() and the garland data
// layer; browser code (product options, basket) calls it on what it stores.

/** Shown wherever a quote-only product's amount would have been. */
export const QUOTE_ONLY_PRICE_LABEL = "Price on WhatsApp";
/** The last line of every WhatsApp draft about quote-only products. */
export const QUOTE_ONLY_CLOSING = "Please share the prices and availability for these selections.";
/** Direct enquiry about one product. */
export const QUOTE_ONLY_ENQUIRE_LABEL = "Enquire on WhatsApp";
/** The basket's final button when it holds quote-only products. */
export const QUOTE_ONLY_BASKET_LABEL = "Request price on WhatsApp";

/** Bouquets (hand-tied and lily arrangements) and garlands. */
export const QUOTE_ONLY_CATEGORIES: readonly string[] = ["Bouquets", "Lilies", "Garlands"];
/** Garland products filed under another category. */
export const QUOTE_ONLY_SLUGS: readonly string[] = ["event-garlands"];

export type QuoteOnlySubject = { category?: string | null; slug?: string | null };

export function isQuoteOnly(item: QuoteOnlySubject | null | undefined): boolean {
  if (!item) return false;
  return QUOTE_ONLY_CATEGORIES.includes(item.category ?? "") || QUOTE_ONLY_SLUGS.includes(item.slug ?? "");
}

export const isQuoteOnlyLabel = (label: string | null | undefined) => label === QUOTE_ONLY_PRICE_LABEL;

/**
 * `product` as customers may see it: the quote-only label instead of an
 * amount, and no regular/sale/discount wording. Other products are returned
 * unchanged.
 */
export function publicPriceView<T extends QuoteOnlySubject & { priceLabel: string }>(product: T): T {
  if (!isQuoteOnly(product)) return product;
  const view: Record<string, unknown> = { ...product, priceLabel: QUOTE_ONLY_PRICE_LABEL };
  if ("priceType" in view) view.priceType = "quote";
  for (const key of ["regularPriceLabel", "salePriceLabel", "discountLabel"]) delete view[key];
  return view as T;
}

/** What the basket page needs to apply the rule in its inline script. */
export const QUOTE_ONLY_CONFIG = {
  label: QUOTE_ONLY_PRICE_LABEL,
  closing: QUOTE_ONLY_CLOSING,
  basketLabel: QUOTE_ONLY_BASKET_LABEL,
  categories: QUOTE_ONLY_CATEGORIES,
  slugs: QUOTE_ONLY_SLUGS,
};
