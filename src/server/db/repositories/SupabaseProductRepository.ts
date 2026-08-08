// Postgres/Drizzle implementation of the ProductRepository contract — see
// ProductRepository.ts for the stable public export every service/API
// route actually imports, and for why this file exists as a separate,
// swappable implementation rather than being inlined there.
//
// Faithful port of the SQLite implementation's behavior, not a redesign:
// same methods, same "delete-then-reinsert" strategy for child rows, same
// publish-date-sticks-on-first-transition rule. Two genuine improvements
// fell out of the Postgres/Drizzle move rather than being bolted on:
//   - create()/update()/setStatus() use `RETURNING *` instead of an
//     insert-or-update followed by a separate SELECT — one fewer round
//     trip per call than the SQLite version needed.
//   - update()/setStatus() compute the "did this just become published"
//     published_at logic in a single atomic UPDATE (a SQL CASE expression
//     referencing the row's own current value) instead of a SELECT to read
//     prior state followed by an UPDATE — one fewer round trip, and no
//     window where a concurrent request could see stale state between the
//     two (moot here since both statements already ran inside one
//     transaction either way, but one round trip instead of two is a real
//     win at 100 concurrent admins).
//
// Sync -> async is the one place this can't be "invisible": node:sqlite is
// synchronous, pg/Drizzle is not. Every method here returns a Promise where
// its SQLite predecessor returned a value directly — an unavoidable
// consequence of the datastore swap, not a design choice. ProductService
// (and everything above it) was updated to `await` accordingly; nothing
// about *what* each method takes or returns changed, only that getting the
// answer now takes a round trip instead of a synchronous embedded-DB read.
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb, withTransaction } from "../postgres/client";
import * as schema from "../postgres/schema";
import {
  products,
  categories,
  media,
  productImages,
  productOccasions,
  productMoods,
  productFlowerTypes,
  productWhatsIncluded,
  productCareInstructions,
} from "../postgres/schema";

type Tx = NodePgDatabase<typeof schema>;
import { translatePgError } from "../postgres/pgErrors";

