export type ProductStatus = "draft" | "published" | "archived";
export type PriceType = "fixed" | "from" | "market" | "quote";

export type ProductListItem = {
  id: number;
  slug: string;
  name: string;
  categoryId: number;
  categoryName: string;
  primaryImageUrl: string | null;
  priceType: PriceType;
  sellingPrice: number | null;
  discountPrice: number | null;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  updatedAt: string;
};

export type CategoryOption = { id: number; name: string; slug: string };

export function formatPrice(item: Pick<ProductListItem, "priceType" | "sellingPrice" | "discountPrice">): string {
  if (item.priceType === "market") return "Market price";
  if (item.priceType === "quote") return "Custom quote";
  if (!item.sellingPrice) return "—";

  const price = item.discountPrice ?? item.sellingPrice;
  const formatted = `₹${price.toLocaleString("en-IN")}`;
  return item.priceType === "from" ? `From ${formatted}` : formatted;
}
