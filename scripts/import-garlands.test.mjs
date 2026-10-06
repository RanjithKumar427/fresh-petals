// Tests for scripts/import-garlands.mjs against temporary fixtures only —
// a generated three-design pack in the OS temp directory. The real catalogue,
// photos and image manifests are never read or written.
//
//   node --test scripts/import-garlands.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "import-garlands.mjs");
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

async function makeFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "garland-import-test-"));
  const pack = path.join(dir, "pack");
  const assets = path.join(pack, "website-assets", "public");
  const photo = async (web, colour) => {
    const file = path.join(assets, web.replace(/^\//, ""));
    mkdirSync(path.dirname(file), { recursive: true });
    await sharp({ create: { width: 600, height: 900, channels: 3, background: colour } }).jpeg().toFile(file);
    return { path: web, width: 600, height: 900, alt: "A test garland photographed on a plain background.", source_sha256: sha(file) };
  };
  const design = async (n, ref, title, group) => ({
    id: `fixture-${ref}`,
    public_design_code: `FP-G00${n}`,
    source_ref: ref,
    working_title: title,
    proposed_filters: [group],
    filter_recipe_verified: false,
    status: "draft",
    published: false,
    ready_for_sale: false,
    selling_mode: "enquiry",
    price: null,
    currency: "INR",
    price_confirmed: false,
    sold_unit: null,
    length: null,
    flower_recipe: null,
    weight_or_thickness: null,
    lead_time: null,
    substitution_policy: null,
    options: [],
    photo_permission: "unconfirmed",
    sample_verified: false,
    primary_image: await photo(`/images/garlands/${group}/${ref}.jpg`, { r: 200, g: 20 * n, b: 40 }),
  });
  const source = {
    category: { key: "garlands", label: "Garlands / Poola Mala" },
    proposed_filters: [{ key: "rose", label: "Rose" }, { key: "lotus", label: "Lotus" }],
    designs: [await design(1, "src-a", "Red Test Garland", "rose"), await design(2, "src-b", "Pink Test Garland", "rose"), await design(3, "src-c", "Lotus Test Garland", "lotus")],
    related_view_candidates: [{ source_ref: "src-d", proposed_related_design_id: "fixture-src-c", relationship_confirmed: false, published: false, image: await photo("/images/garlands/lotus/src-d.jpg", { r: 10, g: 90, b: 10 }) }],
    first_sample_design_ids: ["fixture-src-a", "fixture-src-b"],
  };
  mkdirSync(path.join(pack, "website-data"), { recursive: true });
  const sourceFile = path.join(pack, "website-data", "garlands-drafts.json");
  writeFileSync(sourceFile, JSON.stringify(source, null, 2));
  const catalogue = path.join(dir, "garlandDrafts.json");
  const flags = ["--pack", pack, "--catalogue", catalogue, "--public", path.join(dir, "public")];
  const run = (...extra) => execFileSync(process.execPath, [script, ...flags, ...extra], { encoding: "utf8" });
  const runRaw = (...extra) => spawnSync(process.execPath, [script, ...flags, ...extra], { encoding: "utf8" });
  const read = () => JSON.parse(readFileSync(catalogue, "utf8"));
  const write = (data) => writeFileSync(catalogue, JSON.stringify(data, null, 2) + "\n");
  const editSource = (fn) => {
    const data = JSON.parse(readFileSync(sourceFile, "utf8"));
    fn(data);
    writeFileSync(sourceFile, JSON.stringify(data, null, 2));
  };
  return { dir, pack, catalogue, run, runRaw, read, write, editSource, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test("first import creates drafts with unknown facts left null", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    assert.deepEqual(data.designs.map((d) => d.code), ["FP-G001", "FP-G002", "FP-G003"]);
    for (const d of data.designs) {
      assert.equal(d.price, null);
      assert.equal(d.priceConfirmed, false);
      assert.equal(d.published, false);
      assert.equal(d.sellingMode, "enquiry");
      assert.deepEqual(d.gallery, []);
      assert.ok(existsSync(path.join(f.dir, "public", d.image.path)));
      assert.deepEqual(Object.keys(d.image.variants), ["240", "480"], "derivatives below the 600px original, recorded on the design");
      for (const variant of Object.values(d.image.variants)) assert.ok(existsSync(path.join(f.dir, "public", variant)));
    }
    assert.equal(data.designs[2].relatedViews.length, 1, "candidate kept as provisional");
    assert.ok(!JSON.stringify(data).includes("src-a"), "no source references in the catalogue");
  } finally {
    f.cleanup();
  }
});

test("manual edits, deliberate blanks and confirmed galleries survive repeated imports", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    const [g1, g2, g3] = data.designs;
    Object.assign(g1, { price: 5000, priceConfirmed: true, title: "Owner's Red Garland", length: "1.5 m", soldUnit: "pair", options: [{ label: "Finish", values: ["Gold tassels"] }] });
    Object.assign(g2, { price: 0, firstSample: false, published: false, options: [], flowerRecipe: null, filters: [], sellingMode: "enquiry" });
    g3.gallery = [g3.relatedViews[0]]; // owner confirmed the related view
    g3.relatedViews = [];
    f.write(data);
    const edited = readFileSync(f.catalogue, "utf8");

    f.run();
    f.run();
    const after = f.read();
    assert.equal(after.designs.length, 3, "no duplicates");
    assert.equal(new Set(after.designs.map((d) => d.slug)).size, 3);
    const [a1, a2, a3] = after.designs;
    assert.equal(a1.price, 5000);
    assert.equal(a1.priceConfirmed, true);
    assert.equal(a1.title, "Owner's Red Garland");
    assert.equal(a1.length, "1.5 m");
    assert.equal(a1.soldUnit, "pair");
    assert.deepEqual(a1.options, [{ label: "Finish", values: ["Gold tassels"] }]);
    assert.equal(a2.price, 0, "zero kept");
    assert.equal(a2.firstSample, false, "false kept although the source lists it as a first sample");
    assert.deepEqual(a2.options, []);
    assert.deepEqual(a2.filters, [], "empty array kept although the source proposes a filter");
    assert.equal(a2.flowerRecipe, null);
    assert.equal(a3.gallery.length, 1, "confirmed gallery kept");
    assert.equal(a3.relatedViews.length, 0, "confirmed photo not re-listed as provisional");
    assert.equal(readFileSync(f.catalogue, "utf8"), edited, "re-import is a no-op on an edited catalogue");
  } finally {
    f.cleanup();
  }
});

