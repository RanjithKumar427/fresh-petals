#!/usr/bin/env node
// Database records for the Car Decoration range (src/data/productCatalog.ts,
// category "Car Decoration"), so each product can be listed by the storefront
// and edited in the admin. docs/car-decoration.md has the release order.
//
//   node scripts/seed-car-decoration.mjs [plan]       # report only (default)
//   node scripts/seed-car-decoration.mjs apply        # add missing products, as DRAFTS
//   node scripts/seed-car-decoration.mjs publish      # publish seeded drafts nobody has touched
//   node scripts/seed-car-decoration.mjs rollback     # withdraw the seed (see below)
//   add --sql to print the statements instead (e.g. for the Supabase SQL editor);
//   add --dry-run to run apply/publish/rollback and roll back.
//
// What the seed owns. A product counts as seeded only when it is in the
// car-decoration category and its primary photo is the seed's own media row
// (source 'seed', url /images/car-decoration/<slug>.webp) created in the same
// transaction as the product. Anything else — a product that already had the
// slug, or one whose photo the admin replaced — is never published or removed
// by this script, only reported.
//
//   apply     category (if missing), flower types (if missing), and for each slug
//             not in the database: media row, product (draft, quote, WhatsApp
//             confirmation), photo, included items, care notes, flower types.
//             Existing slugs are skipped. No occasion is assigned.
//   publish   seeded drafts with updated_at = created_at (no admin save since
//             the seed) become published; updated_at is left as it is, so a later
//             admin edit stays detectable. Drafts an admin has edited are left.
//   rollback  seeded products never edited by an admin are deleted (with their
//             details and seed media); seeded products an admin has edited are
//             only moved to draft, keeping the edits; the category is removed
//             only if it is then empty and was created with the seed.
// Every action is one transaction and can be repeated safely.
import { statSync } from "node:fs";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { sourceLoader } from "./audit/source-loader.mjs";

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: { sql: { type: "boolean", default: false }, "dry-run": { type: "boolean", default: false } },
});
const action = positionals[0] ?? "plan";
if (!["plan", "apply", "publish", "rollback"].includes(action)) {
  console.error("Use plan, apply, publish or rollback.");
  process.exit(2);
}

const CAT = "car-decoration";
const load = sourceLoader();
const { productCatalog } = load("src/data/productCatalog.ts");
const { PHOTO_DESCRIPTIONS } = load("src/data/productPhotos.ts");
const products = productCatalog.filter((p) => p.category === "Car Decoration");
if (!products.length) throw new Error("No Car Decoration products in the catalogue.");

const lit = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const slugify = (v) => v.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugs = products.map((p) => lit(p.slug)).join(", ");

// Seeded: see the header. `p` is a products row alias.
const SEEDED = `p.category_id = (select id from categories where slug = '${CAT}') and exists (select 1 from product_images pi join media m on m.id = pi.media_id where pi.product_id = p.id and pi.is_primary and m.source = 'seed' and m.url = '/images/car-decoration/' || p.slug || '.webp' and m.created_at = p.created_at)`;

const REPORT = `select s.slug, coalesce(p.status::text, 'missing') as status, case when p.id is null then '-' when ${SEEDED} then 'seeded' else 'NOT SEEDED (left alone)' end as owner, case when p.id is null then '-' when p.updated_at = p.created_at then 'no' else 'yes' end as admin_edited, (select c.slug from categories c where c.id = p.category_id) as category from unnest(array[${slugs}]) with ordinality s(slug, n) left join products p on p.slug = s.slug order by s.n;`;

