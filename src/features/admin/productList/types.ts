import { formatPriceLabel, type PriceType } from "../../../shared/pricing";

export type { PriceType };
export type ProductStatus = "draft" | "published" | "archived";

export type ProductListItem = {
  id: number;
  slug: string;
  name: string;
  categoryId: number;
  categoryName: string;
  primaryImageUrl: string | null;
  priceType: PriceType;
  sellingPrice: number | null;
  compareAtPrice: number | null;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  updatedAt: string;
};

export type CategoryOption = { id: number; name: string; slug: string };

export function formatPrice(item: Pick<ProductListItem, "priceType" | "sellingPrice">): string {
  return formatPriceLabel(item);
}
