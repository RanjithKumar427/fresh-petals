import { getDb, nowIso, withTransaction } from "../client";

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
  discountPrice?: number | null;
  costPrice?: number | null;
  stemCount?: string | null;
  colourTheme?: string | null;
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
  discountPrice: number | null;
  status: ProductStatus;
  updatedAt: string;
};

export type ProductListFilter = {
  search?: string;
  categoryId?: number;
  status?: ProductStatus;
};

function mapCoreRow(row: any): ProductCoreInput & { id: number; createdAt: string; updatedAt: string; publishedAt: string | null } {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    categoryId: row.category_id,
    status: row.status,
    featured: Boolean(row.featured),
    bestseller: Boolean(row.bestseller),
    newArrival: Boolean(row.new_arrival),
    priceType: row.price_type,
    sellingPrice: row.selling_price,
    discountPrice: row.discount_price,
    costPrice: row.cost_price,
    stemCount: row.stem_count,
    colourTheme: row.colour_theme,
    requiresWhatsappConfirmation: Boolean(row.requires_whatsapp_confirmation),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function loadRelations(productId: number): {
  images: ProductImage[];
  occasionIds: number[];
  moodIds: number[];
  flowerTypeIds: number[];
  whatsIncluded: string[];
  careInstructions: string[];
} {
  const db = getDb();

  const images = (
    db
      .prepare(
        `SELECT pi.id, pi.media_id, pi.alt_text, pi.sort_order, pi.is_primary, m.url
         FROM product_images pi
         JOIN media m ON m.id = pi.media_id
         WHERE pi.product_id = ?
         ORDER BY pi.sort_order ASC`
      )
      .all(productId) as any[]
  ).map((row) => ({
    id: row.id,
    mediaId: row.media_id,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isPrimary: Boolean(row.is_primary),
    url: row.url,
  }));

  const occasionIds = (
    db.prepare("SELECT occasion_id FROM product_occasions WHERE product_id = ?").all(productId) as any[]
  ).map((r) => r.occasion_id);

  const moodIds = (
    db.prepare("SELECT mood_id FROM product_moods WHERE product_id = ?").all(productId) as any[]
  ).map((r) => r.mood_id);

  const flowerTypeIds = (
    db.prepare("SELECT flower_type_id FROM product_flower_types WHERE product_id = ?").all(productId) as any[]
  ).map((r) => r.flower_type_id);

  const whatsIncluded = (
    db
      .prepare("SELECT value FROM product_whats_included WHERE product_id = ? ORDER BY sort_order ASC")
      .all(productId) as any[]
  ).map((r) => r.value);

  const careInstructions = (
    db
      .prepare("SELECT value FROM product_care_instructions WHERE product_id = ? ORDER BY sort_order ASC")
      .all(productId) as any[]
  ).map((r) => r.value);

  return { images, occasionIds, moodIds, flowerTypeIds, whatsIncluded, careInstructions };
}

/** Replaces every junction/child row for a product — used by both create and update so they can't drift apart. */
function writeRelations(productId: number, relations: ProductRelations) {
  const db = getDb();

  db.prepare("DELETE FROM product_images WHERE product_id = ?").run(productId);
  const insertImage = db.prepare(
    "INSERT INTO product_images (product_id, media_id, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)"
  );
  for (const image of relations.images) {
    insertImage.run(productId, image.mediaId, image.altText ?? null, image.sortOrder, image.isPrimary ? 1 : 0);
  }

  db.prepare("DELETE FROM product_occasions WHERE product_id = ?").run(productId);
  const insertOccasion = db.prepare(
    "INSERT INTO product_occasions (product_id, occasion_id) VALUES (?, ?)"
  );
  for (const occasionId of relations.occasionIds) insertOccasion.run(productId, occasionId);

  db.prepare("DELETE FROM product_moods WHERE product_id = ?").run(productId);
  const insertMood = db.prepare("INSERT INTO product_moods (product_id, mood_id) VALUES (?, ?)");
  for (const moodId of relations.moodIds) insertMood.run(productId, moodId);

  db.prepare("DELETE FROM product_flower_types WHERE product_id = ?").run(productId);
  const insertFlowerType = db.prepare(
    "INSERT INTO product_flower_types (product_id, flower_type_id) VALUES (?, ?)"
  );
  for (const flowerTypeId of relations.flowerTypeIds) insertFlowerType.run(productId, flowerTypeId);

  db.prepare("DELETE FROM product_whats_included WHERE product_id = ?").run(productId);
  const insertIncluded = db.prepare(
    "INSERT INTO product_whats_included (product_id, value, sort_order) VALUES (?, ?, ?)"
  );
  relations.whatsIncluded.forEach((value, index) => insertIncluded.run(productId, value, index));

  db.prepare("DELETE FROM product_care_instructions WHERE product_id = ?").run(productId);
  const insertCare = db.prepare(
    "INSERT INTO product_care_instructions (product_id, value, sort_order) VALUES (?, ?, ?)"
  );
  relations.careInstructions.forEach((value, index) => insertCare.run(productId, value, index));
}

export const ProductRepository = {
  findById(id: number): Product | null {
    const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!row) return null;
    return { ...mapCoreRow(row), ...loadRelations(id) };
  },

  findBySlug(slug: string): Product | null {
    const row = getDb().prepare("SELECT * FROM products WHERE slug = ?").get(slug);
    if (!row) return null;
    return { ...mapCoreRow(row), ...loadRelations((row as any).id) };
  },

  list(filter?: ProductListFilter): ProductListItem[] {
    const clauses: string[] = [];
    const params: any[] = [];

    if (filter?.search) {
      clauses.push("(p.name LIKE ? OR p.slug LIKE ?)");
      params.push(`%${filter.search}%`, `%${filter.search}%`);
    }
    if (filter?.categoryId) {
      clauses.push("p.category_id = ?");
      params.push(filter.categoryId);
    }
    if (filter?.status) {
      clauses.push("p.status = ?");
      params.push(filter.status);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = getDb()
      .prepare(
        `SELECT
           p.id, p.slug, p.name, p.category_id, c.name AS category_name,
           p.price_type, p.selling_price, p.discount_price, p.status, p.updated_at,
           (SELECT m.url FROM product_images pi JOIN media m ON m.id = pi.media_id
              WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) AS primary_image_url
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ${where}
         ORDER BY p.updated_at DESC`
      )
      .all(...params) as any[];

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      primaryImageUrl: row.primary_image_url,
      priceType: row.price_type,
      sellingPrice: row.selling_price,
      discountPrice: row.discount_price,
      status: row.status,
      updatedAt: row.updated_at,
    }));
  },

  countAll(): number {
    const row = getDb().prepare("SELECT COUNT(*) AS n FROM products").get() as any;
    return row.n;
  },

  countByStatus(status: ProductStatus): number {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM products WHERE status = ?")
      .get(status) as any;
    return row.n;
  },

  lastUpdatedAt(): string | null {
    const row = getDb().prepare("SELECT MAX(updated_at) AS latest FROM products").get() as any;
    return row.latest ?? null;
  },

  create(core: ProductCoreInput, relations: ProductRelations): Product {
    return withTransaction((db) => {
      const timestamp = nowIso();
      const publishedAt = core.status === "published" ? timestamp : null;

      const result = db
        .prepare(
          `INSERT INTO products (
             slug, name, short_description, description, category_id, status,
             featured, bestseller, new_arrival, price_type, selling_price,
             discount_price, cost_price, stem_count, colour_theme,
             requires_whatsapp_confirmation, seo_title, seo_description,
             created_at, updated_at, published_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          core.slug,
          core.name,
          core.shortDescription ?? null,
          core.description ?? null,
          core.categoryId,
          core.status,
          core.featured ? 1 : 0,
          core.bestseller ? 1 : 0,
          core.newArrival ? 1 : 0,
          core.priceType,
          core.sellingPrice ?? null,
          core.discountPrice ?? null,
          core.costPrice ?? null,
          core.stemCount ?? null,
          core.colourTheme ?? null,
          core.requiresWhatsappConfirmation ? 1 : 0,
          core.seoTitle ?? null,
          core.seoDescription ?? null,
          timestamp,
          timestamp,
          publishedAt
        );

      const id = Number(result.lastInsertRowid);
      writeRelations(id, relations);

      return { ...mapCoreRow({ ...core, id, created_at: timestamp, updated_at: timestamp, published_at: publishedAt }), ...loadRelations(id) };
    });
  },

  update(id: number, core: ProductCoreInput, relations: ProductRelations): Product | null {
    return withTransaction((db) => {
      const existingRow = db.prepare("SELECT published_at, status FROM products WHERE id = ?").get(id) as any;
      if (!existingRow) return null;

      const timestamp = nowIso();
      // First transition into 'published' stamps published_at; later saves
      // (including unpublish/republish) don't overwrite that history.
      const publishedAt =
        core.status === "published" && !existingRow.published_at ? timestamp : existingRow.published_at;

      db.prepare(
        `UPDATE products SET
           slug = ?, name = ?, short_description = ?, description = ?, category_id = ?, status = ?,
           featured = ?, bestseller = ?, new_arrival = ?, price_type = ?, selling_price = ?,
           discount_price = ?, cost_price = ?, stem_count = ?, colour_theme = ?,
           requires_whatsapp_confirmation = ?, seo_title = ?, seo_description = ?,
           updated_at = ?, published_at = ?
         WHERE id = ?`
      ).run(
        core.slug,
        core.name,
        core.shortDescription ?? null,
        core.description ?? null,
        core.categoryId,
        core.status,
        core.featured ? 1 : 0,
        core.bestseller ? 1 : 0,
        core.newArrival ? 1 : 0,
        core.priceType,
        core.sellingPrice ?? null,
        core.discountPrice ?? null,
        core.costPrice ?? null,
        core.stemCount ?? null,
        core.colourTheme ?? null,
        core.requiresWhatsappConfirmation ? 1 : 0,
        core.seoTitle ?? null,
        core.seoDescription ?? null,
        timestamp,
        publishedAt,
        id
      );

      writeRelations(id, relations);

      const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
      return { ...mapCoreRow(row), ...loadRelations(id) };
    });
  },

  setStatus(id: number, status: ProductStatus): Product | null {
    return withTransaction((db) => {
      const existingRow = db.prepare("SELECT published_at FROM products WHERE id = ?").get(id) as any;
      if (!existingRow) return null;

      const timestamp = nowIso();
      const publishedAt = status === "published" && !existingRow.published_at ? timestamp : existingRow.published_at;

      db.prepare("UPDATE products SET status = ?, updated_at = ?, published_at = ? WHERE id = ?").run(
        status,
        timestamp,
        publishedAt,
        id
      );

      const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
      return { ...mapCoreRow(row), ...loadRelations(id) };
    });
  },

  delete(id: number): void {
    getDb().prepare("DELETE FROM products WHERE id = ?").run(id);
  },
};