async function applySql() {
  const out = [
    `insert into categories (name, slug, sort_order) select 'Car Decoration', '${CAT}', (select coalesce(max(sort_order), 0) + 1 from categories) where not exists (select 1 from categories where slug = '${CAT}');`,
  ];
  for (const name of [...new Set(products.flatMap((p) => p.flowerTypes ?? []))]) {
    out.push(`insert into flower_types (name, slug) select ${lit(name)}, ${lit(slugify(name))} where not exists (select 1 from flower_types where name = ${lit(name)} or slug = ${lit(slugify(name))});`);
  }
  for (const p of products) {
    const file = `public${p.image}`;
    const { width, height } = await sharp(file).metadata();
    const alt = PHOTO_DESCRIPTIONS[p.image] ?? p.name;
    const missing = `not exists (select 1 from products where slug = ${lit(p.slug)})`;
    const pid = `(select id from products where slug = ${lit(p.slug)})`;
    out.push(`-- ${p.slug}\ndo $$ begin if ${missing} then`);
    out.push(
      `  with m as (insert into media (filename, url, folder, mime_type, size_bytes, width, height, alt_text, source) values (${lit(p.image.split("/").pop())}, ${lit(p.image)}, 'products', 'image/webp', ${statSync(file).size}, ${width}, ${height}, ${lit(alt)}, 'seed') returning id),\n   pr as (insert into products (slug, name, short_description, description, category_id, status, price_type, requires_whatsapp_confirmation) values (${lit(p.slug)}, ${lit(p.name)}, ${lit(p.description)}, ${lit(p.longDescription)}, (select id from categories where slug = '${CAT}'), 'draft', 'quote', true) returning id)\n  insert into product_images (product_id, media_id, alt_text, sort_order, is_primary) select pr.id, m.id, ${lit(alt)}, 0, true from pr, m;`
    );
    p.whatsIncluded.forEach((v, i) => out.push(`  insert into product_whats_included (product_id, value, sort_order) values (${pid}, ${lit(v)}, ${i});`));
    p.careNotes.forEach((v, i) => out.push(`  insert into product_care_instructions (product_id, value, sort_order) values (${pid}, ${lit(v)}, ${i});`));
    (p.flowerTypes ?? []).forEach((n) => out.push(`  insert into product_flower_types (product_id, flower_type_id) values (${pid}, (select id from flower_types where name = ${lit(n)} or slug = ${lit(slugify(n))} order by (name = ${lit(n)}) desc limit 1));`));
    out.push("end if; end $$;");
  }
  // A DO block is one statement: group each product's lines into it.
  return out.join("\n").split(/\n(?=-- |insert into (?:categories|flower_types))/);
}

const PUBLISH = [
  `update products p set status = 'published', published_at = coalesce(p.published_at, now()) where p.slug in (${slugs}) and p.status = 'draft' and p.updated_at = p.created_at and ${SEEDED};`,
];

const ROLLBACK = [
  `create temp table fp_car_rb on commit drop as select p.id, p.updated_at = p.created_at as untouched, pi.media_id from products p join product_images pi on pi.product_id = p.id and pi.is_primary where p.slug in (${slugs}) and ${SEEDED};`,
  `create temp table fp_car_cat on commit drop as select c.id from categories c where c.slug = '${CAT}' and c.created_at = c.updated_at and c.created_at in (select p.created_at from products p where p.id in (select id from fp_car_rb));`,
  `update products set status = 'draft', updated_at = now() where id in (select id from fp_car_rb where not untouched) and status <> 'draft';`,
  `delete from products where id in (select id from fp_car_rb where untouched);`,
  `delete from media m where m.id in (select media_id from fp_car_rb) and m.source = 'seed' and not exists (select 1 from product_images pi where pi.media_id = m.id);`,
  `delete from categories c where c.id in (select id from fp_car_cat) and not exists (select 1 from products p where p.category_id = c.id);`,
];

const body = action === "apply" ? await applySql() : action === "publish" ? PUBLISH : action === "rollback" ? ROLLBACK : [];

if (flags.sql) {
  console.log([`-- Car Decoration: ${action} (scripts/seed-car-decoration.mjs)`, "begin;", ...body, REPORT, "commit;"].join("\n"));
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (or use --sql).");
  process.exit(1);
}
const { Pool } = await import("pg");
const { supabasePoolSsl } = await import("../src/server/db/postgres/ssl.mjs");
const pool = new Pool({ connectionString: url, max: 1, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : supabasePoolSsl });
const client = await pool.connect();
const commit = action !== "plan" && !flags["dry-run"];
try {
  console.log(`Target ${new URL(url).hostname}: ${action}${commit ? "" : " (rolled back)"}`);
  await client.query("begin");
  for (const sql of body) await client.query(sql);
  const { rows } = await client.query(REPORT);
  console.table(rows);
  await client.query(commit ? "commit" : "rollback");
  console.log(commit ? "Committed." : "Nothing written.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`Failed, nothing written: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
