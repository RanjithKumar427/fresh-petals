// Stable public entry point every service/API route imports from — the
// path itself (`../db/repositories/ProductRepository`) hasn't changed and
// won't need to for future backend swaps. Only what backs it has: this
// used to contain a node:sqlite implementation directly; as of Phase 2B.1
// (see docs/architecture/supabase-migration.md) it re-exports
// SupabaseProductRepository, a Drizzle/Postgres implementation satisfying
// the exact same ProductRepositoryContract below. Rollback is a `git
// revert` of that phase's commit, nothing more — every consumer's import
// statement stays untouched either way.
//
// All type exports below are unchanged from the SQLite era — same shapes,
// same field names. The one interface change every consumer had to adopt
// is every method now returning a Promise: node:sqlite was synchronous,
// pg/Drizzle isn't. That's a property of swapping the datastore, not a
// design choice, and ProductService (the only direct caller) was updated
// to `await` accordingly.
export type ProductStatus = "draft" | "published" | "archived";
export type PriceType = "fixed" | "from" | "market" | "quote";

export type ProductImageInput = {
  mediaId: number;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductImage = ProductImageInput & { id: number; url: string };

export type ProductCoreInput = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  categoryId: number;
  status: ProductStatus;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  priceType: PriceType;
  sellingPrice?: number | null;
  compareAtPrice?: number | null;
  costPrice?: number | null;
  deliveryChargeOverride?: number | null;
  stemCount?: string | null;
  colourTheme?: string | null;
  arrangementStyle?: string | null;
  size?: string | null;
  requiresWhatsappConfirmation: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type ProductRelations = {
  images: ProductImageInput[];
  occasionIds: number[];
  moodIds: number[];
  flowerTypeIds: number[];
  whatsIncluded: string[];
  careInstructions: string[];
};

export type Product = ProductCoreInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  images: ProductImage[];
  occasionIds: number[];
  moodIds: number[];
  flowerTypeIds: number[];
  whatsIncluded: string[];
  careInstructions: string[];
};

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

export type ProductListFilter = {
  search?: string;
  categoryId?: number;
  status?: ProductStatus;
  featured?: boolean;
};

/** The contract every ProductRepository implementation (SQLite, Supabase, or a future one) must satisfy. */
export interface ProductRepositoryContract {
  findById(id: number): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  list(filter?: ProductListFilter): Promise<ProductListItem[]>;
  countAll(): Promise<number>;
  countByStatus(status: ProductStatus): Promise<number>;
  lastUpdatedAt(): Promise<string | null>;
  create(core: ProductCoreInput, relations: ProductRelations): Promise<Product>;
  update(id: number, core: ProductCoreInput, relations: ProductRelations): Promise<Product | null>;
  setStatus(id: number, status: ProductStatus): Promise<Product | null>;
  delete(id: number): Promise<void>;
}

export { SupabaseProductRepository as ProductRepository } from "./SupabaseProductRepository";
