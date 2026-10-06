#!/usr/bin/env node
// Adds the garland catalogue (src/data/garlandDrafts.json, FP-G001 onward) to
// the product database so every design can be edited in the admin dashboard.
// --apply requires migration 0011 (npm run db:migrate); a dry run works
// before it too and says so.
//
//   node scripts/seed-garlands.mjs            # dry run: read-only transaction, writes nothing
//   node scripts/seed-garlands.mjs --apply    # insert missing garlands
//
// Idempotent and additive only:
// - A design whose code already exists in garland_details is left completely
//   untouched — every admin edit (prices, copy, photos, approvals, status) is
//   preserved. Re-running never updates an existing row.
// - Nothing that isn't a garland is ever updated or deleted. If a design's
//   URL slug is already used by another product (e.g. a bouquet), the run
//   stops before writing anything.
// - New rows start exactly as the catalogue says: drafts in enquiry mode,
//   ₹5,000 where the catalogue has that confirmed price ("Price on request"
//   otherwise), unknown facts NULL, photo permission and sample verification
//   as recorded. Photos are added separately (scripts/migrate-garland-images.mjs).
// - Everything runs in one transaction.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Pool } from "pg";
import { supabasePoolSsl } from "../src/server/db/postgres/ssl.mjs";

const { values: args } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    catalogue: { type: "string", default: "src/data/garlandDrafts.json" },
  },
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const target = (() => {
  try {
    const u = new URL(connectionString);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparsable DATABASE_URL)";
  }
})();

const GARLAND_OCCASIONS = [
  { slug: "wedding", name: "Wedding" },
  { slug: "engagement", name: "Engagement" },
];
const UNITS = new Set(["single", "pair", "set"]);
const FILTERS = new Set(["rose", "tuberose", "lotus", "designer-mixed"]);

const catalogue = JSON.parse(readFileSync(args.catalogue, "utf8"));
const designs = catalogue.designs ?? [];

