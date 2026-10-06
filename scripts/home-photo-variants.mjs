// Builds WebP variants of the owner's homepage photographs (never larger
// than the original — no upscaling) and records them in
// src/data/homePhotoVariants.json. Run: node scripts/home-photo-variants.mjs
//
// CROPS are fixed editorial crops of an original (pixel boxes measured on
// the original file). They only remove background or isolate a detail
// that is already in the photograph; the manifest records the crop's own
// pixel dimensions, so width/height/srcset stay truthful.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const PHOTOS = [
  "hero-bouquets",
  "hero-main-banner",
  "banner-bouquet",
  "banner-pooja",
  "pooja-flowers",
  "bouquet-1",
  "bouquet-6",
  "cat-bouquets",
  "rose-bouquet",
  "cat-pooja",
  "jasmine",
  "occasion-wedding",
  "occasion-event",
  "cat-basket",
  "cat-vases",
  "cat-plant",
  "cat-candle",
];
const WIDTHS = [360, 480, 600, 720];

const CROPS = [
  // Wrapped pink bouquet: drops the window and curtain above it; keeps every
  // flower head, the wrap and the ribbon.
  // It is the homepage LCP image, so it is encoded a little lighter.
  { key: "bouquet-1#hero", source: "bouquet-1", box: { left: 0, top: 186, width: 735, height: 992 }, webp: { quality: 74, effort: 6, smartSubsample: true } },
  // Tulip heads from the same photograph (hero foreground detail).
  { key: "bouquet-1#tulips", source: "bouquet-1", box: { left: 110, top: 290, width: 360, height: 360 }, widths: [180, 240] },
  // The centre of the kraft-wrapped bouquet, and its wrap and twine.
  { key: "banner-bouquet#centre", source: "banner-bouquet", box: { left: 230, top: 450, width: 380, height: 300 }, widths: [240] },
  { key: "banner-bouquet#tie", source: "banner-bouquet", box: { left: 190, top: 1010, width: 360, height: 290 }, widths: [240] },
  // Hand and flowers, without the empty meadow below the stems.
  { key: "bouquet-6#closing", source: "bouquet-6", box: { left: 0, top: 50, width: 640, height: 900 } },
];

const manifest = {};
for (const name of PHOTOS) {
  const source = path.join(ROOT, "public/images", `${name}.jpg`);
  const { width, height } = await sharp(source).metadata();
  const entries = [];
  for (const w of [...WIDTHS.filter((w) => w < width - 40), width]) {
    const file = `${name}-${w}w.webp`;
    const out = path.join(ROOT, "public/images", file);
    if (!fs.existsSync(out)) {
      await sharp(source).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    }
    entries.push([w, `/images/${file}`]);
  }
  manifest[`/images/${name}.jpg`] = { width, height, variants: Object.fromEntries(entries) };
}
for (const crop of CROPS) {
  const source = path.join(ROOT, "public/images", `${crop.source}.jpg`);
  const { width, height } = crop.box;
  const slug = crop.key.replace("#", "-");
  const entries = [];
  for (const w of [...(crop.widths ?? WIDTHS).filter((w) => w < width - 40), width]) {
    const file = `${slug}-${w}w.webp`;
    const out = path.join(ROOT, "public/images", file);
    if (!fs.existsSync(out)) {
      await sharp(source).extract(crop.box).resize({ width: w, withoutEnlargement: true }).webp(crop.webp ?? { quality: 82 }).toFile(out);
    }
    entries.push([w, `/images/${file}`]);
  }
  manifest[`/images/${crop.key}`] = { width, height, crop: crop.box, variants: Object.fromEntries(entries) };
}
fs.writeFileSync(path.join(ROOT, "src/data/homePhotoVariants.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(Object.entries(manifest).map(([k, v]) => `${k} ${v.width}x${v.height} -> ${Object.keys(v.variants).join("/")}`).join("\n"));
