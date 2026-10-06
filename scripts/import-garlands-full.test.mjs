// Tests for the full-catalogue mode of scripts/import-garlands.mjs (--full),
// against temporary fixtures only. The real catalogue, photos and source
// packs are never read or written.
//
//   node --test scripts/import-garlands-full.test.mjs
//
// Fixture: six source entries — an existing design (A-001), a new design
// (A-002) with an alternate view (A-003) and an exact repeat (A-004), a
// two-design collage (A-005, one design cropped) and a context-only photo
// (A-006). The catalogue starts with FP-G001 (A-001) and a manual FP-G002
// that is not in the source at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "import-garlands.mjs");
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function makeFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "garland-full-test-"));
  const pack = path.join(dir, "full");
  const photo = async (name, colour, width = 400, height = 800) => {
    const file = path.join(pack, "originals", name);
    mkdirSync(path.dirname(file), { recursive: true });
    await sharp({ create: { width, height, channels: 3, background: colour } }).jpeg().toFile(file);
    return { asset_file: `originals/${name}`, sha256: sha(file), width_px: width, height_px: height };
  };
  const p1 = await photo("a-001.jpg", "#aa0000");
  const p2 = await photo("a-002.jpg", "#00aa00");
  const p3 = await photo("a-003.jpg", "#00aa44");
  const p5 = await photo("a-005.jpg", "#0000aa", 600, 800);
  const p6 = await photo("a-006.jpg", "#888888");
  const entry = (ref, p, page, repeatOf = null) => ({ source_catalogue: "rose", source_page: page, source_ref: ref, original_file: p.asset_file, exact_image_repeat_of: repeatOf, sha256: p.sha256, width_px: p.width_px, height_px: p.height_px });
  const index = { entries: [entry("A-001", p1, 1), entry("A-002", p2, 2), entry("A-003", p3, 3), entry("A-004", p2, 4, "A-002"), entry("A-005", p5, 5), entry("A-006", p6, 6)] };
  const cand = (ref, p, refs = [ref]) => ({ canonical_source_ref: ref, source_refs: refs, ...p });
  const candidates = { candidates: [cand("A-001", p1), cand("A-002", p2, ["A-002", "A-004"]), cand("A-003", p3), cand("A-005", p5), cand("A-006", p6)] };
  const existingMap = { existing_designs: [{ public_design_code: "FP-G001", source_ref: "A-001", photo_sha256: p1.sha256 }] };
  const decisions = {
    rules: ["fixture"],
    existing: [{ ref: "A-001", code: "FP-G001", alternates: [] }],
    designs: [
      { key: "A-002", title: "Green Test Garland", filters: ["rose"], alt: "A green test garland.", alternates: ["A-003"], crop: null, photoFlags: [], reviewNote: "" },
      { key: "A-005#b", title: "Blue Test Garland", filters: ["designer-mixed"], alt: "A blue test garland.", alternates: [], crop: { left: 300, top: 0, width: 300, height: 800 }, photoFlags: [], reviewNote: "" },
    ],
    entries: {
      "A-005": { disposition: "multi_design_image", contents: [{ area: "left", design: "FP-G001" }, { area: "right", design: "A-005#b" }], reason: "Two garlands." },
      "A-006": { disposition: "context_only", reason: "People only." },
    },
  };
  const files = { "catalogue-index.json": index, "source-candidates.json": candidates, "existing-design-map.json": existingMap, "review-decisions.json": decisions };
  for (const [name, data] of Object.entries(files)) writeFileSync(path.join(pack, name), JSON.stringify(data, null, 2));
  const record = (code, slug, title) => ({
    code, slug, title, filters: ["rose"], filterRecipeVerified: false, status: "draft", published: false, readyForSale: false,
    sellingMode: "enquiry", price: 5000, currency: "INR", priceConfirmed: true, soldUnit: null, length: null, flowerRecipe: null,
    weightOrThickness: null, leadTime: null, substitutionPolicy: null, options: [], photoPermission: "unconfirmed", sampleVerified: false,
    firstSample: true, image: { path: `/images/garlands/rose/${code.toLowerCase()}-${slug}.jpg`, width: 1, height: 1, alt: "Owner alt." },
    gallery: [], relatedViews: [],
  });
  const catalogue = path.join(dir, "garlandDrafts.json");
  const start = { category: { key: "garlands", label: "Garlands" }, filters: [], designs: [record("FP-G001", "red-one", "Red One"), { ...record("FP-G002", "manual-one", "Manual One"), price: 0 }] };
  writeFileSync(catalogue, JSON.stringify(start, null, 2) + "\n");
  const products = path.join(dir, "products.ts");
  writeFileSync(products, 'export const p = [{ slug: "blue-test-garland" }];\n');
  const flags = ["--full", pack, "--catalogue", catalogue, "--public", path.join(dir, "public"), "--products", products];
  const run = (...extra) => execFileSync(process.execPath, [script, ...flags, ...extra], { encoding: "utf8" });
  const runRaw = (...extra) => spawnSync(process.execPath, [script, ...flags, ...extra], { encoding: "utf8" });
  const read = () => JSON.parse(readFileSync(catalogue, "utf8"));
  const editDecisions = (fn) => {
    const file = path.join(pack, "review-decisions.json");
    const data = JSON.parse(readFileSync(file, "utf8"));
    fn(data);
    writeFileSync(file, JSON.stringify(data, null, 2));
  };
  return { dir, pack, catalogue, run, runRaw, read, editDecisions, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("adds reviewed designs after the highest code at INR 5,000 and keeps everything else", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    assert.equal(data.importMode, "full");
    assert.deepEqual(data.designs.map((d) => d.code), ["FP-G001", "FP-G002", "FP-G003", "FP-G004"]);
    const [g1, g2, g3, g4] = data.designs;
    assert.equal(g1.title, "Red One");
    assert.equal(g1.firstSample, true, "existing record untouched");
    assert.equal(g1.image.alt, "Owner alt.");
    assert.equal(g1.image.width, 400, "photo metadata refreshed");
    assert.equal(g2.price, 0, "a design missing from the input is kept as is");
    for (const g of [g3, g4]) {
      assert.equal(g.price, 5000);
      assert.equal(g.currency, "INR");
      assert.equal(g.priceConfirmed, true);
      assert.equal(g.published, false);
      assert.equal(g.readyForSale, false);
      assert.equal(g.sellingMode, "enquiry");
      assert.equal(g.photoPermission, "unconfirmed");
      assert.equal(g.soldUnit, null);
      assert.equal(g.length, null);
    }
    assert.equal(g3.relatedViews.length, 1, "alternate view kept provisional");
    assert.deepEqual(g3.gallery, []);
    assert.equal(g4.slug, "blue-test-garland-fp-g004", "slug of an existing product is not reused");
    assert.equal(g4.image.width, 300, "collage design cropped");
    const { width } = await sharp(path.join(f.dir, "public", g4.image.path)).metadata();
    assert.equal(width, 300);
    const audit = JSON.parse(readFileSync(path.join(f.pack, "coverage-audit.json"), "utf8"));
    assert.deepEqual(audit.entries.map((e) => e.disposition), ["existing_product", "new_product", "alternate_view", "exact_duplicate", "multi_design_image", "context_only"]);
    assert.deepEqual(audit.entries[4].resulting_public_design_codes, ["FP-G001", "FP-G004"]);
    assert.deepEqual(audit.entries[3].resulting_public_design_codes, ["FP-G003"], "repeat points at the canonical design");
    assert.ok(!JSON.stringify(data).includes("A-00"), "no source references in the catalogue");
  } finally {
    f.cleanup();
  }
});

