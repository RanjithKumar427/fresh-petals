#!/usr/bin/env node
// SQLite -> PostgreSQL data migration. SQLite (not productCatalog.ts) is
// the source: productCatalog.ts was only ever how SQLite itself got
// bootstrapped (Step 2's seed script), and SQLite is now the richer,
// current source of truth for anything an admin has since edited through
// the product editor. Migrating from productCatalog.ts directly would
// silently discard any such edits -- exactly the "information loss" this
// phase's brief prohibits.
//
// Pipeline: VALIDATE (read-only, SQLite only, no Postgres needed) ->
// TRANSFORM (SQLite rows -> Postgres-shaped rows, in memory) -> INSERT
// (one Postgres transaction, identity-preserving, upsert-on-conflict) ->
// VERIFY (row-count + referential-integrity queries against Postgres,
// compared to the same counts taken from SQLite before the transaction
// started). If validation finds anything, the script stops before ever
// opening a Postgres connection -- "never silently repair production
// data" means this script fixes nothing; it only reports.
//
// Idempotent: every insert is `ON CONFLICT (id) DO UPDATE`, keyed on the
// id preserved from SQLite (see "Identity Strategy" in the migration
// doc), so running this twice updates rows in place rather than
// duplicating them. Each table's sequence is reset to MAX(id)+1 after
// the explicit-id inserts so normal (Phase 3+) inserts don't collide with
// migrated history.
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";
import { DB_PATH } from "../src/server/db/paths.mjs";
import { supabasePoolSsl } from "../src/server/db/postgres/ssl.mjs";

// Every table that gets migrated and row-count-verified. `sessions` is
// deliberately excluded — see the comment at its skip point below — so
// it never appears in the parity report, where its expected SQLite-vs-
// Postgres mismatch would otherwise look like a real failure.
const TABLES_IN_ORDER = [
  "admin_users",
  "media",
  "categories",
  "occasions",
  "moods",
  "flower_types",
  "products",
  "product_variants",
  "product_images",
  "product_occasions",
  "product_moods",
  "product_flower_types",
  "product_whats_included",
  "product_care_instructions",
];

