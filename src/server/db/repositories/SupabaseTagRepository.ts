// Postgres/Drizzle implementation of the TagRepository factory contract —
// see TagRepository.ts for the stable public export, and
// SupabaseProductRepository.ts for the fuller explanation of the
// file-per-implementation pattern this follows.
//
// occasions, moods and flower_types are still one independent taxonomy
// shape sharing one factory, not three copy-pasted repositories — that
// design decision from the SQLite version carries over unchanged, just
// re-parameterized on a Drizzle table object instead of a raw table-name
// string (Drizzle's query builder needs the actual table reference for
// type safety; a bare string would mean losing column types and falling
// back to raw SQL for everything, which defeats the point of using
// Drizzle here at all).
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { occasions, moods, flowerTypes } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { Tag } from "./TagRepository";

// The three taxonomy tables all share this exact shape (id, name, slug,
// createdAt) — this type captures that shared shape so the factory below
// can accept any of the three without losing type safety to `any`.
type TagTable = typeof occasions | typeof moods | typeof flowerTypes;

function mapRow(row: { id: number; name: string; slug: string; createdAt: Date }): Tag {
  return { id: row.id, name: row.name, slug: row.slug, createdAt: row.createdAt.toISOString() };
}

export function createSupabaseTagRepository(table: TagTable, tableName: string) {
  return {
    async list(): Promise<Tag[]> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).list`, async () => {
        const rows = await getDb().select().from(table).orderBy(asc(table.name));
        return rows.map(mapRow);
      });
    },

    async findById(id: number): Promise<Tag | null> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).findById`, async () => {
        const [row] = await getDb().select().from(table).where(eq(table.id, id));
        return row ? mapRow(row) : null;
      });
    },

    async findByName(name: string): Promise<Tag | null> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).findByName`, async () => {
        // Exact case-insensitive match (not ILIKE substring search) — same
        // reasoning as SupabaseCategoryRepository.findByName.
        const [row] = await getDb().select().from(table).where(sql`lower(${table.name}) = lower(${name})`);
        return row ? mapRow(row) : null;
      });
    },

    async create(input: { name: string; slug: string }): Promise<Tag> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).create`, async () => {
        const [row] = await getDb()
          .insert(table)
          .values({ name: input.name, slug: input.slug, createdAt: new Date() })
          .returning();
        return mapRow(row);
      });
    },

    /** Idempotent — used heavily by product save/seed, where the same tag gets referenced repeatedly. */
    async findOrCreate(name: string, slug: string): Promise<Tag> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).findOrCreate`, async () => {
        const existing = await this.findByName(name);
        if (existing) return existing;
        return this.create({ name, slug });
      });
    },

    async delete(id: number): Promise<void> {
      return withRepositoryCall(`SupabaseTagRepository(${tableName}).delete`, async () => {
        await getDb().delete(table).where(eq(table.id, id));
      });
    },
  };
}
