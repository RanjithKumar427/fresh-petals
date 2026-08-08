#!/usr/bin/env node
// One-time import of src/data/productCatalog.ts into SQLite. After this
// runs, SQLite is the canonical product source — productCatalog.ts is left
// on disk untouched as a frozen reference, but nothing reads it anymore
// once the storefront is rewired (see Step 3).
//
// Run with: npm run db:seed   (needs --experimental-strip-types so Node can
// import productCatalog.ts directly — that file has no relative imports of
// its own, so Node's stricter ESM resolver isn't an issue here, unlike the
// app's layered src/server/**.ts files).
//
// Re-running is safe: it aborts if products already exist unless --force is
// passed, in which case only the products table (and everything that
// cascades from it) is cleared before reseeding; categories/occasions/
// moods/flower_types are upserted by name either way.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DATA_DIR, DB_PATH } from "../src/server/db/paths.mjs";
import { productCatalog } from "../src/data/productCatalog.ts";

const FORCE = process.argv.includes("--force");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const OCCASION_LABEL_OVERRIDES = {
  "i-am-sorry": "I'm Sorry",
  "mom-to-be": "Mom-to-be",
  "get-well-soon": "Get Well Soon",
  "just-because": "Just Because",
};

function humanize(slug) {
  if (OCCASION_LABEL_OVERRIDES[slug]) return OCCASION_LABEL_OVERRIDES[slug];
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// The legacy `collectionTags` field mixed structural/category tags with
// genuine aesthetic descriptors. Only the tags below map cleanly onto the
// new independent Mood taxonomy (Romantic/Elegant/Minimal/Luxury/Cheerful);
// everything else in collectionTags (colour tags, "bulk-orders", "diy",
// category echoes like "bouquets"/"lilies", etc.) has no home in the new
// model and is intentionally dropped rather than force-fit somewhere.
// "bestselling-bouquets" isn't a mood at all — it sets the new `bestseller`
// flag on the product instead.
const MOOD_TAG_MAP = {
  romantic: "Romantic",
  "pastel-flowers": "Elegant",
  "premium-gifting": "Luxury",
  "premium-flowers": "Luxury",
  "premium-decor": "Luxury",
  "mini-bouquets": "Minimal",
};
const BASE_MOODS = ["Romantic", "Elegant", "Minimal", "Luxury", "Cheerful"];
const BESTSELLER_TAG = "bestselling-bouquets";

const MIME_BY_EXT = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png" };

function parsePriceNumber(priceLabel) {
  if (!priceLabel) return null;
  const match = priceLabel.replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
const schemaPath = fileURLToPath(new URL("../src/server/db/schema.sql", import.meta.url));
db.exec(fs.readFileSync(schemaPath, "utf-8"));

const existingCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (existingCount > 0 && !FORCE) {
  console.log(`Products table already has ${existingCount} rows. Re-run with --force to reseed.`);
  process.exit(0);
}
if (existingCount > 0 && FORCE) {
  db.exec("DELETE FROM products;"); // cascades to product_images/occasions/moods/flower_types/bullets
  console.log(`Cleared ${existingCount} existing products (--force).`);
}

const now = new Date().toISOString();

// --- categories -------------------------------------------------------
const categoryNames = [...new Set(productCatalog.map((p) => p.category))].sort();
const categoryIdByName = new Map();
categoryNames.forEach((name, index) => {
  const slug = slugify(name);
  const existing = db.prepare("SELECT id FROM categories WHERE slug = ?").get(slug);
  if (existing) {
    categoryIdByName.set(name, existing.id);
    return;
  }
  const result = db
    .prepare(
      "INSERT INTO categories (name, slug, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name, slug, null, index, now, now);
  categoryIdByName.set(name, Number(result.lastInsertRowid));
});

// --- occasions ----------------------------------------------------------
const occasionSlugs = new Set();
productCatalog.forEach((p) => (p.occasionTags || []).forEach((t) => occasionSlugs.add(t)));
const occasionIdBySlug = new Map();
for (const slug of occasionSlugs) {
  const existing = db.prepare("SELECT id FROM occasions WHERE slug = ?").get(slug);
  if (existing) {
    occasionIdBySlug.set(slug, existing.id);
    continue;
  }
  const result = db
    .prepare("INSERT INTO occasions (name, slug, created_at) VALUES (?, ?, ?)")
    .run(humanize(slug), slug, now);
  occasionIdBySlug.set(slug, Number(result.lastInsertRowid));
}

// --- moods ----------------------------------------------------------------
const moodIdByName = new Map();
for (const name of BASE_MOODS) {
  const slug = slugify(name);
  const existing = db.prepare("SELECT id FROM moods WHERE slug = ?").get(slug);
  if (existing) {
    moodIdByName.set(name, existing.id);
    continue;
  }
  const result = db
    .prepare("INSERT INTO moods (name, slug, created_at) VALUES (?, ?, ?)")
    .run(name, slug, now);
  moodIdByName.set(name, Number(result.lastInsertRowid));
}

// --- flower types -----------------------------------------------------
const flowerTypeNames = new Set();
productCatalog.forEach((p) => (p.flowerTypes || []).forEach((t) => flowerTypeNames.add(t)));
const flowerTypeIdByName = new Map();
for (const name of flowerTypeNames) {
  const slug = slugify(name);
  const existing = db.prepare("SELECT id FROM flower_types WHERE slug = ?").get(slug);
  if (existing) {
    flowerTypeIdByName.set(name, existing.id);
    continue;
  }
  const result = db
    .prepare("INSERT INTO flower_types (name, slug, created_at) VALUES (?, ?, ?)")
    .run(name, slug, now);
  flowerTypeIdByName.set(name, Number(result.lastInsertRowid));
}

// --- products -----------------------------------------------------------
const insertMedia = db.prepare(
  `INSERT INTO media (filename, path, url, folder, mime_type, size_bytes, alt_text, source, created_at)
   VALUES (?, NULL, ?, 'products', ?, ?, ?, 'seed', ?)`
);
const insertProduct = db.prepare(
  `INSERT INTO products (
     slug, name, short_description, description, category_id, status,
     featured, bestseller, new_arrival, price_type, selling_price,
     compare_at_price, cost_price, delivery_charge_override, stem_count,
     colour_theme, arrangement_style, size,
     requires_whatsapp_confirmation, seo_title, seo_description,
     created_at, updated_at, published_at
   ) VALUES (?, ?, ?, ?, ?, 'published', 0, ?, 0, ?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, NULL, NULL, ?, ?, ?)`
);
const insertProductImage = db.prepare(
  "INSERT INTO product_images (product_id, media_id, alt_text, sort_order, is_primary) VALUES (?, ?, ?, 0, 1)"
);
const insertProductOccasion = db.prepare(
  "INSERT INTO product_occasions (product_id, occasion_id) VALUES (?, ?)"
);
const insertProductMood = db.prepare("INSERT INTO product_moods (product_id, mood_id) VALUES (?, ?)");
const insertProductFlowerType = db.prepare(
  "INSERT INTO product_flower_types (product_id, flower_type_id) VALUES (?, ?)"
);
const insertWhatsIncluded = db.prepare(
  "INSERT INTO product_whats_included (product_id, value, sort_order) VALUES (?, ?, ?)"
);
const insertCareInstruction = db.prepare(
  "INSERT INTO product_care_instructions (product_id, value, sort_order) VALUES (?, ?, ?)"
);

let seededCount = 0;

db.exec("BEGIN");
try {
  for (const product of productCatalog) {
    if (db.prepare("SELECT 1 FROM products WHERE slug = ?").get(product.slug)) {
      continue; // already seeded this one (re-run without --force after a partial run)
    }

    const categoryId = categoryIdByName.get(product.category);
    const ext = (product.image.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
    const mediaResult = insertMedia.run(
      product.image.split("/").pop(),
      product.image,
      MIME_BY_EXT[ext] || "image/jpeg",
      0,
      product.name,
      now
    );
    const mediaId = Number(mediaResult.lastInsertRowid);

    const sellingPrice = product.priceType === "from" ? parsePriceNumber(product.priceLabel) : null;
    const isBestseller = (product.collectionTags || []).includes(BESTSELLER_TAG) ? 1 : 0;

    const productResult = insertProduct.run(
      product.slug,
      product.name,
      product.description ?? null,
      product.longDescription ?? null,
      categoryId,
      isBestseller,
      product.priceType,
      sellingPrice,
      product.stemCount ?? null,
      product.requiresConfirmation === false ? 0 : 1,
      now,
      now,
      now
    );
    const productId = Number(productResult.lastInsertRowid);

    insertProductImage.run(productId, mediaId, product.name);

    for (const tag of product.occasionTags || []) {
      const occasionId = occasionIdBySlug.get(tag);
      if (occasionId) insertProductOccasion.run(productId, occasionId);
    }

    const moodNamesForProduct = new Set(
      (product.collectionTags || [])
        .map((tag) => MOOD_TAG_MAP[tag])
        .filter(Boolean)
    );
    for (const moodName of moodNamesForProduct) {
      insertProductMood.run(productId, moodIdByName.get(moodName));
    }

    for (const flowerType of product.flowerTypes || []) {
      const flowerTypeId = flowerTypeIdByName.get(flowerType);
      if (flowerTypeId) insertProductFlowerType.run(productId, flowerTypeId);
    }

    (product.whatsIncluded || []).forEach((value, index) => insertWhatsIncluded.run(productId, value, index));
    (product.careNotes || []).forEach((value, index) => insertCareInstruction.run(productId, value, index));

    seededCount += 1;
  }

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

console.log(
  `Seeded ${seededCount} products, ${categoryIdByName.size} categories, ${occasionIdBySlug.size} occasions, ${moodIdByName.size} moods, ${flowerTypeIdByName.size} flower types.`
);

db.close();
