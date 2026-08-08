-- FreshPetals Admin — SQLite schema.
--
-- Applied automatically (idempotent, CREATE ... IF NOT EXISTS) the first
-- time the app touches the database — see client.ts. No manual migration
-- step required.
--
-- Conventions:
--   * booleans are stored as INTEGER 0/1 (SQLite has no native boolean)
--   * timestamps are ISO-8601 TEXT, written by the application layer
--   * every many-to-many relationship uses a junction table — no
--     comma-separated strings, no JSON blobs for structured data

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Media — every uploaded/registered file. Never stores binary data.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  path TEXT UNIQUE,              -- relative path under /uploads (NULL for seeded rows served from /images/**)
  url TEXT NOT NULL,             -- URL the storefront/admin actually renders
  folder TEXT NOT NULL CHECK (folder IN ('products', 'categories', 'hero', 'occasions')),
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'seed')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_folder ON media (folder);

-- ---------------------------------------------------------------------
-- Independent taxonomies
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_id INTEGER REFERENCES media (id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories (slug);

CREATE TABLE IF NOT EXISTS occasions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS flower_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Products — core catalog entity. One category (required), many
-- occasions/moods/flower types/images via junction tables below.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured INTEGER NOT NULL DEFAULT 0,
  bestseller INTEGER NOT NULL DEFAULT 0,
  new_arrival INTEGER NOT NULL DEFAULT 0,

  -- Pricing. sellingPrice/discountPrice are nullable because priceType
  -- 'market'/'quote' products (e.g. daily pooja flowers) have no fixed
  -- number today — that's real behaviour on the live site, not a gap.
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'from', 'market', 'quote')),
  selling_price INTEGER,
  discount_price INTEGER,
  cost_price INTEGER,          -- internal only, never rendered storefront-side

  stem_count TEXT,
  colour_theme TEXT,
  requires_whatsapp_confirmation INTEGER NOT NULL DEFAULT 1,

  seo_title TEXT,
  seo_description TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_published_at ON products (published_at);

-- Forward-compatible: lets a future feature add variants (Small/Medium/
-- Luxury...) without altering the products table at all. No UI in v1.
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

CREATE TABLE IF NOT EXISTS product_occasions (
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  occasion_id INTEGER NOT NULL REFERENCES occasions (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, occasion_id)
);

CREATE INDEX IF NOT EXISTS idx_product_occasions_occasion_id ON product_occasions (occasion_id);

CREATE TABLE IF NOT EXISTS product_moods (
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  mood_id INTEGER NOT NULL REFERENCES moods (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, mood_id)
);

CREATE INDEX IF NOT EXISTS idx_product_moods_mood_id ON product_moods (mood_id);

CREATE TABLE IF NOT EXISTS product_flower_types (
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  flower_type_id INTEGER NOT NULL REFERENCES flower_types (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, flower_type_id)
);

CREATE INDEX IF NOT EXISTS idx_product_flower_types_flower_type_id ON product_flower_types (flower_type_id);

CREATE TABLE IF NOT EXISTS product_whats_included (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_whats_included_product_id ON product_whats_included (product_id);

CREATE TABLE IF NOT EXISTS product_care_instructions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_product_care_instructions_product_id ON product_care_instructions (product_id);

-- ---------------------------------------------------------------------
-- Auth — v1 is intentionally minimal: one admin account, no roles, no
-- password reset flow. The table shape still supports adding more admin
-- users later without a redesign.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin_user_id ON sessions (admin_user_id);