test("re-imports keep edits and deliberate blanks, and never renumber or duplicate", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    Object.assign(data.designs[2], { price: 4500, title: "Owner Title", length: "1.2 m", options: [], filters: [], soldUnit: null, priceConfirmed: false });
    writeFileSync(f.catalogue, JSON.stringify(data, null, 2) + "\n");
    // The first run after an edit only regenerates provisional alternate-view
    // alt text from the new title; after that, imports change nothing.
    f.run();
    const once = f.read();
    assert.equal(once.designs[2].price, 4500);
    assert.equal(once.designs[2].title, "Owner Title");
    assert.equal(once.designs[2].length, "1.2 m");
    assert.equal(once.designs[2].relatedViews[0].alt, "Another photograph of a garland like the Owner Title.");
    const settled = readFileSync(f.catalogue, "utf8");
    f.run();
    f.run();
    assert.equal(readFileSync(f.catalogue, "utf8"), settled, "repeat imports are no-ops");

    // A later review drops a design (kept) and adds one (next free code).
    f.editDecisions((d) => {
      d.designs = d.designs.filter((x) => x.key !== "A-005#b");
      d.entries["A-005"].contents = [{ area: "left", design: "FP-G001" }, { area: "right", design: null, note: "clean photo needed" }];
      d.designs.push({ key: "A-006", title: "Grey Test Garland", filters: ["lotus"], alt: "A grey test garland.", alternates: [], crop: null, photoFlags: [], reviewNote: "" });
      delete d.entries["A-006"];
    });
    const out = f.run();
    assert.match(out, /kept, not in this input: FP-G002, FP-G004/);
    const after = f.read();
    assert.deepEqual(after.designs.map((d) => d.code), ["FP-G001", "FP-G002", "FP-G003", "FP-G004", "FP-G005"]);
    assert.equal(after.designs[2].price, 4500);
    assert.equal(after.designs[2].title, "Owner Title");
    assert.deepEqual(after.designs[2].filters, []);
    assert.equal(after.designs[2].priceConfirmed, false);
  } finally {
    f.cleanup();
  }
});

