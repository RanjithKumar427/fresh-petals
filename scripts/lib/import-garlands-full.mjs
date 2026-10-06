// Full-catalogue mode of scripts/import-garlands.mjs (`--full <pack dir>`).
//
// Input: the full garland source pack (git-ignored, local only):
//   catalogue-index.json      every photo entry in the four source catalogues
//   source-candidates.json    one row per distinct photo file (with SHA-256)
//   existing-design-map.json  source reference -> code for the first 25 designs
//   review-decisions.json     the visual review: which entries are designs,
//                             alternate views, collages, context or unresolved
//   originals/                the photo files
//
// What it does:
// - Merges every reviewed design into src/data/garlandDrafts.json by public
//   code. Records already in the catalogue keep every present field (manual
//   edits, deliberate false/null/0/[]), exactly as in shortlist mode; only the
//   main photo's size/derivatives and the provisional `relatedViews` are
//   refreshed. `gallery` is never touched.
// - New designs get the next free code after the highest code in the
//   catalogue and the local ID map, and start as drafts in enquiry mode at
//   INR 5,000 (the owner's price for new designs; later edits are kept).
//   Codes are remembered per review key in <pack>/design-ids.json so a re-run
//   never renumbers or reuses a code. Designs missing from a later input are
//   kept and reported, never deleted.
// - Copies photos byte-for-byte (SHA-256 checked). A design seen only inside
//   a collage gets an unaltered rectangular region of the original photo.
// - Writes the completed coverage audit for every source entry to
//   <pack>/coverage-audit.json; an entry with no disposition stops the import.
// - Every conflict (unknown or duplicate references, a reference used twice,
//   code or slug collisions, an ID map that disagrees with the catalogue)
//   stops the import before anything is written.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CODE_PATTERN = /^FP-G(\d{3,})$/;
const KEY_PATTERN = /^([A-Z]+-[A-Z]*\d+)(?:#([A-Za-z0-9]+))?$/;
const FILTERS = new Set(["rose", "tuberose", "lotus", "designer-mixed"]);
const GROUP = { rose: "rose", tuberose: "tuberose", lotus: "lotus", "designer-mixed": "designer" };
export const NEW_DESIGN_PRICE_INR = 5000;

const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const has = (object, key) => object != null && Object.hasOwn(object, key);
const slugify = (value) => value.toLowerCase().replace(/&/g, "and").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const duplicates = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const codeNumber = (code) => Number(CODE_PATTERN.exec(code)?.[1] ?? 0);
const formatCode = (n) => `FP-G${String(n).padStart(3, "0")}`;

export async function runFullImport({ pack, decisionsFile, catalogueFile, publicDir, reservedSlugsFile, widths, dryRun, editingNote }) {
  const fail = (problems) => {
    console.error(`Import stopped — nothing was written:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  };
  const variantsFor = (webPath, width) => {
    const parsed = path.posix.parse(webPath);
    return Object.fromEntries(widths.filter((w) => w < width).map((w) => [String(w), `${parsed.dir}/${parsed.name}-${w}w.webp`]));
  };

  // ---------------------------------------------------------------- read
  const need = ["catalogue-index.json", "source-candidates.json", "existing-design-map.json"];
  const missingFiles = need.filter((f) => !existsSync(path.join(pack, f)));
  if (!existsSync(decisionsFile)) missingFiles.push(path.relative(pack, decisionsFile) || decisionsFile);
  if (missingFiles.length) fail(missingFiles.map((f) => `${f} not found in ${pack}`));
  const index = readJson(path.join(pack, "catalogue-index.json"));
  const candidates = readJson(path.join(pack, "source-candidates.json")).candidates ?? [];
  const existingMap = readJson(path.join(pack, "existing-design-map.json")).existing_designs ?? [];
  const decisions = readJson(decisionsFile);
  const auditTemplate = readJson(path.join(pack, "coverage-audit-template.json"), null);
  const catalogue = readJson(catalogueFile, { designs: [] });
  const idMapFile = path.join(pack, "design-ids.json");
  const idMap = readJson(idMapFile, { designs: {} });
  idMap.designs ??= {};
  const reservedSlugs = existsSync(reservedSlugsFile)
    ? [...readFileSync(reservedSlugsFile, "utf8").matchAll(/\bslug:\s*"([^"]+)"/g)].map((m) => m[1])
    : [];
  const problems = [];

  // ---------------------------------------------------------------- source coverage
  const entries = index.entries ?? [];
  const byRef = new Map(entries.map((e) => [e.source_ref, e]));
  for (const ref of duplicates(entries.map((e) => e.source_ref))) problems.push(`duplicate source reference ${ref} in catalogue-index.json`);
  const candidateFor = new Map();
  for (const c of candidates) for (const ref of c.source_refs ?? []) candidateFor.set(ref, c);
  const fileFor = new Map();
  for (const c of candidates) {
    const file = path.join(pack, c.asset_file);
    if (!existsSync(file)) problems.push(`photo missing: ${c.asset_file}`);
    else if (sha256(file) !== c.sha256) problems.push(`checksum mismatch: ${c.asset_file}`);
    else fileFor.set(c.canonical_source_ref, file);
  }
  for (const e of entries) if (!candidateFor.has(e.source_ref)) problems.push(`${e.source_ref}: no photo group in source-candidates.json`);
  const isRepeat = (ref) => !!byRef.get(ref)?.exact_image_repeat_of;

  // ---------------------------------------------------------------- existing designs (repository wins)
  const catalogueByCode = new Map(catalogue.designs.map((d) => [d.code, d]));
  for (const code of duplicates(catalogue.designs.map((d) => d.code))) problems.push(`catalogue has duplicate code ${code}`);
  for (const slug of duplicates(catalogue.designs.map((d) => d.slug))) problems.push(`catalogue has duplicate slug ${slug}`);
  const existingByRef = new Map();
  for (const m of existingMap) {
    if (!byRef.has(m.source_ref)) problems.push(`existing-design-map: unknown reference ${m.source_ref}`);
    if (!catalogueByCode.has(m.public_design_code)) problems.push(`existing-design-map: ${m.public_design_code} is not in the catalogue`);
    if (byRef.get(m.source_ref) && byRef.get(m.source_ref).sha256 !== m.photo_sha256) problems.push(`existing-design-map: ${m.source_ref} photo hash differs from the index`);
    existingByRef.set(m.source_ref, m.public_design_code);
  }
  const existingDecisions = decisions.existing ?? [];
  for (const x of existingDecisions) {
    if (existingByRef.get(x.ref) !== x.code) problems.push(`review lists ${x.ref} as ${x.code}, but existing-design-map says ${existingByRef.get(x.ref) ?? "nothing"}`);
  }
  for (const [ref, code] of existingByRef) if (!existingDecisions.some((x) => x.ref === ref)) problems.push(`existing design ${code} (${ref}) has no review entry`);

  // ---------------------------------------------------------------- reviewed designs
  const designs = decisions.designs ?? [];
  for (const key of duplicates(designs.map((d) => d.key))) problems.push(`review has design key ${key} twice`);
  for (const d of designs) {
    const m = KEY_PATTERN.exec(d.key ?? "");
    if (!m) { problems.push(`invalid design key "${d.key}"`); continue; }
    const ref = m[1];
    if (!byRef.has(ref)) problems.push(`${d.key}: unknown source reference`);
    if (isRepeat(ref)) problems.push(`${d.key}: ${ref} is an exact repeat — use its canonical reference`);
    if (existingByRef.has(ref) && !m[2]) problems.push(`${d.key}: ${ref} is already ${existingByRef.get(ref)}`);
    if (m[2] && !d.crop) problems.push(`${d.key}: a collage design needs a crop`);
    if (!m[2] && d.crop) problems.push(`${d.key}: only collage keys (REF#x) may be cropped`);
    if (!d.title?.trim()) problems.push(`${d.key}: no title`);
    if (!d.alt?.trim()) problems.push(`${d.key}: no alt text`);
    if (!Array.isArray(d.filters) || !d.filters.length || d.filters.some((f) => !FILTERS.has(f))) problems.push(`${d.key}: invalid filters`);
    if (d.crop) {
      const c = byRef.get(ref);
      const { left, top, width, height } = d.crop;
      if (c && (left < 0 || top < 0 || width <= 0 || height <= 0 || left + width > c.width_px || top + height > c.height_px)) problems.push(`${d.key}: crop outside the ${c.width_px}x${c.height_px} photo`);
    }
  }
  for (const t of duplicates(designs.map((d) => d.title))) problems.push(`two designs share the title "${t}"`);

  // Each reference is used at most once across primaries, alternate views and explicit entries.
  const uses = [];
  for (const x of existingDecisions) uses.push([x.ref, `existing ${x.code}`], ...x.alternates.map((a) => [a, `alternate of ${x.code}`]));
  for (const d of designs) {
    if (!d.crop) uses.push([d.key, `design ${d.key}`]);
    uses.push(...d.alternates.map((a) => [a, `alternate of ${d.key}`]));
  }
  for (const ref of Object.keys(decisions.entries ?? {})) uses.push([ref, "explicit entry"]);
  const usedBy = new Map();
  for (const [ref, what] of uses) {
    if (!byRef.has(ref)) problems.push(`${what}: unknown source reference ${ref}`);
    else if (isRepeat(ref)) problems.push(`${what}: ${ref} is an exact repeat of ${byRef.get(ref).exact_image_repeat_of}`);
    if (usedBy.has(ref)) problems.push(`${ref} is used twice (${usedBy.get(ref)}; ${what})`);
    usedBy.set(ref, what);
  }
  const designKeys = new Set(designs.map((d) => d.key));
  const existingCodes = new Set(existingDecisions.map((x) => x.code));
  for (const [ref, x] of Object.entries(decisions.entries ?? {})) {
    if (!["multi_design_image", "context_only", "needs_clearer_photo"].includes(x.disposition)) problems.push(`${ref}: unsupported disposition ${x.disposition}`);
    if (!x.reason?.trim()) problems.push(`${ref}: no reason`);
    for (const c of x.contents ?? []) if (c.design && !designKeys.has(c.design) && !existingCodes.has(c.design)) problems.push(`${ref}: collage content refers to unknown design ${c.design}`);
  }
  for (const d of designs) {
    const ref = KEY_PATTERN.exec(d.key)?.[1];
    if (d.crop && decisions.entries?.[ref]?.disposition !== "multi_design_image") problems.push(`${d.key}: ${ref} must be listed as a multi_design_image entry`);
  }

  // Every source entry needs a disposition.
  for (const e of entries) if (!isRepeat(e.source_ref) && !usedBy.has(e.source_ref)) problems.push(`${e.source_ref} (${e.source_catalogue} p${e.source_page}) has no disposition`);

  // ---------------------------------------------------------------- codes (stable, never reused)
  const mapCodes = Object.values(idMap.designs);
  for (const code of duplicates(mapCodes)) problems.push(`design-ids.json gives ${code} to two keys`);
  for (const [key, code] of Object.entries(idMap.designs)) {
    if (!CODE_PATTERN.test(code)) problems.push(`design-ids.json: invalid code ${code} for ${key}`);
    if (existingCodes.has(code)) problems.push(`design-ids.json gives existing design ${code} to ${key}`);
  }
  if (problems.length) fail(problems);

  let next = Math.max(0, ...catalogue.designs.map((d) => codeNumber(d.code)), ...mapCodes.map(codeNumber)) + 1;
  const codeFor = new Map();
  for (const d of designs) {
    const code = idMap.designs[d.key] ?? formatCode(next++);
    codeFor.set(d.key, code);
  }
  const resolve = (designOrCode) => codeFor.get(designOrCode) ?? designOrCode;

  // ---------------------------------------------------------------- merge
  const taken = new Set([...reservedSlugs, ...catalogue.designs.map((d) => d.slug)]);
  const copies = []; // { from, to, crop? }
  const imageMap = [];
  const report = { added: [], refreshed: [], kept: [] };
  const merged = new Map(catalogue.designs.map((d) => [d.code, structuredClone(d)]));
  const altPath = (code, ref) => `/images/garlands/views/${code.toLowerCase()}-${candidateFor.get(ref).sha256.slice(0, 8)}.jpg`;
  const altViews = (code, title, alternates, record) => {
    const galleryPaths = new Set((record.gallery ?? []).map((g) => g.path));
    return alternates.flatMap((ref) => {
      const c = candidateFor.get(ref);
      const to = altPath(code, ref);
      copies.push({ from: fileFor.get(c.canonical_source_ref), to });
      imageMap.push({ code, role: "alternate view", source_ref: ref, from: c.asset_file, to });
      if (galleryPaths.has(to)) return [];
      return [{ path: to, width: c.width_px, height: c.height_px, alt: `Another photograph of a garland like the ${title}.`, variants: variantsFor(to, c.width_px) }];
    });
  };

  for (const x of existingDecisions) {
    const record = merged.get(x.code);
    const c = candidateFor.get(x.ref);
    copies.push({ from: fileFor.get(c.canonical_source_ref), to: record.image.path });
    imageMap.push({ code: x.code, role: "main photo", source_ref: x.ref, from: c.asset_file, to: record.image.path });
    record.image = { ...record.image, width: c.width_px, height: c.height_px, variants: variantsFor(record.image.path, c.width_px) };
    record.relatedViews = altViews(x.code, record.title, x.alternates, record);
    record.gallery ??= [];
    report.refreshed.push(x.code);
  }

  for (const d of designs) {
    const code = codeFor.get(d.key);
    const [, ref] = KEY_PATTERN.exec(d.key);
    const c = candidateFor.get(ref);
    let record = merged.get(code);
    if (!record) {
      let slug = slugify(d.title);
      if (taken.has(slug)) slug = `${slug}-${code.toLowerCase()}`;
      if (taken.has(slug)) fail([`slug ${slug} for ${code} is already taken`]);
      taken.add(slug);
      record = {
        code, slug, title: d.title, filters: [...d.filters], filterRecipeVerified: false,
        status: "draft", published: false, readyForSale: false, sellingMode: "enquiry",
        price: NEW_DESIGN_PRICE_INR, currency: "INR", priceConfirmed: true,
        soldUnit: null, length: null, flowerRecipe: null, weightOrThickness: null, leadTime: null, substitutionPolicy: null,
        options: [], photoPermission: "unconfirmed", sampleVerified: false, firstSample: false,
        image: { path: `/images/garlands/${GROUP[d.filters[0]]}/${code.toLowerCase()}-${slug}.jpg`, width: null, height: null, alt: d.alt },
        gallery: [], relatedViews: [],
      };
      report.added.push(code);
    } else {
      // Fill only fields that are absent; every present value is a decision.
      const defaults = { filterRecipeVerified: false, status: "draft", published: false, readyForSale: false, sellingMode: "enquiry", price: NEW_DESIGN_PRICE_INR, currency: "INR", priceConfirmed: true, soldUnit: null, length: null, flowerRecipe: null, weightOrThickness: null, leadTime: null, substitutionPolicy: null, options: [], photoPermission: "unconfirmed", sampleVerified: false, firstSample: false, gallery: [], title: d.title, filters: [...d.filters] };
      for (const [k, v] of Object.entries(defaults)) if (!has(record, k)) record[k] = v;
      report.refreshed.push(code);
    }
    const size = d.crop ? { width: d.crop.width, height: d.crop.height } : { width: c.width_px, height: c.height_px };
    record.image = { ...record.image, ...size, variants: variantsFor(record.image.path, size.width) };
    copies.push({ from: fileFor.get(c.canonical_source_ref), to: record.image.path, crop: d.crop ?? undefined });
    imageMap.push({ code, role: d.crop ? "main photo (unaltered crop of a collage)" : "main photo", source_ref: ref, crop: d.crop ?? undefined, from: c.asset_file, to: record.image.path });
    record.relatedViews = altViews(code, record.title, d.alternates, record);
    merged.set(code, record);
  }
  const touched = new Set([...existingDecisions.map((x) => x.code), ...codeFor.values()]);
  for (const code of merged.keys()) if (!touched.has(code)) report.kept.push(code);

  const records = [...merged.values()].sort((a, b) => codeNumber(a.code) - codeNumber(b.code));
  const final = [];
  for (const code of duplicates(records.map((r) => r.code))) final.push(`duplicate code ${code}`);
  for (const slug of duplicates(records.map((r) => r.slug))) final.push(`duplicate slug ${slug}`);
  for (const slug of records.map((r) => r.slug)) if (reservedSlugs.includes(slug)) final.push(`slug ${slug} collides with an existing product`);
  for (const p of duplicates(records.flatMap((r) => [r.image.path, ...(r.gallery ?? []).map((g) => g.path), ...r.relatedViews.map((v) => v.path)]))) final.push(`photo path used twice: ${p}`);
  if (final.length) fail(final);

  // ---------------------------------------------------------------- coverage audit
  const productId = (code) => `garland-${code.toLowerCase()}`;
  const dispositionOf = new Map();
  for (const x of existingDecisions) {
    dispositionOf.set(x.ref, { disposition: "existing_product", codes: [x.code], reason: x.reviewNote || "Existing product; repository record unchanged." });
    for (const a of x.alternates) dispositionOf.set(a, { disposition: "alternate_view", codes: [x.code], reason: `Provisional alternate view of ${x.code}; not in the gallery until the owner confirms. ${x.reviewNote ?? ""}`.trim() });
  }
  for (const d of designs) {
    const code = codeFor.get(d.key);
    if (!d.crop) dispositionOf.set(d.key, { disposition: "new_product", codes: [code], reason: [d.reviewNote, d.photoFlags.length ? `Photo: ${d.photoFlags.join("; ")}.` : ""].filter(Boolean).join(" ") || "Distinct design." });
    for (const a of d.alternates) dispositionOf.set(a, { disposition: "alternate_view", codes: [code], reason: `Provisional alternate view of ${code}; not in the gallery until the owner confirms.` });
  }
  for (const [ref, x] of Object.entries(decisions.entries ?? {})) {
    const contents = (x.contents ?? []).map((c) => ({ ...c, design: c.design ? resolve(c.design) : null }));
    dispositionOf.set(ref, { disposition: x.disposition, codes: [...new Set(contents.map((c) => c.design).filter(Boolean))], reason: x.reason, contents });
  }
  const templateRows = auditTemplate?.entries ?? entries.map((e) => ({ source_catalogue: e.source_catalogue, source_page: e.source_page, source_ref: e.source_ref, asset_file: e.original_file, exact_image_repeat_of: e.exact_image_repeat_of }));
  const audit = templateRows.map((row) => {
    let result;
    if (row.exact_image_repeat_of) {
      const canonical = dispositionOf.get(row.exact_image_repeat_of);
      result = { disposition: "exact_duplicate", codes: canonical?.codes ?? [], reason: `Exact byte repeat of ${row.exact_image_repeat_of} (${canonical?.disposition ?? "unresolved"}); no separate product.` };
    } else result = dispositionOf.get(row.source_ref);
    return {
      ...row,
      current_known_public_design_code: existingByRef.get(row.source_ref) ?? row.current_known_public_design_code ?? null,
      disposition: result.disposition,
      resulting_public_design_codes: result.codes,
      resulting_product_ids: result.codes.map(productId),
      reason: result.reason,
      ...(result.contents ? { collage_contents: result.contents } : {}),
    };
  });
  const counts = {};
  for (const row of audit) counts[row.disposition] = (counts[row.disposition] ?? 0) + 1;
  const auditOut = {
    completed: new Date().toISOString().slice(0, 10),
    source_photo_entries: entries.length,
    unique_image_files: candidates.length,
    designs: { existing: existingDecisions.length, added_by_full_review: designs.length, total_in_catalogue: records.length },
    dispositions: counts,
    unresolved: audit.filter((r) => r.disposition === "needs_clearer_photo" || (r.collage_contents ?? []).some((c) => !c.design && /clean photo/i.test(c.note ?? ""))).map((r) => ({ source_ref: r.source_ref, source_catalogue: r.source_catalogue, source_page: r.source_page, reason: r.reason })),
    rules: decisions.rules,
    entries: audit,
  };

  // ---------------------------------------------------------------- report
  const byCatalogue = {};
  for (const e of entries) byCatalogue[e.source_catalogue] = (byCatalogue[e.source_catalogue] ?? 0) + 1;
  console.log(`${dryRun ? "[dry run] " : ""}full source: ${entries.length} photo entries (${Object.entries(byCatalogue).map(([k, v]) => `${k} ${v}`).join(", ")}), ${candidates.length} distinct photos — all present and checksum-verified`);
  console.log(`  designs: ${existingDecisions.length} existing + ${designs.length} from the review = ${records.length} in the catalogue (new this run ${report.added.length}, kept though not in this input ${report.kept.length})`);
  console.log(`  dispositions: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  if (report.kept.length) console.log(`  kept, not in this input: ${report.kept.join(", ")}`);

  const output = { _editing: editingNote, importMode: "full", category: catalogue.category, filters: catalogue.filters, designs: records };
  if (dryRun) {
    const current = existsSync(catalogueFile) ? readFileSync(catalogueFile, "utf8") : "";
    console.log(`  catalogue would ${current === JSON.stringify(output, null, 2) + "\n" ? "stay identical" : "change"}; nothing written.`);
    return;
  }

  // ---------------------------------------------------------------- write
  for (const { from, to, crop } of copies) {
    const dest = path.join(publicDir, to.replace(/^\//, ""));
    mkdirSync(path.dirname(dest), { recursive: true });
    if (crop) await sharp(from).extract(crop).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(dest);
    else copyFileSync(from, dest);
    const { width } = await sharp(dest).metadata();
    for (const [w, webPath] of Object.entries(variantsFor(to, width))) {
      await sharp(dest).resize({ width: Number(w) }).webp({ quality: 82 }).toFile(path.join(publicDir, webPath.replace(/^\//, "")));
    }
  }
  for (const [key, code] of codeFor) idMap.designs[key] = code;
  writeFileSync(catalogueFile, JSON.stringify(output, null, 2) + "\n");
  writeFileSync(idMapFile, JSON.stringify(idMap, null, 2) + "\n");
  writeFileSync(path.join(pack, "image-map.json"), JSON.stringify(imageMap, null, 2) + "\n");
  writeFileSync(path.join(pack, "coverage-audit.json"), JSON.stringify(auditOut, null, 2) + "\n");
  console.log(`  written: catalogue, ${copies.length} photos and derivatives, design-ids.json, image-map.json, coverage-audit.json`);
}