const pool = new Pool({ connectionString, max: 1, ssl: supabasePoolSsl });
const client = await pool.connect();
let exitCode = 0;
try {
  // A dry run is a read-only transaction: the database itself refuses writes.
  await client.query(args.apply ? "BEGIN" : "BEGIN TRANSACTION READ ONLY");

  // Before migration 0011 a dry run still reports what --apply would do
  // once it is applied; --apply itself refuses to run.
  const hasTables = !!(await client.query(`SELECT to_regclass('public.garland_details') AS t`)).rows[0].t;
  if (!hasTables && args.apply) throw new Error("garland_details does not exist — apply migration 0011 first (npm run db:migrate).");

  // ---------------------------------------------------------------- plan (reads only)
  const existingCodes = new Map(
    hasTables
      ? (await client.query(`SELECT g.design_code, p.slug FROM garland_details g JOIN products p ON p.id = g.product_id`)).rows.map((r) => [r.design_code, r.slug])
      : []
  );
  const slugOwners = new Map((await client.query(`SELECT slug, id FROM products`)).rows.map((r) => [r.slug, r.id]));

  const problems = [];
  const toInsert = [];
  const kept = [];
  const codes = new Set();
  for (const d of designs) {
    if (!/^FP-G\d{3,}$/.test(d.code ?? "")) problems.push(`invalid design code ${JSON.stringify(d.code)}`);
    if (codes.has(d.code)) problems.push(`design code ${d.code} appears twice in the catalogue`);
    codes.add(d.code);
    if (existingCodes.has(d.code)) {
      if (existingCodes.get(d.code) !== d.slug) {
        // The database is authoritative; the catalogue slug is only reported.
        console.warn(`  note: ${d.code} is at /products/${existingCodes.get(d.code)} in the database (catalogue says ${d.slug}); database kept.`);
      }
      kept.push(d.code);
      continue;
    }
    if (slugOwners.has(d.slug)) problems.push(`${d.code}: slug "${d.slug}" already belongs to product #${slugOwners.get(d.slug)} — not overwriting it`);
    for (const f of d.filters ?? []) if (!FILTERS.has(f)) problems.push(`${d.code}: unknown filter ${f}`);
    toInsert.push(d);
  }
  if (problems.length) throw new Error(`Nothing was written:\n  - ${problems.join("\n  - ")}`);

  const bouquetCountBefore = (
    await client.query(
      hasTables
        ? `SELECT count(*)::int n FROM products p WHERE NOT EXISTS (SELECT 1 FROM garland_details g WHERE g.product_id = p.id)`
        : `SELECT count(*)::int n FROM products`
    )
  ).rows[0].n;

  console.log(`${args.apply ? "" : "[dry run, read-only] "}target ${target}`);
  if (!hasTables) console.log("  migration 0011 is NOT applied (no garland_details table) — the counts below are what --apply would do after it is.");
  console.log(`  catalogue designs: ${designs.length} | already in the database (kept as is): ${kept.length} | to add: ${toInsert.length}`);
  console.log(`  other products in the database (never modified): ${bouquetCountBefore}`);

  if (!args.apply) {
    if (toInsert.length) console.log(`  would add: ${toInsert.slice(0, 8).map((d) => d.code).join(", ")}${toInsert.length > 8 ? ", …" : ""}`);
    const published = toInsert.filter((d) => d.published === true).length;
    const priced = toInsert.filter((d) => d.priceConfirmed === true && typeof d.price === "number" && d.price > 0).length;
    if (toInsert.length) console.log(`  of those: ${published} would start published, ${toInsert.length - published} as drafts; ${priced} with a confirmed price, ${toInsert.length - priced} "Price on request"`);
    const hasCategory = (await client.query(`SELECT 1 FROM categories WHERE slug = 'garlands'`)).rowCount > 0;
    const occasionRows = (await client.query(`SELECT slug FROM occasions WHERE slug = ANY($1)`, [GARLAND_OCCASIONS.map((o) => o.slug)])).rows.map((r) => r.slug);
    const missingOccasions = GARLAND_OCCASIONS.filter((o) => !occasionRows.includes(o.slug)).map((o) => o.name);
    console.log(`  category "garlands": ${hasCategory ? "exists" : "would be added"} | occasions: ${missingOccasions.length ? `would add ${missingOccasions.join(", ")}` : "wedding and engagement exist"}`);
    await client.query("ROLLBACK");
  } else {
    // ---------------------------------------------------------------- writes (inserts only)
    let category = (await client.query(`SELECT id FROM categories WHERE slug = 'garlands'`)).rows[0];
    if (!category) {
      category = (
        await client.query(
          `INSERT INTO categories (name, slug, sort_order) VALUES ('Garlands', 'garlands', (SELECT coalesce(max(sort_order), 0) + 1 FROM categories)) RETURNING id`
        )
      ).rows[0];
      console.log("  added category: Garlands");
    }
    const occasionIds = [];
    for (const o of GARLAND_OCCASIONS) {
      let row = (await client.query(`SELECT id FROM occasions WHERE slug = $1`, [o.slug])).rows[0];
      if (!row) {
        row = (await client.query(`INSERT INTO occasions (name, slug) VALUES ($1, $2) RETURNING id`, [o.name, o.slug])).rows[0];
        console.log(`  added occasion: ${o.name}`);
      }
      occasionIds.push(row.id);
    }

    for (const d of toInsert) {
      const priced = d.priceConfirmed === true && typeof d.price === "number" && d.price > 0;
      const product = (
        await client.query(
          `INSERT INTO products (slug, name, short_description, description, category_id, status, price_type, selling_price, requires_whatsapp_confirmation, published_at)
           VALUES ($1, $2, NULL, NULL, $3, $4, $5, $6, true, $7) RETURNING id`,
          [d.slug, d.title, category.id, d.published === true ? "published" : "draft", priced ? "fixed" : "quote", priced ? d.price : null, d.published === true ? new Date() : null]
        )
      ).rows[0];
      await client.query(
        `INSERT INTO garland_details (product_id, design_code, sold_unit, length, flower_recipe, thickness, finish, lead_time, substitution_policy, selling_mode, ready_for_sale, photo_permission, sample_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          product.id,
          d.code,
          UNITS.has(d.soldUnit) ? d.soldUnit : null,
          d.length ?? null,
          d.flowerRecipe ?? null,
          d.weightOrThickness ?? null,
          d.finish ?? null,
          d.leadTime ?? null,
          d.substitutionPolicy ?? null,
          d.sellingMode === "cart" ? "cart" : "enquiry",
          d.readyForSale === true,
          d.photoPermission === "granted" || d.photoPermission === "refused" ? d.photoPermission : "unconfirmed",
          d.sampleVerified === true,
        ]
      );
      for (const filter of new Set(d.filters ?? [])) {
        await client.query(`INSERT INTO product_garland_filters (product_id, filter) VALUES ($1, $2)`, [product.id, filter]);
      }
      for (const occasionId of occasionIds) {
        await client.query(`INSERT INTO product_occasions (product_id, occasion_id) VALUES ($1, $2)`, [product.id, occasionId]);
      }
      let order = 0;
      for (const option of d.options ?? []) {
        for (const value of option.values ?? []) {
          const label = typeof value === "string" ? value : value.label;
          const charge = typeof value === "string" ? null : (value.extraCharge ?? null);
          await client.query(`INSERT INTO product_options (product_id, option_name, value_label, extra_charge, sort_order) VALUES ($1, $2, $3, $4, $5)`, [
            product.id,
            option.label,
            label,
            charge,
            order++,
          ]);
        }
      }
    }

    const bouquetCountAfter = (await client.query(`SELECT count(*)::int n FROM products p WHERE NOT EXISTS (SELECT 1 FROM garland_details g WHERE g.product_id = p.id)`)).rows[0].n;
    if (bouquetCountAfter !== bouquetCountBefore) throw new Error(`other products changed (${bouquetCountBefore} → ${bouquetCountAfter}); rolled back`);
    await client.query("COMMIT");
    const total = (await client.query(`SELECT count(*)::int n FROM garland_details`)).rows[0].n;
    console.log(`  added ${toInsert.length} garland(s); garlands in the database: ${total}`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error.message);
  exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
process.exit(exitCode);