test("source metadata refreshes without touching decisions", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    data.designs[0].price = 5000;
    data.designs[0].image.alt = "Owner-written alt text";
    f.write(data);
    // The supplier pack is re-issued with a larger photo for FP-G001.
    const file = path.join(f.pack, "website-assets", "public", "images", "garlands", "rose", "src-a.jpg");
    await sharp({ create: { width: 800, height: 1200, channels: 3, background: "#aa2244" } }).jpeg().toFile(file + ".new");
    writeFileSync(file, readFileSync(file + ".new"));
    f.editSource((s) => {
      s.designs[0].primary_image.source_sha256 = sha(file);
      s.designs[0].working_title = "Supplier renamed this";
    });
    f.run();
    const g1 = f.read().designs[0];
    assert.equal(g1.image.width, 800);
    assert.equal(g1.image.height, 1200);
    assert.equal(g1.image.alt, "Owner-written alt text");
    assert.equal(g1.title, "Red Test Garland", "title is a manual field");
    assert.equal(g1.price, 5000);
  } finally {
    f.cleanup();
  }
});

test("designs missing from the source are kept; new ones arrive as drafts", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const data = f.read();
    data.designs[1].price = 4200;
    f.write(data);
    f.editSource((s) => {
      s.designs.splice(1, 1); // FP-G002 dropped from the pack
      const extra = structuredClone(s.designs[0]);
      Object.assign(extra, { id: "fixture-src-e", public_design_code: "FP-G004", working_title: "Red Test Garland" });
      s.designs.push(extra);
    });
    const out = f.run();
    assert.match(out, /kept, not in source: FP-G002/);
    const after = f.read();
    assert.deepEqual(after.designs.map((d) => d.code), ["FP-G001", "FP-G002", "FP-G003", "FP-G004"]);
    assert.equal(after.designs[1].price, 4200);
    const g4 = after.designs[3];
    assert.equal(g4.published, false);
    assert.equal(g4.price, null);
    assert.equal(g4.slug, "red-test-garland-fp-g004", "slug collision resolved, not duplicated");
  } finally {
    f.cleanup();
  }
});

test("duplicate or conflicting IDs and codes are rejected before writing", async () => {
  const f = await makeFixture();
  try {
    f.run();
    const before = readFileSync(f.catalogue, "utf8");

    f.editSource((s) => { s.designs[1].public_design_code = "FP-G001"; });
    let result = f.runRaw();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate source code FP-G001/);
    assert.equal(readFileSync(f.catalogue, "utf8"), before);

    f.editSource((s) => { s.designs[1].public_design_code = "FP-G002"; s.designs[1].id = s.designs[0].id; });
    result = f.runRaw();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate source id/);

    f.editSource((s) => { s.designs[1].id = "fixture-src-b"; s.designs[0].public_design_code = "FP-G009"; });
    result = f.runRaw();
    assert.notEqual(result.status, 0, "an id may not move to another code");
    assert.match(result.stderr, /was FP-G001; the source now says FP-G009/);
    assert.equal(readFileSync(f.catalogue, "utf8"), before, "catalogue untouched by every rejected run");

    f.editSource((s) => { s.designs[0].public_design_code = "FP-G001"; });
    const data = JSON.parse(before);
    data.designs.push(structuredClone(data.designs[0]));
    f.write(data);
    result = f.runRaw();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /catalogue has duplicate code FP-G001/);
  } finally {
    f.cleanup();
  }
});

test("--dry-run writes nothing", async () => {
  const f = await makeFixture();
  try {
    const out = f.run("--dry-run");
    assert.match(out, /\[dry run\]/);
    assert.ok(!existsSync(f.catalogue));
    assert.ok(!existsSync(path.join(f.dir, "public")));
    assert.ok(!existsSync(path.join(f.pack, "design-ids.json")));
  } finally {
    f.cleanup();
  }
});
