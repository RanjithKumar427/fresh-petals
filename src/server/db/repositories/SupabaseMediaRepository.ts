// Postgres/Drizzle implementation of the MediaRepository contract — see
// MediaRepository.ts for the stable public export, and
// SupabaseProductRepository.ts for the fuller explanation of this
// file-per-implementation pattern.
//
// Scope note (disclosed in full in the Phase 2B.2 report, not hidden
// here): this migrates MediaRepository's complete current method surface,
// which includes both the originally-committed baseline (list, findById,
// count, create, delete, isInUse) and methods added since for the Media
// Library milestone (countByFolder, rename, updateAltText, updateLocation,
// getUsage, the MEDIA_FOLDERS 8-value list) that hadn't been committed yet
// when this phase began. They couldn't be cleanly split into a smaller
// migration without leaving the working tree's already-written Media
// Library UI code pointing at methods that no longer exist — so the whole
// repository moved together. The Media Library's UI-facing code (React
// components, admin pages, the folders API route) is NOT part of this
// phase and stays exactly as uncommitted as it was before.
import { count, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../postgres/client";
import { media, productImages, products, categories } from "../postgres/schema";
import { withRepositoryCall } from "../postgres/repository";
import type { Media, MediaFolder, MediaListItem, MediaUsage } from "./MediaRepository";

type MediaRow = typeof media.$inferSelect;

function mapRow(row: MediaRow): Media {
  return {
    id: row.id,
    filename: row.filename,
    path: row.path,
    url: row.url,
    folder: row.folder,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    altText: row.altText,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export const SupabaseMediaRepository = {
  async list(filter?: { folder?: MediaFolder; search?: string; unused?: boolean }): Promise<MediaListItem[]> {
    return withRepositoryCall("SupabaseMediaRepository.list", async () => {
      const conditions = [];
      if (filter?.folder) conditions.push(eq(media.folder, filter.folder));
      if (filter?.search) {
        conditions.push(sql`(${media.filename} ILIKE ${`%${filter.search}%`} OR ${media.altText} ILIKE ${`%${filter.search}%`})`);
      }
      if (filter?.unused) {
        conditions.push(sql`
          ${media.id} NOT IN (SELECT ${productImages.mediaId} FROM ${productImages})
          AND ${media.id} NOT IN (SELECT ${categories.imageId} FROM ${categories} WHERE ${categories.imageId} IS NOT NULL)
        `);
      }

      // Real bug found and fixed during this phase's own browser
      // verification, not by inspection: an earlier version of this used
      // correlated subqueries (`WHERE product_images.media_id = media.id`),
      // matching the SQLite version's shape exactly. That's wrong here in
      // a way `astro check`/`astro build` cannot catch and that silently
      // returned *plausible* data (every row showed the same non-zero
      // usage count and isPrimary: true) rather than erroring —
      // reverse-engineered via toSQL(): Drizzle only fully table-qualifies
      // every column reference throughout a query when its *outer* FROM
      // clause has two or more tables; with only `.from(media)` at the top
      // level, `${media.id}` inside these subqueries rendered as a bare
      // "id", which Postgres then resolved to product_images' *own* id
      // column (also present in that subquery's scope) instead of the
      // outer media row — an uncorrelated, self-referential subquery that
      // happened to produce one constant value applied to every row.
      // (ProductRepository.list()'s near-identical-looking subquery was
      // never affected by this, purely because its outer query already
      // joins `categories` for an unrelated reason — two tables in scope,
      // so Drizzle qualified everything correctly there by chance, not by
      // design. Not something to rely on for future queries.)
      //
      // Fixed by not using correlated subqueries here at all: LEFT JOIN +
      // GROUP BY has no nested scope to collide within, is unaffected by
      // the qualification behavior above regardless of table count, and is
      // one pass over the joined rows instead of two subqueries per row —
      // strictly better, not just a workaround.
      const rows = await getDb()
        .select({
          id: media.id,
          filename: media.filename,
          path: media.path,
          url: media.url,
          folder: media.folder,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          width: media.width,
          height: media.height,
          altText: media.altText,
          source: media.source,
          createdAt: media.createdAt,
          // Explicit ::int cast: Postgres's count() returns bigint, which
          // node-postgres hands back as a string (bigint doesn't fit
          // JS's number range in general, so pg doesn't assume it's safe
          // to coerce automatically) — verified live, not assumed, same
          // class of mismatch as SupabaseProductRepository.lastUpdatedAt()
          // hit in Phase 2B.1. Without this cast, MediaListItem.usageCount
          // (typed `number`) would silently hold "0"/"1" strings at runtime.
          usageCount: sql<number>`(count(distinct ${productImages.id}) + count(distinct ${categories.id}))::int`,
          isPrimary: sql<boolean>`bool_or(coalesce(${productImages.isPrimary}, false))`,
        })
        .from(media)
        .leftJoin(productImages, eq(productImages.mediaId, media.id))
        .leftJoin(categories, eq(categories.imageId, media.id))
        .where(conditions.length ? sql.join(conditions, sql` AND `) : undefined)
        .groupBy(media.id)
        .orderBy(desc(media.createdAt));

      return rows.map((row) => ({
        id: row.id,
        filename: row.filename,
        path: row.path,
        url: row.url,
        folder: row.folder,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        altText: row.altText,
        source: row.source,
        createdAt: row.createdAt.toISOString(),
        usageCount: row.usageCount,
        isPrimary: row.isPrimary,
      }));
    });
  },

  async findById(id: number): Promise<Media | null> {
    return withRepositoryCall("SupabaseMediaRepository.findById", async () => {
      const [row] = await getDb().select().from(media).where(eq(media.id, id));
      return row ? mapRow(row) : null;
    });
  },

  async count(): Promise<number> {
    return withRepositoryCall("SupabaseMediaRepository.count", async () => {
      const [row] = await getDb().select({ n: count() }).from(media);
      return row.n;
    });
  },

  /** Powers the Folders page's per-folder counts. */
  async countByFolder(): Promise<Record<MediaFolder, number>> {
    return withRepositoryCall("SupabaseMediaRepository.countByFolder", async () => {
      const rows = await getDb()
        .select({ folder: media.folder, n: count() })
        .from(media)
        .groupBy(media.folder);

      const counts = Object.fromEntries(MEDIA_FOLDER_VALUES.map((folder) => [folder, 0])) as Record<MediaFolder, number>;
      for (const row of rows) counts[row.folder] = row.n;
      return counts;
    });
  },

  async create(input: {
    filename: string;
    path: string | null;
    url: string;
    folder: MediaFolder;
    mimeType: string;
    sizeBytes: number;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
    source?: "upload" | "seed";
  }): Promise<Media> {
    return withRepositoryCall("SupabaseMediaRepository.create", async () => {
      const [row] = await getDb()
        .insert(media)
        .values({
          filename: input.filename,
          path: input.path,
          url: input.url,
          folder: input.folder,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          width: input.width ?? null,
          height: input.height ?? null,
          altText: input.altText ?? null,
          source: input.source ?? "upload",
          createdAt: new Date(),
        })
        .returning();
      return mapRow(row);
    });
  },

  async rename(id: number, filename: string): Promise<Media | null> {
    return withRepositoryCall("SupabaseMediaRepository.rename", async () => {
      const [row] = await getDb().update(media).set({ filename }).where(eq(media.id, id)).returning();
      return row ? mapRow(row) : null;
    });
  },

  async updateAltText(id: number, altText: string | null): Promise<Media | null> {
    return withRepositoryCall("SupabaseMediaRepository.updateAltText", async () => {
      const [row] = await getDb().update(media).set({ altText }).where(eq(media.id, id)).returning();
      return row ? mapRow(row) : null;
    });
  },

  /** Folder + physical path/url move together — StorageService.move already relocated the file before this runs. */
  async updateLocation(id: number, input: { folder: MediaFolder; path: string; url: string }): Promise<Media | null> {
    return withRepositoryCall("SupabaseMediaRepository.updateLocation", async () => {
      const [row] = await getDb()
        .update(media)
        .set({ folder: input.folder, path: input.path, url: input.url })
        .where(eq(media.id, id))
        .returning();
      return row ? mapRow(row) : null;
    });
  },

  async delete(id: number): Promise<void> {
    return withRepositoryCall("SupabaseMediaRepository.delete", async () => {
      await getDb().delete(media).where(eq(media.id, id));
    });
  },

  /** Used to block deletion in the UI when a product/category still references this file. */
  async isInUse(id: number): Promise<boolean> {
    return withRepositoryCall("SupabaseMediaRepository.isInUse", async () => {
      const db = getDb();
      const [usedByProduct] = await db.select({ x: sql`1` }).from(productImages).where(eq(productImages.mediaId, id)).limit(1);
      if (usedByProduct) return true;
      const [usedByCategory] = await db.select({ x: sql`1` }).from(categories).where(eq(categories.imageId, id)).limit(1);
      return Boolean(usedByCategory);
    });
  },

  /** Powers the detail panel's "Used By" list and the delete-guard message. */
  async getUsage(id: number): Promise<MediaUsage> {
    return withRepositoryCall("SupabaseMediaRepository.getUsage", async () => {
      const db = getDb();
      const [productRows, categoryRows] = await Promise.all([
        db
          .select({ id: products.id, name: products.name, slug: products.slug, isPrimary: productImages.isPrimary })
          .from(productImages)
          .innerJoin(products, eq(products.id, productImages.productId))
          .where(eq(productImages.mediaId, id))
          .orderBy(products.name),
        db
          .select({ id: categories.id, name: categories.name, slug: categories.slug })
          .from(categories)
          .where(eq(categories.imageId, id))
          .orderBy(categories.name),
      ]);

      return { products: productRows, categories: categoryRows };
    });
  },
};

// Matches MEDIA_FOLDERS in MediaRepository.ts exactly (kept as a private
// local list rather than importing that one, to avoid this file depending
// on the file that re-exports *this* implementation — see
// ProductRepository.ts's header for why that circularity is avoided by
// convention even though TS would tolerate it for type-only imports).
const MEDIA_FOLDER_VALUES: MediaFolder[] = [
  "products",
  "categories",
  "homepage",
  "hero",
  "occasions",
  "neighbourhoods",
  "studio",
  "temporary",
];