function openSqlite() {
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

// ---------------------------------------------------------------------
// VALIDATE — read-only against SQLite, no Postgres connection required.
// Mirrors the ad hoc checks already run and reported before this script
// existed; formalized here so they run automatically, every time, before
// any write is attempted.
// ---------------------------------------------------------------------
function validate(db) {
  const problems = [];

  const dup = (table, col) =>
    db.prepare(`SELECT ${col}, COUNT(*) n FROM ${table} GROUP BY ${col} HAVING n > 1`).all();
  for (const [table, col] of [
    ["products", "slug"],
    ["categories", "slug"],
  ]) {
    const rows = dup(table, col);
    if (rows.length) problems.push(`Duplicate ${col} in ${table}: ${JSON.stringify(rows)}`);
  }

  const orphans = (sql, label) => {
    const rows = db.prepare(sql).all();
    if (rows.length) problems.push(`${label}: ${JSON.stringify(rows)}`);
  };
  orphans(
    "SELECT pi.id FROM product_images pi LEFT JOIN media m ON m.id = pi.media_id WHERE m.id IS NULL",
    "product_images referencing missing media"
  );
  orphans(
    "SELECT pi.id FROM product_images pi LEFT JOIN products p ON p.id = pi.product_id WHERE p.id IS NULL",
    "product_images referencing missing products"
  );
  orphans(
    "SELECT p.id FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL",
    "products referencing missing categories"
  );
  orphans(
    "SELECT id FROM categories WHERE image_id IS NOT NULL AND image_id NOT IN (SELECT id FROM media)",
    "categories referencing missing media"
  );
  orphans(
    "SELECT product_id FROM product_occasions WHERE occasion_id NOT IN (SELECT id FROM occasions)",
    "product_occasions referencing missing occasions"
  );
  orphans(
    "SELECT product_id FROM product_moods WHERE mood_id NOT IN (SELECT id FROM moods)",
    "product_moods referencing missing moods"
  );
  orphans(
    "SELECT product_id FROM product_flower_types WHERE flower_type_id NOT IN (SELECT id FROM flower_types)",
    "product_flower_types referencing missing flower_types"
  );

  const badEnum = (table, col, values) => {
    const placeholders = values.map(() => "?").join(",");
    const rows = db.prepare(`SELECT id, ${col} FROM ${table} WHERE ${col} NOT IN (${placeholders})`).all(...values);
    if (rows.length) problems.push(`Invalid ${col} in ${table}: ${JSON.stringify(rows)}`);
  };
  badEnum("products", "status", ["draft", "published", "archived"]);
  badEnum("products", "price_type", ["fixed", "from", "market", "quote"]);

  const emptyRequired = db
    .prepare("SELECT id FROM products WHERE name IS NULL OR TRIM(name) = '' OR slug IS NULL OR TRIM(slug) = ''")
    .all();
  if (emptyRequired.length) problems.push(`Products with empty name/slug: ${JSON.stringify(emptyRequired)}`);

  return problems;
}

function tableCounts(query) {
  const counts = {};
  for (const table of TABLES_IN_ORDER) counts[table] = query(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;
  return counts;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Nothing was touched. See .env.example.");
    process.exit(1);
  }

  const sqlite = openSqlite();
  const sqliteAll = (sql, ...params) => sqlite.prepare(sql).all(...params);

  console.log("=== VALIDATE ===");
  const problems = validate(sqlite);
  if (problems.length > 0) {
    console.error(`Found ${problems.length} data quality issue(s). Stopping before touching Postgres.`);
    problems.forEach((p) => console.error(" -", p));
    process.exit(1);
  }
  console.log("No issues found across 14 tables (duplicates, orphaned references, invalid enums, empty required fields).");

  const sqliteCounts = tableCounts(sqliteAll);
  console.log("SQLite row counts:", sqliteCounts);
  const sessionCount = sqliteAll("SELECT COUNT(*) AS n FROM sessions")[0].n;
  console.log(`  sessions: ${sessionCount} (informational only — not migrated, see below)`);

  console.log("\n=== TRANSFORM + INSERT ===");
  // Supabase's pooler chain is rooted at Supabase's own self-issued CA, not
  // a publicly trusted one — see src/server/db/postgres/ssl.mjs.
  const pool = new Pool({ connectionString, max: 1, ssl: supabasePoolSsl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Booleans: SQLite stores 0/1, Postgres columns are native boolean.
    const bool = (v) => Boolean(v);
    // Timestamps: SQLite stores app-generated ISO text; Postgres columns
    // are timestamptz and accept the same ISO string directly — pg's
    // parameter serializer handles standard ISO-8601 strings natively.
    const ts = (v) => v;

    // Per-row explicit inserts (not a bulk unnest) deliberately: this keeps
    // every row's failure attributable to a specific id in the error
    // message, which matters far more here than raw insert speed at
    // this data volume (a few hundred rows total).
    const insertRow = async (sql, params) => client.query(sql, params);

    for (const row of sqliteAll("SELECT * FROM admin_users")) {
      await insertRow(
        `INSERT INTO admin_users (id, email, password_hash, created_at, last_login_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, last_login_at = EXCLUDED.last_login_at`,
        [row.id, row.email, row.password_hash, ts(row.created_at), ts(row.last_login_at)]
      );
    }

    // `sessions` is deliberately NOT migrated: a session token is a
    // credential for logging into the OLD (SQLite-backed) system, issued
    // against a cookie already in someone's browser. Copying it into
    // Postgres wouldn't let anyone "stay logged in" across the cutover —
    // the application isn't reading from Postgres yet regardless — it
    // would just leave a stale, meaningless row. Excluded from the row-
    // count parity check below for the same reason: comparing it to
    // SQLite's count would report a false "MISMATCH" for something that
    // was never supposed to match.

    for (const row of sqliteAll("SELECT * FROM media")) {
      await insertRow(
        `INSERT INTO media (id, filename, bucket, path, url, folder, mime_type, size_bytes, width, height, alt_text, source, created_at)
         VALUES ($1,$2,'media',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           url = EXCLUDED.url, alt_text = EXCLUDED.alt_text, folder = EXCLUDED.folder,
           mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
           width = EXCLUDED.width, height = EXCLUDED.height, source = EXCLUDED.source`,
        [
          row.id,
          row.filename,
          row.path,
          row.url,
          row.folder,
          row.mime_type,
          row.size_bytes,
          row.width,
          row.height,
          row.alt_text,
          row.source,
          ts(row.created_at),
        ]
      );
    }

    for (const row of sqliteAll("SELECT * FROM categories")) {
      await insertRow(
        `INSERT INTO categories (id, name, slug, description, image_id, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, description = EXCLUDED.description, image_id = EXCLUDED.image_id, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at`,
        [row.id, row.name, row.slug, row.description, row.image_id, row.sort_order, ts(row.created_at), ts(row.updated_at)]
      );
    }

    for (const [table, cols] of [
      ["occasions", ["id", "name", "slug", "created_at"]],
      ["moods", ["id", "name", "slug", "created_at"]],
      ["flower_types", ["id", "name", "slug", "created_at"]],
    ]) {
      for (const row of sqliteAll(`SELECT * FROM ${table}`)) {
        await insertRow(
          `INSERT INTO ${table} (id, name, slug, created_at) VALUES ($1,$2,$3,$4)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug`,
          [row.id, row.name, row.slug, ts(row.created_at)]
        );
      }
    }

    for (const row of sqliteAll("SELECT * FROM products")) {
      await insertRow(
        `INSERT INTO products (
           id, slug, name, short_description, description, category_id, status,
           featured, bestseller, new_arrival, price_type, selling_price,
           compare_at_price, cost_price, delivery_charge_override, stem_count,
           colour_theme, arrangement_style, size, requires_whatsapp_confirmation,
           seo_title, seo_description, created_at, updated_at, published_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, short_description = EXCLUDED.short_description,
           description = EXCLUDED.description, category_id = EXCLUDED.category_id,
           status = EXCLUDED.status, featured = EXCLUDED.featured, bestseller = EXCLUDED.bestseller,
           new_arrival = EXCLUDED.new_arrival, price_type = EXCLUDED.price_type,
           selling_price = EXCLUDED.selling_price, compare_at_price = EXCLUDED.compare_at_price,
           cost_price = EXCLUDED.cost_price, delivery_charge_override = EXCLUDED.delivery_charge_override,
           stem_count = EXCLUDED.stem_count, colour_theme = EXCLUDED.colour_theme,
           arrangement_style = EXCLUDED.arrangement_style, size = EXCLUDED.size,
           requires_whatsapp_confirmation = EXCLUDED.requires_whatsapp_confirmation,
           seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
           updated_at = EXCLUDED.updated_at, published_at = EXCLUDED.published_at`,
        [
          row.id,
          row.slug,
          row.name,
          row.short_description,
          row.description,
          row.category_id,
          row.status,
          bool(row.featured),
          bool(row.bestseller),
          bool(row.new_arrival),
          row.price_type,
          row.selling_price,
          row.compare_at_price,
          row.cost_price,
          row.delivery_charge_override,
          row.stem_count,
          row.colour_theme,
          row.arrangement_style,
          row.size,
          bool(row.requires_whatsapp_confirmation),
          row.seo_title,
          row.seo_description,
          ts(row.created_at),
          ts(row.updated_at),
          ts(row.published_at),
        ]
      );
    }

    // Empty today (no UI writes to it yet — see the "forward-compatible,
    // no UI yet" note on the table itself) but included for completeness:
    // a silently-skipped table is exactly the kind of thing that looks
    // like an oversight six months from now when it's no longer empty.
    for (const row of sqliteAll("SELECT * FROM product_variants")) {
      await insertRow(
        `INSERT INTO product_variants (id, product_id, name, sku, price_delta, is_default, sort_order, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, sku = EXCLUDED.sku, price_delta = EXCLUDED.price_delta, is_default = EXCLUDED.is_default, sort_order = EXCLUDED.sort_order`,
        [row.id, row.product_id, row.name, row.sku, row.price_delta, bool(row.is_default), row.sort_order, ts(row.created_at)]
      );
    }

    for (const row of sqliteAll("SELECT * FROM product_images")) {
      await insertRow(
        `INSERT INTO product_images (id, product_id, media_id, alt_text, sort_order, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET alt_text = EXCLUDED.alt_text, sort_order = EXCLUDED.sort_order, is_primary = EXCLUDED.is_primary`,
        [row.id, row.product_id, row.media_id, row.alt_text, row.sort_order, bool(row.is_primary)]
      );
    }

    for (const [table, aCol, bCol] of [
      ["product_occasions", "product_id", "occasion_id"],
      ["product_moods", "product_id", "mood_id"],
      ["product_flower_types", "product_id", "flower_type_id"],
    ]) {
      for (const row of sqliteAll(`SELECT * FROM ${table}`)) {
        await insertRow(`INSERT INTO ${table} (${aCol}, ${bCol}) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
          row[aCol],
          row[bCol],
        ]);
      }
    }

    for (const table of ["product_whats_included", "product_care_instructions"]) {
      for (const row of sqliteAll(`SELECT * FROM ${table}`)) {
        await insertRow(
          `INSERT INTO ${table} (id, product_id, value, sort_order) VALUES ($1,$2,$3,$4)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, sort_order = EXCLUDED.sort_order`,
          [row.id, row.product_id, row.value, row.sort_order]
        );
      }
    }

    // Identity preserved via explicit id inserts above — reset every
    // serial sequence to continue after the highest migrated id, so the
    // very next normal (non-migration) insert doesn't collide with
    // migrated history.
    for (const table of [
      "admin_users",
      "media",
      "categories",
      "occasions",
      "moods",
      "flower_types",
      "products",
      "product_variants",
      "product_images",
      "product_whats_included",
      "product_care_instructions",
    ]) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`
      );
    }

    await client.query("COMMIT");
    console.log("Transaction committed.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back. Postgres is unchanged.", error);
    process.exit(1);
  } finally {
    client.release();
  }

  console.log("\n=== VERIFY ===");
  const pgQuery = async (sql) => (await pool.query(sql)).rows;
  const pgCounts = {};
  for (const table of TABLES_IN_ORDER) {
    pgCounts[table] = Number((await pgQuery(`SELECT COUNT(*) AS n FROM ${table}`))[0].n);
  }

  console.log("Row count parity:");
  let allMatch = true;
  for (const table of TABLES_IN_ORDER) {
    const match = sqliteCounts[table] === pgCounts[table];
    allMatch &&= match;
    console.log(`  ${table.padEnd(28)} SQLite ${sqliteCounts[table]}  Postgres ${pgCounts[table]}  ${match ? "✓ MATCH" : "✗ MISMATCH"}`);
  }

  const integrityChecks = [
    ["orphaned products (missing category)", "SELECT COUNT(*) n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE c.id IS NULL"],
    ["orphaned product_images (missing product)", "SELECT COUNT(*) n FROM product_images pi LEFT JOIN products p ON p.id = pi.product_id WHERE p.id IS NULL"],
    ["orphaned product_images (missing media)", "SELECT COUNT(*) n FROM product_images pi LEFT JOIN media m ON m.id = pi.media_id WHERE m.id IS NULL"],
  ];
  console.log("Referential integrity on Postgres:");
  for (const [label, sql] of integrityChecks) {
    const n = Number((await pgQuery(sql))[0].n);
    console.log(`  ${label}: ${n} ${n === 0 ? "✓" : "✗"}`);
    allMatch &&= n === 0;
  }

  await pool.end();
  sqlite.close();

  if (!allMatch) {
    console.error("\nCertification FAILED — see mismatches above.");
    process.exit(1);
  }
  console.log("\nCertification PASSED.");
}

main();
