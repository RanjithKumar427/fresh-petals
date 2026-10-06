#!/usr/bin/env node
// Moves garland photos into the site's image storage — the same Supabase
// Storage bucket, folder and naming that admin uploads use
// (src/server/storage/SupabaseStorageProvider.ts) — and attaches them to the
// garland's product in the database, so the live site never depends on the
// local, git-ignored public/images/garlands/ folder.
//
//   node scripts/migrate-garland-images.mjs                 # dry run: report only
//   node scripts/migrate-garland-images.mjs --apply         # upload + attach
//   node scripts/migrate-garland-images.mjs --apply --only FP-G001,FP-G002
//
// Publication approval: by default only designs whose photo permission is
// "granted" in the database are uploaded. The storage bucket is publicly
// readable (unguessable file names, but anyone with a URL can open it), so
// uploading supplier photos without permission would effectively publish
// them. --include-unapproved overrides this deliberately; prefer uploading
// your own photographs in the admin editor instead.
//
// Idempotent: designs that already have any photo in the database are
// skipped (admin choices win), and a file already in storage (same SHA-256
// checksum) is reused rather than uploaded twice. Uploads only the main photo
// and confirmed gallery photos — never provisional related views.
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import sharp from "sharp";
import { supabasePoolSsl } from "../src/server/db/postgres/ssl.mjs";

const { values: args } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    "include-unapproved": { type: "boolean", default: false },
    only: { type: "string" },
    catalogue: { type: "string", default: "src/data/garlandDrafts.json" },
    public: { type: "string", default: "public" },
  },
});

const BUCKET = "media"; // same bucket as SupabaseStorageProvider
const FOLDER = "products"; // same folder ImagesSection uploads into
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (args.apply && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — needed to upload.");
  process.exit(1);
}
const only = args.only ? new Set(args.only.split(",").map((c) => c.trim().toUpperCase())) : null;
const catalogue = new Map(JSON.parse(readFileSync(args.catalogue, "utf8")).designs.map((d) => [d.code, d]));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const host = (() => {
  try {
    return new URL(DATABASE_URL).hostname;
  } catch {
    return "?";
  }
})();

const pool = new Pool({ connectionString: DATABASE_URL, max: 2, ssl: supabasePoolSsl });
const storage = args.apply ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }).storage : null;

const report = { uploaded: 0, reused: 0, attached: 0, skippedHasPhotos: [], skippedUnapproved: [], missingFiles: [], failed: [] };
try {
  const garlands = (
    await pool.query(
      `SELECT p.id, p.slug, p.name, g.design_code, g.photo_permission,
              (SELECT count(*)::int FROM product_images i WHERE i.product_id = p.id) AS images
         FROM garland_details g JOIN products p ON p.id = g.product_id ORDER BY g.design_code`
    )
  ).rows.filter((g) => !only || only.has(g.design_code));

  console.log(`${args.apply ? "" : "[dry run] "}database ${host} | garlands: ${garlands.length}${args["include-unapproved"] ? " | INCLUDING photos without permission" : ""}`);

  for (const g of garlands) {
    if (g.images > 0) {
      report.skippedHasPhotos.push(g.design_code);
      continue;
    }
    if (g.photo_permission !== "granted" && !args["include-unapproved"]) {
      report.skippedUnapproved.push(g.design_code);
      continue;
    }
    const design = catalogue.get(g.design_code);
    const photos = design ? [design.image, ...(design.gallery ?? [])] : [];
    const files = photos.map((p) => ({ ...p, file: path.join(args.public, p.path.replace(/^\//, "")) }));
    const missing = files.filter((f) => !existsSync(f.file));
    if (!design || files.length === 0 || missing.length) {
      report.missingFiles.push(`${g.design_code}${missing.length ? ` (${missing.map((m) => m.path).join(", ")})` : " (no catalogue photo)"}`);
      continue;
    }
    if (!args.apply) {
      report.attached += files.length;
      continue;
    }

    const uploadedPaths = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let order = 0;
      for (const f of files) {
        const buffer = readFileSync(f.file);
        const checksum = sha256(buffer);
        let media = (await client.query(`SELECT id FROM media WHERE checksum = $1 AND source = 'upload' ORDER BY id LIMIT 1`, [checksum])).rows[0];
        if (media) {
          report.reused++;
        } else {
          const { width, height } = await sharp(buffer).metadata();
          const objectPath = `${FOLDER}/${randomUUID()}.jpg`;
          const { error } = await storage.from(BUCKET).upload(objectPath, buffer, { contentType: "image/jpeg", upsert: false });
          if (error) throw new Error(`upload failed: ${error.message}`);
          uploadedPaths.push(objectPath);
          const url = storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
          media = (
            await client.query(
              `INSERT INTO media (filename, bucket, path, url, folder, mime_type, size_bytes, width, height, checksum, alt_text, source)
               VALUES ($1, $2, $3, $4, $5, 'image/jpeg', $6, $7, $8, $9, $10, 'upload') RETURNING id`,
              [`${g.design_code.toLowerCase()}-${g.slug}${order ? `-${order}` : ""}.jpg`, BUCKET, objectPath, url, FOLDER, buffer.byteLength, width ?? null, height ?? null, checksum, f.alt ?? null]
            )
          ).rows[0];
          report.uploaded++;
        }
        await client.query(`INSERT INTO product_images (product_id, media_id, alt_text, sort_order, is_primary) VALUES ($1, $2, $3, $4, $5)`, [
          g.id,
          media.id,
          f.alt ?? null,
          order,
          order === 0,
        ]);
        report.attached++;
        order++;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      // Same rule as MediaService.upload: a failed save never leaves orphaned files.
      if (uploadedPaths.length) await storage.from(BUCKET).remove(uploadedPaths).catch(() => {});
      report.failed.push(`${g.design_code}: ${error.message}`);
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}

console.log(`  photos ${args.apply ? "attached" : "to attach"}: ${report.attached}${args.apply ? ` (uploaded ${report.uploaded}, reused ${report.reused})` : ""}`);
console.log(`  skipped — already have photos (admin choices kept): ${report.skippedHasPhotos.length}`);
console.log(`  skipped — photo permission not granted: ${report.skippedUnapproved.length}${report.skippedUnapproved.length ? " (use the admin editor to upload your own photos, or --include-unapproved)" : ""}`);
if (report.missingFiles.length) console.log(`  missing local photo files: ${report.missingFiles.join("; ")}`);
if (report.failed.length) {
  console.log(`  FAILED: ${report.failed.join("; ")}`);
  process.exit(1);
}