test("missing dispositions and conflicting identities stop before anything is written", async () => {
  const f = await makeFixture();
  try {
    const before = readFileSync(f.catalogue, "utf8");
    f.editDecisions((d) => { delete d.entries["A-006"]; });
    let r = f.runRaw();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /A-006 \(rose p6\) has no disposition/);

    f.editDecisions((d) => { d.entries["A-006"] = { disposition: "context_only", reason: "x" }; d.designs[0].alternates.push("A-006"); });
    r = f.runRaw();
    assert.match(r.stderr, /A-006 is used twice/);

    f.editDecisions((d) => { d.designs[0].alternates = ["A-004"]; });
    r = f.runRaw();
    assert.match(r.stderr, /A-004 is an exact repeat/);

    f.editDecisions((d) => { d.designs[0].alternates = ["A-003"]; d.existing[0].code = "FP-G002"; });
    r = f.runRaw();
    assert.match(r.stderr, /review lists A-001 as FP-G002/);
    assert.equal(readFileSync(f.catalogue, "utf8"), before, "nothing written by any rejected run");
  } finally {
    f.cleanup();
  }
});

test("--dry-run writes nothing, and the shortlist import cannot revert an expanded catalogue", async () => {
  const f = await makeFixture();
  try {
    const before = readFileSync(f.catalogue, "utf8");
    assert.match(f.run("--dry-run"), /\[dry run\]/);
    assert.equal(readFileSync(f.catalogue, "utf8"), before);

    f.run();
    const shortlist = path.join(f.dir, "shortlist");
    mkdirSync(path.join(shortlist, "website-data"), { recursive: true });
    writeFileSync(path.join(shortlist, "website-data", "garlands-drafts.json"), JSON.stringify({ designs: [] }));
    const r = spawnSync(process.execPath, [script, "--pack", shortlist, "--catalogue", f.catalogue], { encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /expanded from the full source pack/);
  } finally {
    f.cleanup();
  }
});