// Every method below goes through this — including reads. Writes had this
// from the start (constraint violations are the obvious case), but a live
// run during this phase's own browser verification hit a transient DNS
// failure resolving the pooler host (getaddrinfo ENOTFOUND) on a plain
// read (`countByStatus`, via the dashboard) — proof "Postgres is
// unavailable" isn't just a hypothetical to wrap the write paths against.
// Centralizing here (rather than a try/catch duplicated in every method)
// also means every repository this pattern gets copied to in later phases
// starts consistent instead of write-only by accident.
async function withErrorTranslation<T>(context: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[${context}]`, error);
    throw translatePgError(error);
  }
}
import type {
  Product,
  ProductCoreInput,
  ProductRelations,
  ProductListFilter,
  ProductListItem,
  ProductStatus,
  ProductImage,
} from "./ProductRepository";

type CoreRow = typeof products.$inferSelect;

function mapCoreRow(row: CoreRow): ProductCoreInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
} {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    description: row.description,
    categoryId: row.categoryId,
    status: row.status,
    featured: row.featured,
    bestseller: row.bestseller,
    newArrival: row.newArrival,
    priceType: row.priceType,
    sellingPrice: row.sellingPrice,
    compareAtPrice: row.compareAtPrice,
    costPrice: row.costPrice,
    deliveryChargeOverride: row.deliveryChargeOverride,
    stemCount: row.stemCount,
    colourTheme: row.colourTheme,
    arrangementStyle: row.arrangementStyle,
    size: row.size,
    requiresWhatsappConfirmation: row.requiresWhatsappConfirmation,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

// Takes an explicit db/tx handle rather than calling getDb() itself — this
// matters, not just stylistically. create()/update()/setStatus() call this
// *inside* their own transaction, immediately after writeRelations() writes
// the very rows this function reads back. Postgres's default READ
// COMMITTED isolation means a query on a *different* pooled connection
// can't see another transaction's uncommitted writes — if this called
// getDb() internally instead of using the caller's `tx`, it could hand back
// a Product whose `images`/`occasionIds`/etc. reflect the *pre-write* state
// (a different connection checked out from the same pool, racing the still-
// open transaction), even though the actual committed database ends up
// correct. Passing `tx` through means this reads on the same connection
// that did the write, seeing its own uncommitted changes as normal.
//
// The six child-table reads run concurrently (Promise.all) rather than
// sequentially — still six round trips (Drizzle/pg doesn't support a
// single multi-result-set query the way a stored procedure could), but
// issued at once instead of one-after-another. The SQLite version couldn't
// do this at all (a single synchronous connection has no concept of
// "concurrent" queries); this is a genuine win from moving to a real
// client/server database, not something ported over unchanged.
async function loadRelations(db: Tx | ReturnType<typeof getDb>, productId: number) {
  const [imageRows, occasionRows, moodRows, flowerTypeRows, includedRows, careRows] = await Promise.all([
    db
      .select({
        id: productImages.id,
        mediaId: productImages.mediaId,
        altText: productImages.altText,
        sortOrder: productImages.sortOrder,
        isPrimary: productImages.isPrimary,
        url: media.url,
      })
      .from(productImages)
      .innerJoin(media, eq(media.id, productImages.mediaId))
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder),
    db.select({ occasionId: productOccasions.occasionId }).from(productOccasions).where(eq(productOccasions.productId, productId)),
    db.select({ moodId: productMoods.moodId }).from(productMoods).where(eq(productMoods.productId, productId)),
    db
      .select({ flowerTypeId: productFlowerTypes.flowerTypeId })
      .from(productFlowerTypes)
      .where(eq(productFlowerTypes.productId, productId)),
    db
      .select({ value: productWhatsIncluded.value })
      .from(productWhatsIncluded)
      .where(eq(productWhatsIncluded.productId, productId))
      .orderBy(productWhatsIncluded.sortOrder),
    db
      .select({ value: productCareInstructions.value })
      .from(productCareInstructions)
      .where(eq(productCareInstructions.productId, productId))
      .orderBy(productCareInstructions.sortOrder),
  ]);

  const images: ProductImage[] = imageRows.map((row) => ({
    id: row.id,
    mediaId: row.mediaId,
    altText: row.altText,
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
    url: row.url,
  }));

  return {
    images,
    occasionIds: occasionRows.map((r) => r.occasionId),
    moodIds: moodRows.map((r) => r.moodId),
    flowerTypeIds: flowerTypeRows.map((r) => r.flowerTypeId),
    whatsIncluded: includedRows.map((r) => r.value),
    careInstructions: careRows.map((r) => r.value),
  };
}

/** Replaces every junction/child row for a product — used by both create and update so they can't drift apart. Must run inside the caller's transaction. */
async function writeRelations(tx: Tx, productId: number, relations: ProductRelations) {
  await tx.delete(productImages).where(eq(productImages.productId, productId));
  if (relations.images.length > 0) {
    await tx.insert(productImages).values(
      relations.images.map((image) => ({
        productId,
        mediaId: image.mediaId,
        altText: image.altText ?? null,
        sortOrder: image.sortOrder,
        isPrimary: image.isPrimary,
      }))
    );
  }

  await tx.delete(productOccasions).where(eq(productOccasions.productId, productId));
  if (relations.occasionIds.length > 0) {
    await tx.insert(productOccasions).values(relations.occasionIds.map((occasionId) => ({ productId, occasionId })));
  }

  await tx.delete(productMoods).where(eq(productMoods.productId, productId));
  if (relations.moodIds.length > 0) {
    await tx.insert(productMoods).values(relations.moodIds.map((moodId) => ({ productId, moodId })));
  }

  await tx.delete(productFlowerTypes).where(eq(productFlowerTypes.productId, productId));
  if (relations.flowerTypeIds.length > 0) {
    await tx
      .insert(productFlowerTypes)
      .values(relations.flowerTypeIds.map((flowerTypeId) => ({ productId, flowerTypeId })));
  }

  await tx.delete(productWhatsIncluded).where(eq(productWhatsIncluded.productId, productId));
  if (relations.whatsIncluded.length > 0) {
    await tx
      .insert(productWhatsIncluded)
      .values(relations.whatsIncluded.map((value, index) => ({ productId, value, sortOrder: index })));
  }

  await tx.delete(productCareInstructions).where(eq(productCareInstructions.productId, productId));
  if (relations.careInstructions.length > 0) {
    await tx
      .insert(productCareInstructions)
      .values(relations.careInstructions.map((value, index) => ({ productId, value, sortOrder: index })));
  }
}

function coreToRow(core: ProductCoreInput) {
  return {
    slug: core.slug,
    name: core.name,
    shortDescription: core.shortDescription ?? null,
    description: core.description ?? null,
    categoryId: core.categoryId,
    status: core.status,
    featured: core.featured,
    bestseller: core.bestseller,
    newArrival: core.newArrival,
    priceType: core.priceType,
    sellingPrice: core.sellingPrice ?? null,
    compareAtPrice: core.compareAtPrice ?? null,
    costPrice: core.costPrice ?? null,
    deliveryChargeOverride: core.deliveryChargeOverride ?? null,
    stemCount: core.stemCount ?? null,
    colourTheme: core.colourTheme ?? null,
    arrangementStyle: core.arrangementStyle ?? null,
    size: core.size ?? null,
    requiresWhatsappConfirmation: core.requiresWhatsappConfirmation,
    seoTitle: core.seoTitle ?? null,
    seoDescription: core.seoDescription ?? null,
  };
}

export const SupabaseProductRepository = {
  async findById(id: number): Promise<Product | null> {
    return withErrorTranslation("SupabaseProductRepository.findById", async () => {
      const db = getDb();
      const [row] = await db.select().from(products).where(eq(products.id, id));
      if (!row) return null;
      return { ...mapCoreRow(row), ...(await loadRelations(db, id)) };
    });
  },

  async findBySlug(slug: string): Promise<Product | null> {
    return withErrorTranslation("SupabaseProductRepository.findBySlug", async () => {
      const db = getDb();
      const [row] = await db.select().from(products).where(eq(products.slug, slug));
      if (!row) return null;
      return { ...mapCoreRow(row), ...(await loadRelations(db, row.id)) };
    });
  },

  async list(filter?: ProductListFilter): Promise<ProductListItem[]> {
    return withErrorTranslation("SupabaseProductRepository.list", async () => {
      const conditions = [];
      if (filter?.search) {
        // ILIKE, not LIKE: case-insensitive by default in Postgres, unlike
        // SQLite's LIKE (which was already case-insensitive for ASCII but
        // for the wrong reason — SQLite's default collation, not an
        // explicit choice). Same user-visible behavior, more correct
        // reasoning.
        conditions.push(sql`(${products.name} ILIKE ${`%${filter.search}%`} OR ${products.slug} ILIKE ${`%${filter.search}%`})`);
      }
      if (filter?.categoryId) conditions.push(eq(products.categoryId, filter.categoryId));
      if (filter?.status) conditions.push(eq(products.status, filter.status));
      if (filter?.featured) conditions.push(eq(products.featured, true));

      const primaryImageUrl = sql<string | null>`(
        SELECT ${media.url} FROM ${productImages}
        JOIN ${media} ON ${media.id} = ${productImages.mediaId}
        WHERE ${productImages.productId} = ${products.id}
        ORDER BY ${productImages.isPrimary} DESC, ${productImages.sortOrder} ASC
        LIMIT 1
      )`.as("primary_image_url");

      const rows = await getDb()
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          categoryId: products.categoryId,
          categoryName: categories.name,
          priceType: products.priceType,
          sellingPrice: products.sellingPrice,
          compareAtPrice: products.compareAtPrice,
          status: products.status,
          featured: products.featured,
          bestseller: products.bestseller,
          updatedAt: products.updatedAt,
          primaryImageUrl,
        })
        .from(products)
        .innerJoin(categories, eq(categories.id, products.categoryId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(products.updatedAt));

      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        primaryImageUrl: row.primaryImageUrl,
        priceType: row.priceType,
        sellingPrice: row.sellingPrice,
        compareAtPrice: row.compareAtPrice,
        featured: row.featured,
        bestseller: row.bestseller,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  },

  async countAll(): Promise<number> {
    return withErrorTranslation("SupabaseProductRepository.countAll", async () => {
      const [row] = await getDb().select({ n: count() }).from(products);
      return row.n;
    });
  },

  async countByStatus(status: ProductStatus): Promise<number> {
    return withErrorTranslation("SupabaseProductRepository.countByStatus", async () => {
      const [row] = await getDb().select({ n: count() }).from(products).where(eq(products.status, status));
      return row.n;
    });
  },

  async lastUpdatedAt(): Promise<string | null> {
    return withErrorTranslation("SupabaseProductRepository.lastUpdatedAt", async () => {
      // Verified against a real run, not assumed: a bare max(timestamptz)
      // aggregate selected via Drizzle's raw `sql` tag (no other real
      // column in the select) comes back as a plain string, not a Date —
      // unlike a normal typed column select (e.g. mapCoreRow's
      // row.updatedAt), which does get parsed into a Date. An earlier
      // version of this method assumed Date and crashed on
      // `.toISOString is not a function` the first time this actually ran
      // against Postgres. Handled for both shapes now rather than
      // re-guessing which one is "correct" — whichever driver/Drizzle-
      // version behavior applies, this normalizes it.
      const [row] = await getDb().select({ latest: sql<string | Date | null>`max(${products.updatedAt})` }).from(products);
      if (!row.latest) return null;
      return row.latest instanceof Date ? row.latest.toISOString() : new Date(row.latest).toISOString();
    });
  },

  async create(core: ProductCoreInput, relations: ProductRelations): Promise<Product> {
    return withErrorTranslation("SupabaseProductRepository.create", () =>
      withTransaction(async (tx) => {
        const now = new Date();
        const publishedAt = core.status === "published" ? now : null;

        const [row] = await tx
          .insert(products)
          .values({ ...coreToRow(core), createdAt: now, updatedAt: now, publishedAt })
          .returning();

        await writeRelations(tx, row.id, relations);
        return { ...mapCoreRow(row), ...(await loadRelations(tx, row.id)) };
      })
    );
  },

  async update(id: number, core: ProductCoreInput, relations: ProductRelations): Promise<Product | null> {
    return withErrorTranslation("SupabaseProductRepository.update", () =>
      withTransaction(async (tx) => {
        const now = new Date();
        const newStatus = core.status;

        // Single atomic UPDATE instead of SELECT-then-UPDATE: published_at
        // is set to now() only the first time a row transitions into
        // 'published' (i.e. its published_at is still null), referencing
        // the table's own current value via a CASE expression rather than
        // reading it in a separate round trip first. See file header.
        const [row] = await tx
          .update(products)
          .set({
            ...coreToRow(core),
            updatedAt: now,
            publishedAt: sql`CASE WHEN ${products.publishedAt} IS NULL AND ${newStatus} = 'published' THEN ${now} ELSE ${products.publishedAt} END`,
          })
          .where(eq(products.id, id))
          .returning();

        if (!row) return null;

        await writeRelations(tx, id, relations);
        return { ...mapCoreRow(row), ...(await loadRelations(tx, id)) };
      })
    );
  },

  async setStatus(id: number, status: ProductStatus): Promise<Product | null> {
    return withErrorTranslation("SupabaseProductRepository.setStatus", () =>
      withTransaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .update(products)
          .set({
            status,
            updatedAt: now,
            publishedAt: sql`CASE WHEN ${products.publishedAt} IS NULL AND ${status} = 'published' THEN ${now} ELSE ${products.publishedAt} END`,
          })
          .where(eq(products.id, id))
          .returning();

        if (!row) return null;
        return { ...mapCoreRow(row), ...(await loadRelations(tx, id)) };
      })
    );
  },

  async delete(id: number): Promise<void> {
    return withErrorTranslation("SupabaseProductRepository.delete", async () => {
      await getDb().delete(products).where(eq(products.id, id));
    });
  },
};
