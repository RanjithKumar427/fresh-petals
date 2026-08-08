// Drizzle schema — the Postgres/Supabase replacement for src/server/db/schema.sql.
//
// This is a faithful translation of the SQLite schema, not a redesign: same
// tables, same relationships, same constraints, same junction tables (no
// comma-separated strings, no JSON blobs for structured data — that rule
// carries over unchanged). Three deliberate idiomatic-Postgres upgrades,
// each internal to the storage layer and invisible to services/UI:
//
//   1. Native `boolean` columns instead of SQLite's INTEGER 0/1.
//   2. `timestamptz` columns instead of app-managed ISO TEXT.
//   3. Real `pgEnum` types instead of `CHECK (col IN (...))` — this also
//      structurally fixes the exact class of bug hit during the SQLite
//      build (CREATE TABLE IF NOT EXISTS never updates an existing table's
//      CHECK list; ALTER TYPE ... ADD VALUE on a real enum does).
//
// Media metadata was explicitly enriched per the migration brief — see the
// `media` table below — but media's *shape* (a platform resource that
// products/categories reference, never the other way around) was already
// correct in the SQLite design and is preserved exactly, not redesigned.
import { pgTable, pgEnum, serial, integer, text, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

export const productStatusEnum = pgEnum("product_status", ["draft", "published", "archived"]);
export const priceTypeEnum = pgEnum("price_type", ["fixed", "from", "market", "quote"]);
export const mediaFolderEnum = pgEnum("media_folder", [
  "products",
  "categories",
  "homepage",
  "hero",
  "occasions",
  "neighbourhoods",
  "studio",
  "temporary",
]);
export const mediaSourceEnum = pgEnum("media_source", ["upload", "seed"]);

// ---------------------------------------------------------------------
// Auth — single admin today; the shape already supports more without a
// redesign. Phase 5 (Supabase Auth) will reconcile identity against this
// table rather than replace it outright — see the phase report.
// ---------------------------------------------------------------------
export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    adminUserId: integer("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_sessions_admin_user_id").on(table.adminUserId)]
);

// ---------------------------------------------------------------------
// Media — a platform resource. Products/categories reference it via FK;
// it never references them. Metadata list matches the migration brief's
// minimum set exactly (bucket/path/mime/width/height/size/checksum/
// dominant color/blur hash/alt text/uploaded by/created at). checksum,
// dominant_color and blur_hash are nullable — populated by the Supabase
// Storage provider at upload time (Phase 4); existing seeded rows get
// backfilled where cheaply possible during the Phase 2 data migration,
// left null otherwise rather than blocking on it.
// ---------------------------------------------------------------------
export const media = pgTable(
  "media",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),
    bucket: text("bucket").notNull().default("media"),
    path: text("path").unique(), // null for seeded rows served from /images/** rather than Storage
    url: text("url").notNull(),
    folder: mediaFolderEnum("folder").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"), // sha-256 hex — enables real dedup ("never duplicate assets")
    dominantColor: text("dominant_color"), // e.g. "#7C243E"
    blurHash: text("blur_hash"),
    altText: text("alt_text"),
    uploadedBy: integer("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
    source: mediaSourceEnum("source").notNull().default("upload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_media_folder").on(table.folder), index("idx_media_checksum").on(table.checksum)]
);

// ---------------------------------------------------------------------
// Independent taxonomies
// ---------------------------------------------------------------------
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageId: integer("image_id").references(() => media.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Added in Phase 2B.2: SupabaseMediaRepository's isInUse()/getUsage()/
  // list() usage-count subquery all filter categories by image_id — a real
  // query pattern this phase introduced, not a speculative index.
  (table) => [index("idx_categories_image_id").on(table.imageId)]
);

export const occasions = pgTable("occasions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moods = pgTable("moods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flowerTypes = pgTable("flower_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),

    status: productStatusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    bestseller: boolean("bestseller").notNull().default(false),
    newArrival: boolean("new_arrival").notNull().default(false),

    priceType: priceTypeEnum("price_type").notNull().default("fixed"),
    sellingPrice: integer("selling_price"),
    compareAtPrice: integer("compare_at_price"),
    costPrice: integer("cost_price"), // internal only, never rendered storefront-side
    deliveryChargeOverride: integer("delivery_charge_override"),

    stemCount: text("stem_count"),
    colourTheme: text("colour_theme"),
    arrangementStyle: text("arrangement_style"),
    size: text("size"),
    requiresWhatsappConfirmation: boolean("requires_whatsapp_confirmation").notNull().default(true),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_products_category_id").on(table.categoryId),
    index("idx_products_status").on(table.status),
    index("idx_products_published_at").on(table.publishedAt),
  ]
);

// Forward-compatible: lets a future feature add variants (Small/Medium/
// Luxury...) without altering `products` at all. No UI yet.
export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    priceDelta: integer("price_delta").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_product_variants_product_id").on(table.productId)]
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaId: integer("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => [
    index("idx_product_images_product_id").on(table.productId),
    // Added in Phase 2B.2: SupabaseMediaRepository's isInUse()/getUsage()/
    // list() usage-count subquery all filter product_images by media_id —
    // every media list render and every delete-guard check hits this.
    index("idx_product_images_media_id").on(table.mediaId),
  ]
);

export const productOccasions = pgTable(
  "product_occasions",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    occasionId: integer("occasion_id")
      .notNull()
      .references(() => occasions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.occasionId] }),
    index("idx_product_occasions_occasion_id").on(table.occasionId),
  ]
);

export const productMoods = pgTable(
  "product_moods",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    moodId: integer("mood_id")
      .notNull()
      .references(() => moods.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.moodId] }),
    index("idx_product_moods_mood_id").on(table.moodId),
  ]
);

export const productFlowerTypes = pgTable(
  "product_flower_types",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    flowerTypeId: integer("flower_type_id")
      .notNull()
      .references(() => flowerTypes.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.flowerTypeId] }),
    index("idx_product_flower_types_flower_type_id").on(table.flowerTypeId),
  ]
);

export const productWhatsIncluded = pgTable(
  "product_whats_included",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("idx_product_whats_included_product_id").on(table.productId)]
);

export const productCareInstructions = pgTable(
  "product_care_instructions",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("idx_product_care_instructions_product_id").on(table.productId)]
);
