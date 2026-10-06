// Imports the garland pack (./garland-import/, git-ignored) into the site's
// image pipeline and MERGES it into the garland catalogue. Run from the
// project root:
//
//   node scripts/import-garlands.mjs            # import and write
//   node scripts/import-garlands.mjs --dry-run  # report only, write nothing
//
// Manual edits belong in src/data/garlandDrafts.json (prices, titles,
// specifications, options, selling mode, publication, photo permission,
// sample verification, confirmed galleries). This script never overwrites
// them. Records are merged by their stable public design code (FP-G…):
//
// - Existing designs keep every field already present in the catalogue,
//   including deliberate false, null, 0 and [] values (presence is checked
//   with Object.hasOwn, never with truthiness). Only source/image metadata is
//   refreshed: the main photo's file, width and height, and the provisional
//   related-view candidates (`relatedViews`). A field missing from an
//   existing record is filled from the source default.
// - Confirmed photos live in `gallery` and are never touched; a candidate
//   whose photo is already in the gallery is not re-listed as provisional.
// - New source designs are added as drafts exactly as supplied (unknown
//   facts null, unpublished, enquiry only).
// - Designs missing from the source are kept unchanged and reported, never
//   deleted.
// - Duplicate or conflicting IDs/codes/slugs/photo paths in the source, the
//   catalogue or the local ID map stop the import before anything is written.
//
// Photos are copied byte-for-byte (checked against the pack's SHA-256) into
// public/images/garlands/, named by public design code so supplier source
// references never appear in public URLs, with WebP derivatives the way
// scripts/generate-image-derivatives.mjs makes them (quality 82) at widths
// below each original. Sizes and derivatives are recorded on the design
// records themselves (`width`, `height`, `variants`), not in the shared
// imageVariants.json / imageDimensions.json, so unpublished photo paths never
// reach code bundled for other pages (see src/data/photoManifest.ts).
// Source references stay inside the pack: garland-import/design-ids.json
// (source ID -> code, related-view paths) and garland-import/image-map.json.
//
// Full catalogue (all four source catalogues, every reviewed design):
//
//   node scripts/import-garlands.mjs --full full-garland-import [--dry-run]
//
// reads the full source pack plus its review-decisions.json and merges every
// reviewed design — see scripts/lib/import-garlands-full.mjs. Once a
// catalogue has been expanded this way, the shortlist mode below refuses to
// run, so the range can never revert to the 25-design shortlist.
//
// Options (also used by scripts/import-garlands.test.mjs with temporary fixtures):
//   --pack <dir>       shortlist import pack (default: garland-import)
//   --full <dir>       full source pack (switches to full-catalogue mode)
//   --decisions <file> review decisions (default: <full>/review-decisions.json)
//   --catalogue <file> catalogue JSON (default: src/data/garlandDrafts.json)
//   --public <dir>     public directory (default: public)
//   --products <file>  file whose `slug: "…"` entries are reserved (default: src/data/productCatalog.ts)
//   --dry-run          validate and report; write nothing
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { values: args } = parseArgs({
  options: {
    pack: { type: "string", default: path.join(root, "garland-import") },
    catalogue: { type: "string", default: path.join(root, "src/data/garlandDrafts.json") },
    public: { type: "string", default: path.join(root, "public") },
    full: { type: "string" },
    decisions: { type: "string" },
    products: { type: "string", default: path.join(root, "src/data/productCatalog.ts") },
    "dry-run": { type: "boolean", default: false },
  },
});
const DRY_RUN = args["dry-run"];
const pack = path.resolve(args.pack);
const sourceFile = path.join(pack, "website-data", "garlands-drafts.json");
const packAssets = path.join(pack, "website-assets", "public");
const idMapFile = path.join(pack, "design-ids.json");
const catalogueFile = path.resolve(args.catalogue);
const publicDir = path.resolve(args.public);
const WIDTHS = [240, 480, 720];
const CODE_PATTERN = /^FP-G\d{3}$/;
const EDITING_NOTE =
  "Edit garland designs here (prices, specifications, publication). scripts/import-garlands.mjs merges source updates by design code without overwriting these fields. See docs/garlands.md.";

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const slugify = (value) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const has = (object, key) => object != null && Object.hasOwn(object, key);
/** Derivative paths for a photo of this width (only widths below the original). */
const variantsFor = (webPath, width) => {
  const parsed = path.posix.parse(webPath);
  return Object.fromEntries(WIDTHS.filter((w) => w < width).map((w) => [String(w), `${parsed.dir}/${parsed.name}-${w}w.webp`]));
};
const fail = (problems) => {
  console.error(`Import stopped — nothing was written:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
};
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

if (args.full !== undefined) {
  const { runFullImport } = await import("./lib/import-garlands-full.mjs");
  const full = path.resolve(args.full);
  await runFullImport({
    pack: full,
    decisionsFile: path.resolve(args.decisions ?? path.join(full, "review-decisions.json")),
    catalogueFile,
    publicDir,
    reservedSlugsFile: path.resolve(args.products),
    widths: WIDTHS,
    dryRun: DRY_RUN,
    editingNote: EDITING_NOTE,
  });
  process.exit(0);
}

// ---------------------------------------------------------------- read + validate (no writes)
if (!existsSync(sourceFile)) fail([`${path.relative(root, sourceFile)} not found — copy the pack into the project root first.`]);
const source = JSON.parse(readFileSync(sourceFile, "utf8"));
const catalogue = readJson(catalogueFile, null);
if (catalogue?.importMode === "full") {
  fail(["This catalogue was expanded from the full source pack. The shortlist import would revert it; run with --full <pack> instead."]);
}
const idMap = readJson(idMapFile, { designs: {}, related: {} });
idMap.designs ??= {};
idMap.related ??= {};
const problems = [];

const sourceDesigns = Array.isArray(source.designs) ? source.designs : [];
const sourceViews = Array.isArray(source.related_view_candidates) ? source.related_view_candidates : [];
if (!sourceDesigns.length) problems.push("source has no designs");
for (const d of sourceDesigns) {
  if (typeof d.id !== "string" || !d.id) problems.push(`source design without an id (${d.public_design_code ?? "no code"})`);
  if (!CODE_PATTERN.test(d.public_design_code ?? "")) problems.push(`source design ${d.id}: invalid public code "${d.public_design_code}"`);
  if (!d.working_title) problems.push(`source design ${d.id}: no title`);
  if (!d.primary_image?.path) problems.push(`source design ${d.id}: no primary image`);
}
for (const id of duplicates(sourceDesigns.map((d) => d.id))) problems.push(`duplicate source id ${id}`);
for (const code of duplicates(sourceDesigns.map((d) => d.public_design_code))) problems.push(`duplicate source code ${code}`);
const sourceIds = new Set(sourceDesigns.map((d) => d.id));
for (const view of sourceViews) {
  if (!sourceIds.has(view.proposed_related_design_id)) problems.push(`related view ${view.source_ref}: unknown design ${view.proposed_related_design_id}`);
}
for (const ref of duplicates(sourceViews.map((view) => view.source_ref))) problems.push(`duplicate related-view reference ${ref}`);

// The ID map ties each source id to one public code, forever.
for (const d of sourceDesigns) {
  const known = idMap.designs[d.id];
  if (known !== undefined && known !== d.public_design_code) problems.push(`source id ${d.id} was ${known}; the source now says ${d.public_design_code}`);
  const owner = Object.entries(idMap.designs).find(([id, code]) => code === d.public_design_code && id !== d.id);
  if (owner) problems.push(`${d.public_design_code} belongs to source id ${owner[0]}; the source now gives it to ${d.id}`);
}

const existing = Array.isArray(catalogue?.designs) ? catalogue.designs : [];
for (const code of duplicates(existing.map((d) => d.code))) problems.push(`catalogue has duplicate code ${code}`);
for (const slug of duplicates(existing.map((d) => d.slug))) problems.push(`catalogue has duplicate slug ${slug}`);
for (const d of existing) if (!CODE_PATTERN.test(d.code ?? "")) problems.push(`catalogue record with invalid code "${d.code}"`);
if (problems.length) fail(problems);

// ---------------------------------------------------------------- merge
const sourceImage = (webPath) => path.join(packAssets, webPath.replace(/^\//, ""));
async function inspect(image) {
  const file = sourceImage(image.path);
  if (!existsSync(file)) throw new Error(`missing in pack: ${image.path}`);
  if (image.source_sha256 && sha256(file) !== image.source_sha256) throw new Error(`checksum mismatch: ${image.path}`);
  const { width, height } = await sharp(file).metadata();
  return { file, width, height };
}

/** The draft record a source design yields on first import. */
function sourceDefaults(d, slug, imagePath, firstSampleIds) {
  return {
    code: d.public_design_code,
    slug,
    title: d.working_title,
    filters: d.proposed_filters ?? [],
    filterRecipeVerified: d.filter_recipe_verified ?? false,
    status: d.status ?? "draft",
    published: d.published ?? false,
    readyForSale: d.ready_for_sale ?? false,
    sellingMode: d.selling_mode ?? "enquiry",
    price: d.price ?? null,
    currency: d.currency ?? "INR",
    priceConfirmed: d.price_confirmed ?? false,
    soldUnit: d.sold_unit ?? null,
    length: d.length ?? null,
    flowerRecipe: d.flower_recipe ?? null,
    weightOrThickness: d.weight_or_thickness ?? null,
    leadTime: d.lead_time ?? null,
    substitutionPolicy: d.substitution_policy ?? null,
    options: d.options ?? [],
    photoPermission: d.photo_permission ?? "unconfirmed",
    sampleVerified: d.sample_verified ?? false,
    firstSample: firstSampleIds.includes(d.id),
    image: { path: imagePath, width: null, height: null, alt: d.primary_image.alt ?? "" },
    gallery: [],
    relatedViews: [],
  };
}

const byCode = new Map(existing.map((record) => [record.code, record]));
const usedSlugs = new Set(existing.map((record) => record.slug));
const firstSampleIds = source.first_sample_design_ids ?? [];
const copies = []; // { file, to }
const sourceMap = [];
const report = { added: [], refreshed: [], keptMissing: [], preservedEdits: {} };
const merged = new Map();

try {
  for (const d of sourceDesigns) {
    const code = d.public_design_code;
    const previous = byCode.get(code);
    const group = path.basename(path.dirname(d.primary_image.path)); // rose | tuberose | lotus | designer
    let record;
    if (previous) {
      record = structuredClone(previous);
      // Legacy shape: related views carried confirmed/published flags.
      if (!has(record, "gallery")) {
        const views = record.relatedViews ?? [];
        record.gallery = views.filter((v) => v.confirmed === true && v.published === true).map(({ path: p, width, height, alt }) => ({ path: p, width, height, alt }));
      }
      const defaults = sourceDefaults(d, record.slug, record.image?.path, firstSampleIds);
      for (const [key, value] of Object.entries(defaults)) {
        if (!has(record, key)) record[key] = value; // fill only what is absent
        else if (key !== "relatedViews" && key !== "image" && JSON.stringify(record[key]) !== JSON.stringify(value)) {
          (report.preservedEdits[key] ??= []).push(code);
        }
      }
      if (!has(record.image ?? {}, "path")) record.image = { ...defaults.image, ...record.image, path: `/images/garlands/${group}/${code.toLowerCase()}-${record.slug}.jpg` };
      report.refreshed.push(code);
    } else {
      let slug = slugify(d.working_title);
      if (usedSlugs.has(slug)) slug = `${slug}-${code.toLowerCase()}`;
      usedSlugs.add(slug);
      record = sourceDefaults(d, slug, `/images/garlands/${group}/${code.toLowerCase()}-${slug}.jpg`, firstSampleIds);
      report.added.push(code);
    }
    // Refresh source/image metadata only.
    const photo = await inspect(d.primary_image);
    record.image = { ...record.image, width: photo.width, height: photo.height, variants: variantsFor(record.image.path, photo.width) };
    record.relatedViews = [];
    copies.push({ file: photo.file, to: record.image.path });
    sourceMap.push({ code, id: d.id, source_ref: d.source_ref, source_catalogue: d.source_catalogue, source_page: d.source_page, from: d.primary_image.path, to: record.image.path });
    merged.set(code, record);
  }

  // Provisional related-view candidates, with stable paths from the ID map.
  const idToCode = Object.fromEntries(sourceDesigns.map((d) => [d.id, d.public_design_code]));
  const takenPaths = new Set(Object.values(idMap.related));
  for (const view of sourceViews) {
    const code = idToCode[view.proposed_related_design_id];
    const record = merged.get(code);
    let viewPath = idMap.related[view.source_ref];
    if (!viewPath) {
      let n = 1;
      while (takenPaths.has(`/images/garlands/related/${code.toLowerCase()}-view-${n}.jpg`)) n++;
      viewPath = `/images/garlands/related/${code.toLowerCase()}-view-${n}.jpg`;
      takenPaths.add(viewPath);
    }
    const photo = await inspect(view.image);
    copies.push({ file: photo.file, to: viewPath });
    sourceMap.push({ code, related: true, source_ref: view.source_ref, source_catalogue: view.source_catalogue, source_page: view.source_page, from: view.image.path, to: viewPath });
    idMap.related[view.source_ref] = viewPath;
    const confirmed = (record.gallery ?? []).some((photoEntry) => photoEntry.path === viewPath);
    if (!confirmed) record.relatedViews.push({ path: viewPath, width: photo.width, height: photo.height, alt: view.image.alt ?? "", variants: variantsFor(viewPath, photo.width) });
  }
} catch (error) {
  fail([error.message]);
}

// Designs missing from the source stay exactly as they are.
for (const record of existing) {
  if (!merged.has(record.code)) {
    merged.set(record.code, record);
    report.keptMissing.push(record.code);
  }
}
const records = [...merged.values()].sort((a, b) => a.code.localeCompare(b.code));

// Final consistency check before any write.
const finalProblems = [];
for (const code of duplicates(records.map((r) => r.code))) finalProblems.push(`duplicate code ${code}`);
for (const slug of duplicates(records.map((r) => r.slug))) finalProblems.push(`duplicate slug ${slug}`);
const photoPaths = records.flatMap((r) => [r.image.path, ...(r.gallery ?? []).map((g) => g.path), ...r.relatedViews.map((v) => v.path)]);
for (const p of duplicates(photoPaths)) finalProblems.push(`photo path used twice: ${p}`);
if (finalProblems.length) fail(finalProblems);

// ---------------------------------------------------------------- report
console.log(
  `${DRY_RUN ? "[dry run] " : ""}designs: ${records.length} (added ${report.added.length}, refreshed ${report.refreshed.length}, kept though missing from source ${report.keptMissing.length}) | photos: ${copies.length}`
);
if (report.keptMissing.length) console.log(`  kept, not in source: ${report.keptMissing.join(", ")}`);
for (const [key, codes] of Object.entries(report.preservedEdits)) console.log(`  preserved catalogue value for ${key}: ${codes.length} design(s)`);

const output = {
  _editing: EDITING_NOTE,
  category: catalogue?.category ?? { key: source.category.key, label: source.category.label },
  filters: catalogue?.filters ?? source.proposed_filters,
  designs: records,
};
for (const d of sourceDesigns) idMap.designs[d.id] = d.public_design_code;

if (DRY_RUN) {
  const current = existsSync(catalogueFile) ? readFileSync(catalogueFile, "utf8") : "";
  console.log(`  catalogue would ${current === JSON.stringify(output, null, 2) + "\n" ? "stay identical" : "change"}; nothing written.`);
  process.exit(0);
}

// ---------------------------------------------------------------- write
for (const { file, to } of copies) {
  const dest = path.join(publicDir, to.replace(/^\//, ""));
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  const { width } = await sharp(dest).metadata();
  for (const [w, webPath] of Object.entries(variantsFor(to, width))) {
    await sharp(dest).resize({ width: Number(w) }).webp({ quality: 82 }).toFile(path.join(publicDir, webPath.replace(/^\//, "")));
  }
}
mkdirSync(path.dirname(catalogueFile), { recursive: true });
writeFileSync(catalogueFile, JSON.stringify(output, null, 2) + "\n");
writeFileSync(idMapFile, JSON.stringify(idMap, null, 2) + "\n");
writeFileSync(path.join(pack, "image-map.json"), JSON.stringify(sourceMap, null, 2) + "\n");
console.log("  written: catalogue, photos and derivatives, local ID map.");
