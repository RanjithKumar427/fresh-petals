// Builds the homepage campaign photographs (petal crops: src/components/home/PetalHero.astro) from
// the originals in src/assets/hero/ and records them in
// src/data/heroCampaignImages.json. Run: node scripts/hero-campaign-images.mjs
//
// Each original (1672 x 941) is kept untouched. The script only resizes it
// (never larger than the original) to AVIF and WebP for the full scene, and
// cuts one fixed crop per photograph for the small photo print that links to
// that campaign. PRINT boxes are pixel boxes measured on the original; they
// isolate the flowers already in the photograph and change nothing else.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES = path.join(ROOT, "src/assets/hero");
const OUT = path.join(ROOT, "public/images/hero");
const WIDTHS = [640, 960, 1280, 1672];
const PRINT_WIDTHS = [180, 360];
const PETAL_WIDTHS = [360, 540, 705];

// PETAL boxes (3:4, full height) frame each photograph's flowers for the
// homepage's three-petal scene (src/components/home/PetalHero.astro): the
// narrow lower centre of a petal shows the stems, the garland ends or the
// basket; the wide upper part the flowers.
const CAMPAIGNS = [
  { name: "hero-bouquets", print: { left: 760, top: 30, width: 700, height: 840 }, petal: { left: 745, top: 0, width: 705, height: 940 } },
  { name: "hero-garlands", print: { left: 860, top: 110, width: 640, height: 768 }, petal: { left: 760, top: 0, width: 705, height: 940 } },
  { name: "hero-pooja", print: { left: 850, top: 190, width: 620, height: 744 }, petal: { left: 790, top: 0, width: 705, height: 940 } },
];

const formats = {
  avif: (image) => image.avif({ quality: 56, effort: 6 }),
  webp: (image) => image.webp({ quality: 80, effort: 6, smartSubsample: true }),
};

fs.mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const { name, print, petal } of CAMPAIGNS) {
  const source = path.join(SOURCES, `${name}.png`);
  const { width, height } = await sharp(source).metadata();
  const entry = { width, height, avif: {}, webp: {}, print: { width: print.width, height: print.height, crop: print, avif: {}, webp: {} }, petal: { width: petal.width, height: petal.height, crop: petal, avif: {}, webp: {} } };
  for (const [format, encode] of Object.entries(formats)) {
    for (const w of WIDTHS.filter((w) => w <= width)) {
      const file = `${name}-${w}w.${format}`;
      if (!fs.existsSync(path.join(OUT, file))) await encode(sharp(source).resize({ width: w, withoutEnlargement: true })).toFile(path.join(OUT, file));
      entry[format][w] = `/images/hero/${file}`;
    }
    for (const w of PRINT_WIDTHS) {
      const file = `${name}-print-${w}w.${format}`;
      if (!fs.existsSync(path.join(OUT, file))) await encode(sharp(source).extract(print).resize({ width: w })).toFile(path.join(OUT, file));
      entry.print[format][w] = `/images/hero/${file}`;
    }
    for (const w of PETAL_WIDTHS.filter((w) => w <= petal.width)) {
      const file = `${name}-petal-${w}w.${format}`;
      if (!fs.existsSync(path.join(OUT, file))) await encode(sharp(source).extract(petal).resize({ width: w })).toFile(path.join(OUT, file));
      entry.petal[format][w] = `/images/hero/${file}`;
    }
  }
  manifest[name] = entry;
}
fs.writeFileSync(path.join(ROOT, "src/data/heroCampaignImages.json"), JSON.stringify(manifest, null, 2) + "\n");
for (const file of fs.readdirSync(OUT).sort()) console.log(file, `${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB`);
