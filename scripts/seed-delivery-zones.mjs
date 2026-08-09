#!/usr/bin/env node
// One-time (or re-runnable) seed for the `delivery_zones` table — the
// Postgres promotion of src/data/serviceAreas.ts's static array, as part
// of the Delivery Capability Engine milestone. This is the SOURCE OF
// TRUTH file the rows are copied from: to change delivery zone data,
// edit serviceAreas.ts and re-run this script (or, once real admin
// tooling exists for this table, edit it there instead).
//
// Idempotent via ON CONFLICT (pincode) DO UPDATE — safe to re-run on
// every deploy without creating duplicate rows, per this milestone's
// explicit idempotency requirement. serviceAreas.ts itself is left in
// place (not deleted) after this seed: it's still imported by
// cart.astro/DeliveryChecker.astro/ProductOptions.astro for their own
// UI concerns (e.g. rendering time-slot option labels) even after their
// delivery *decisions* move to calling the authoritative API — see the
// Delivery Capability report for the exact boundary.
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { supabasePoolSsl } from "../src/server/db/postgres/ssl.mjs";
import { serviceAreas } from "../src/data/serviceAreas.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in first.");
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 1, ssl: supabasePoolSsl });
const db = drizzle(pool);

console.log(`Seeding ${serviceAreas.length} delivery zones from src/data/serviceAreas.ts ...`);

for (const area of serviceAreas) {
  await db.execute(sql`
    INSERT INTO delivery_zones (pincode, area, city, delivery_fee, same_day_available, morning_delivery_available, updated_at)
    VALUES (${area.pincode}, ${area.area}, ${area.city}, ${area.deliveryFee}, ${area.sameDayAvailable}, ${area.morningDeliveryAvailable}, now())
    ON CONFLICT (pincode) DO UPDATE SET
      area = EXCLUDED.area,
      city = EXCLUDED.city,
      delivery_fee = EXCLUDED.delivery_fee,
      same_day_available = EXCLUDED.same_day_available,
      morning_delivery_available = EXCLUDED.morning_delivery_available,
      updated_at = now()
  `);
}

console.log("Done.");
await pool.end();
