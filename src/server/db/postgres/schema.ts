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
import { pgTable, pgEnum, serial, integer, text, boolean, timestamp, primaryKey, index, uuid } from "drizzle-orm/pg-core";

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
// Auth — as of Phase 2B.3, Supabase Auth (its own managed `auth.users`
// table, not modeled here) is the sole source of truth for credentials.
// `admin_users` is now a profile/role record keyed 1:1 by `auth.users.id`
// — the standard Supabase pattern (a "profile" table whose PK IS the auth
// user's UUID, rather than a separate FK'd id) — not a second identity
// store. No password hash lives in this codebase anymore.
//
// `role` is a plain, unconstrained `text` column (not a pgEnum) on
// purpose: the roadmap names several future identities (Customer,
// Florist, Marketplace Seller, Corporate User) that don't exist as real
// systems yet. An enum would need an `ALTER TYPE ... ADD VALUE` migration
// every time one of those gets built; a text column accepts a new role
// string with zero schema change. Every current query filters/assumes
// role = 'admin' explicitly rather than assuming this table only ever
// holds admins — the seam is here, not the redesign.
//
// `sessions` (the old opaque-token table) is retired, not migrated —
// Supabase Auth's own JWT/refresh-token pair, held in an httpOnly cookie
// via @supabase/ssr, replaces its exact function. Two session mechanisms
// coexisting was never the goal; see the Phase 2B.3 report for why this
// table is dropped outright rather than deprecated-and-ignored.
// ---------------------------------------------------------------------
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey(), // matches auth.users.id exactly — not an independent identity
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

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
    uploadedBy: uuid("uploaded_by").references(() => adminUsers.id, { onDelete: "set null" }),
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

// ---------------------------------------------------------------------
// Inquiries — Commerce Foundation Phase 3, Milestone 5. This is
// deliberately NOT an Order table: there is no line-item relation to
// products, no price/payment fields, no customer identity FK. It's a
// lightweight admin inbox recording that a WhatsApp order request was
// sent, so the storefront's "send it and let a human take over on
// WhatsApp" model (see the phase's Architecture Constitution) has a
// record an admin can triage without reading WhatsApp itself.
//
// `products` is a plain text snapshot (e.g. "Red Rose Bouquet x1, ...")
// taken at submission time, not a relation to the `products` table —
// the ordered items may include add-ons/config that live only in the
// cart at that moment, and a later product edit or deletion must never
// change what an already-sent inquiry says was ordered. `deliveryDate`
// is likewise plain text, not a `date` column: it's a display-only
// field here, and the product-page order flow doesn't always collect
// one, so a loosely-typed nullable string avoids force-fitting a
// sometimes-absent value into a stricter type for no behavior this
// milestone needs.
export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "contacted",
  "confirmed",
  "completed",
  "cancelled",
]);

export const inquiries = pgTable(
  "inquiries",
  {
    id: serial("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    products: text("products").notNull(),
    deliveryDate: text("delivery_date"),
    status: inquiryStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_inquiries_status").on(table.status), index("idx_inquiries_created_at").on(table.createdAt)]
);
