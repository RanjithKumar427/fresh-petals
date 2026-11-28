#!/usr/bin/env node
// Adds the Car Decoration range (src/data/productCatalog.ts, category
// "Car Decoration") to the product database, so each product has the record
// the storefront needs to list it and can be edited in the admin.
//
//   node scripts/seed-car-decoration.mjs                 # dry run: runs and rolls back
//   node scripts/seed-car-decoration.mjs --apply         # insert, as drafts
//   node scripts/seed-car-decoration.mjs --apply --publish   # insert, published
//   node scripts/seed-car-decoration.mjs --sql [--publish]   # print the SQL (for the Supabase SQL editor)
//   node scripts/seed-car-decoration.mjs --rollback-sql      # print the SQL that removes exactly these rows
//
// Additive only, in one transaction:
//   - the category "Car Decoration" (slug car-decoration) if it is missing;
//   - for each product whose slug is not in the database: a media row pointing
//     at its reviewed photograph in public/ (the build serves it as a static
//     file), the product (price type quote, WhatsApp confirmation), its photo,
//     included items, care notes and flower types (missing flower types added).
// A slug that already exists is left untouched (admin edits are preserved).
// No occasion is assigned: occasion pages stay as they are until the admin
// assigns one. Nothing existing is updated or deleted.
import { readFileSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { sourceLoader } from "./audit/source-loader.mjs";

const { values: args } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    publish: { type: "boolean", default: false },
    sql: { type: "boolean", default: false },
    "rollback-sql": { type: "boolean", default: false },
  },
});

const CATEGORY = { name: "Car Decoration", slug: "car-decoration" };
const load = sourceLoader();
const { productCatalog } = load("src/data/productCatalog.ts");
const { PHOTO_DESCRIPTIONS } = load("src/data/productPhotos.ts");
const products = productCatalog.filter((p) => p.category === CATEGORY.name);
if (!products.length) throw new Error("No Car Decoration products in the catalogue.");

const lit = (value) => (value == null ? "null" : `'${String(value).replace(/'/g, "''")}'`);
const slugify = (value) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function buildSql(publish) {
  const status = publish ? "published" : "draft";
  const lines = [
    "-- Car Decoration seed (scripts/seed-car-decoration.mjs). Additive; existing slugs are skipped.",
    "begin;",
    `insert into categories (name, slug, sort_order) select ${lit(CATEGORY.name)}, ${lit(CATEGORY.slug)}, (select coalesce(max(sort_order), 0) + 1 from categories) where not exists (select 1 from categories where slug = ${lit(CATEGORY.slug)});`,
  ];
  const flowers = [...new Set(products.flatMap((p) => p.flowerTypes ?? []))];
  for (const name of flowers) {
    lines.push(`insert into flower_types (name, slug) select ${lit(name)}, ${lit(slugify(name))} where not exists (select 1 from flower_types where name = ${lit(name)} or slug = ${lit(slugify(name))});`);
  }
  for (const p of products) {
    const file = `public${p.image}`;
    const meta = await sharp(file).metadata();
    const size = statSync(file).size;
    const alt = PHOTO_DESCRIPTIONS[p.image] ?? p.name;
    const guard = `not exists (select 1 from products where slug = ${lit(p.slug)})`;
    lines.push(`-- ${p.slug}`);
    lines.push(
      `with m as (insert into media (filename, url, folder, mime_type, size_bytes, width, height, alt_text, source) select ${lit(p.image.split("/").pop())}, ${lit(p.image)}, 'products', 'image/webp', ${size}, ${meta.width}, ${meta.height}, ${lit(alt)}, 'seed' where ${guard} returning id),`,
      ` pr as (insert into products (slug, name, short_description, description, category_id, status, price_type, requires_whatsapp_confirmation, published_at) select ${lit(p.slug)}, ${lit(p.name)}, ${lit(p.description)}, ${lit(p.longDescription)}, (select id from categories where slug = ${lit(CATEGORY.slug)}), '${status}', 'quote', true, ${publish ? "now()" : "null"} where ${guard} returning id)`,
      ` insert into product_images (product_id, media_id, alt_text, sort_order, is_primary) select pr.id, m.id, ${lit(alt)}, 0, true from pr, m;`
    );
    const pid = `(select id from products where slug = ${lit(p.slug)})`;
    const fresh = `not exists (select 1 from product_whats_included w where w.product_id = ${pid}) and not exists (select 1 from product_care_instructions c where c.product_id = ${pid}) and not exists (select 1 from product_flower_types f where f.product_id = ${pid})`;
    const rows = [
      ...p.whatsIncluded.map((value, i) => `insert into product_whats_included (product_id, value, sort_order) select ${pid}, ${lit(value)}, ${i}`),
      ...p.careNotes.map((value, i) => `insert into product_care_instructions (product_id, value, sort_order) select ${pid}, ${lit(value)}, ${i}`),
      ...(p.flowerTypes ?? []).map((name) => `insert into product_flower_types (product_id, flower_type_id) select ${pid}, (select id from flower_types where name = ${lit(name)} or slug = ${lit(slugify(name))} limit 1)`),
    ];
    // Details only for a product this run created (its lists are still empty).
    lines.push(`do $$ begin if ${fresh} and exists (select 1 from products where slug = ${lit(p.slug)} and created_at = now()) then`);
    for (const row of rows) lines.push(`  ${row};`);
    lines.push("end if; end $$;");
  }
  lines.push(
    `select p.slug, p.status, p.price_type, c.slug as category, (select count(*) from product_images i where i.product_id = p.id) as photos from products p join categories c on c.id = p.category_id where c.slug = ${lit(CATEGORY.slug)} order by p.id;`,
    "commit;"
  );
  return lines.join("\n");
}

function rollbackSql() {
  const slugs = products.map((p) => lit(p.slug)).join(", ");
  return [
    "-- Removes the Car Decoration seed rows (products in category car-decoration with these slugs, their seed media and the category if then empty).",
    "begin;",
    `create temp table fp_car on commit drop as select p.id as product_id, pi.media_id from products p join categories c on c.id = p.category_id left join product_images pi on pi.product_id = p.id where c.slug = 'car-decoration' and p.slug in (${slugs});`,
    "delete from products where id in (select product_id from fp_car);",
    "delete from media where id in (select media_id from fp_car) and source = 'seed' and not exists (select 1 from product_images pi where pi.media_id = media.id);",
    "delete from categories where slug = 'car-decoration' and not exists (select 1 from products p where p.category_id = categories.id);",
    "commit;",
  ].join("\n");
}

if (args["rollback-sql"]) {
  console.log(rollbackSql());
  process.exit(0);
}
const sql = await buildSql(args.publish);
if (args.sql) {
  console.log(sql);
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set (or use --sql to print the statements).");
  process.exit(1);
}
const { Pool } = await import("pg");
const { supabasePoolSsl } = await import("../src/server/db/postgres/ssl.mjs");
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const pool = new Pool({ connectionString, max: 1, ssl: local ? false : supabasePoolSsl });
const client = await pool.connect();
try {
  const host = new URL(connectionString).hostname;
  console.log(`Target: ${host} — ${args.apply ? "APPLY" : "dry run (rolled back)"}, products as ${args.publish ? "published" : "drafts"}`);
  const body = sql.replace(/^begin;\n/m, "").replace(/\ncommit;$/, "");
  await client.query("begin");
  const results = await client.query(body);
  const summary = [results].flat().at(-1).rows;
  console.table(summary);
  await client.query(args.apply ? "commit" : "rollback");
  console.log(args.apply ? `Committed: ${summary.length} Car Decoration record(s).` : "Rolled back: nothing written.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
