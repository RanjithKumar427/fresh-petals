// Postgres/Drizzle implementation of the CategoryRepository contract — see
// CategoryRepository.ts for the stable public export every service
// imports, and SupabaseProductRepository.ts for the fuller explanation of
// this file-per-implementation pattern (this is the second repository to
// follow it, after Product in Phase 2B.1).
//
// Faithful port, not a redesign: same nine methods, same behavior,
// including `update()`'s "fetch existing, merge in whatever changed"
// pattern — kept exactly as-is rather than "improved" into a partial SQL
// UPDATE, because categories are edited one field group at a time from a
// small admin form (not autosaved at Product's frequency), so the extra
// read this costs is immaterial and the simpler code is worth more here
// than the round-trip Product's hot path justified shaving.
import { asc, count, eq, sql } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { categories, products } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { Category } from "./CategoryRepository";

type CategoryRow = typeof categories.$inferSelect;

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageId: row.imageId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const SupabaseCategoryRepository = {
  async list(): Promise<Category[]> {
    return withRepositoryCall("SupabaseCategoryRepository.list", async () => {
      const rows = await getDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
      return rows.map(mapRow);
    });
  },

  async findById(id: number): Promise<Category | null> {
    return withRepositoryCall("SupabaseCategoryRepository.findById", async () => {
      const [row] = await getDb().select().from(categories).where(eq(categories.id, id));
      return row ? mapRow(row) : null;
    });
  },

  async findBySlug(slug: string): Promise<Category | null> {
    return withRepositoryCall("SupabaseCategoryRepository.findBySlug", async () => {
      const [row] = await getDb().select().from(categories).where(eq(categories.slug, slug));
      return row ? mapRow(row) : null;
    });
  },

  async findByName(name: string): Promise<Category | null> {
    return withRepositoryCall("SupabaseCategoryRepository.findByName", async () => {
      // Case-insensitive by lowercasing both sides explicitly (matches the
      // SQLite version's `lower(name) = lower(?)`) rather than relying on
      // ILIKE, since this is an exact-match lookup, not a substring search
      // — ILIKE's pattern-matching semantics aren't the right tool here.
      const [row] = await getDb().select().from(categories).where(sql`lower(${categories.name}) = lower(${name})`);
      return row ? mapRow(row) : null;
    });
  },

  async count(): Promise<number> {
    return withRepositoryCall("SupabaseCategoryRepository.count", async () => {
      const [row] = await getDb().select({ n: count() }).from(categories);
      return row.n;
    });
  },

  async create(input: {
    name: string;
    slug: string;
    description?: string | null;
    imageId?: number | null;
    sortOrder?: number;
  }): Promise<Category> {
    return withRepositoryCall("SupabaseCategoryRepository.create", async () => {
      const now = new Date();
      const [row] = await getDb()
        .insert(categories)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
          imageId: input.imageId ?? null,
          sortOrder: input.sortOrder ?? 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return mapRow(row);
    });
  },

  async update(
    id: number,
    input: Partial<{
      name: string;
      slug: string;
      description: string | null;
      imageId: number | null;
      sortOrder: number;
    }>
  ): Promise<Category | null> {
    return withRepositoryCall("SupabaseCategoryRepository.update", async () => {
      const existing = await this.findById(id);
      if (!existing) return null;

      const [row] = await getDb()
        .update(categories)
        .set({
          name: input.name ?? existing.name,
          slug: input.slug ?? existing.slug,
          description: input.description === undefined ? existing.description : input.description,
          imageId: input.imageId === undefined ? existing.imageId : input.imageId,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();
      return row ? mapRow(row) : null;
    });
  },

  async delete(id: number): Promise<void> {
    return withRepositoryCall("SupabaseCategoryRepository.delete", async () => {
      await getDb().delete(categories).where(eq(categories.id, id));
    });
  },

  /** Used to block deletion in the UI with a friendly message instead of a raw FK error. */
  async countProducts(categoryId: number): Promise<number> {
    return withRepositoryCall("SupabaseCategoryRepository.countProducts", async () => {
      const [row] = await getDb().select({ n: count() }).from(products).where(eq(products.categoryId, categoryId));
      return row.n;
    });
  },
};
