// Stable public entry point every service imports from — see
// ProductRepository.ts (Phase 2B.1) for the fuller explanation of this
// pattern. As of Phase 2B.2 this re-exports SupabaseCategoryRepository (a
// Drizzle/Postgres implementation) instead of a node:sqlite one. Rollback
// is a `git revert` of that phase's commit; every consumer's import
// statement is untouched either way.
//
// Every method now returns a Promise where its SQLite predecessor returned
// a value directly — the one unavoidable interface change a synchronous-
// to-asynchronous datastore swap forces, same as Product's migration.
export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** The contract every CategoryRepository implementation (SQLite, Supabase, or a future one) must satisfy. */
export interface CategoryRepositoryContract {
  list(): Promise<Category[]>;
  findById(id: number): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  count(): Promise<number>;
  create(input: {
    name: string;
    slug: string;
    description?: string | null;
    imageId?: number | null;
    sortOrder?: number;
  }): Promise<Category>;
  update(
    id: number,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      imageId: number | null;
      sortOrder: number;
    }>
  ): Promise<Category | null>;
  delete(id: number): Promise<void>;
  countProducts(categoryId: number): Promise<number>;
}

export { SupabaseCategoryRepository as CategoryRepository } from "./SupabaseCategoryRepository";
