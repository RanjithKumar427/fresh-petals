// Client-side mirror of the server's Product/ProductInput shapes (see
// src/server/db/repositories/ProductRepository.ts and
// src/server/validation/productSchema.ts). Kept as its own small type here
// rather than imported from src/server/** — that tree pulls in node:sqlite
// transitively, and a React island's bundle should never risk depending on
// server-only modules even via type-only imports.

export type ProductStatus = "draft" | "published" | "archived";
export type PriceType = "fixed" | "from" | "market" | "quote";

export type ProductImageDraft = {
  id?: number; // present once persisted; absent for an image just uploaded this session
  mediaId: number;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  /** Display-only (not sent to PATCH /api/admin/products/[id]) — comes back from the upload response. */
  sizeBytes?: number;
};

export type ProductDraft = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  categoryId: number;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  priceType: PriceType;
  sellingPrice: number | null;
  compareAtPrice: number | null;
  costPrice: number | null;
  deliveryChargeOverride: number | null;
  stemCount: string | null;
  colourTheme: string | null;
  arrangementStyle: string | null;
  size: string | null;
  requiresWhatsappConfirmation: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  images: ProductImageDraft[];
  occasionIds: number[];
  moodIds: number[];
  flowerTypeIds: number[];
  whatsIncluded: string[];
  careInstructions: string[];
};

export type CategoryOption = { id: number; name: string; slug: string };
export type TagOption = { id: number; name: string; slug: string };

/** Strips server-managed fields down to exactly what PATCH /api/admin/products/[id] accepts. */
export function toProductInput(draft: ProductDraft) {
  return {
    name: draft.name,
    slug: draft.slug,
    shortDescription: draft.shortDescription,
    description: draft.description,
    images: draft.images.map((image) => ({
      mediaId: image.mediaId,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary,
    })),
    priceType: draft.priceType,
    sellingPrice: draft.sellingPrice,
    compareAtPrice: draft.compareAtPrice,
    costPrice: draft.costPrice,
    deliveryChargeOverride: draft.deliveryChargeOverride,
    categoryId: draft.categoryId,
    occasionIds: draft.occasionIds,
    moodIds: draft.moodIds,
    flowerTypeIds: draft.flowerTypeIds,
    stemCount: draft.stemCount,
    colourTheme: draft.colourTheme,
    arrangementStyle: draft.arrangementStyle,
    size: draft.size,
    whatsIncluded: draft.whatsIncluded,
    careInstructions: draft.careInstructions,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
    status: draft.status,
    featured: draft.featured,
    bestseller: draft.bestseller,
    newArrival: draft.newArrival,
    requiresWhatsappConfirmation: draft.requiresWhatsappConfirmation,
  };
}
