// Pure, zero-dependency pricing math shared across three different runtime
// contexts: the server preview endpoint (src/pages/api/admin/products/
// preview.ts), the client product list, and the client Pricing section.
// Keeping it here (no node:* or src/server/** imports) means the exact same
// function can be imported from both an Astro API route and a React
// component without either side risking pulling in server-only code.

export type PriceType = "fixed" | "from" | "market" | "quote";

export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** The label ProductCard actually renders — e.g. "From ₹1,499", "Market price today". */
export function formatPriceLabel(input: { priceType: PriceType; sellingPrice: number | null }): string {
  if (input.priceType === "market") return "Market price today";
  if (input.priceType === "quote") return "Custom quote";
  if (!input.sellingPrice) return "Price on request";

  const formatted = formatCurrency(input.sellingPrice);
  return input.priceType === "from" ? `From ${formatted}` : formatted;
}

/** Null when there's nothing to show a strikethrough for (no compare-at, or it's not actually higher). */
export function computeSavings(sellingPrice: number | null, compareAtPrice: number | null): number | null {
  if (!sellingPrice || !compareAtPrice || compareAtPrice <= sellingPrice) return null;
  return compareAtPrice - sellingPrice;
}

export function computeDiscountPercent(sellingPrice: number | null, compareAtPrice: number | null): number | null {
  const savings = computeSavings(sellingPrice, compareAtPrice);
  if (savings === null || !compareAtPrice) return null;
  return Math.round((savings / compareAtPrice) * 100);
}

export function computeMargin(
  sellingPrice: number | null,
  costPrice: number | null
): { amount: number; percent: number } | null {
  if (!sellingPrice || costPrice === null || costPrice === undefined) return null;
  const amount = sellingPrice - costPrice;
  const percent = Math.round((amount / sellingPrice) * 100);
  return { amount, percent };
}
