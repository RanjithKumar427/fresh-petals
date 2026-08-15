// Discovery Architecture Hardening (Phase 5), Workstream C milestone —
// generates src/data/imageVariants.json, a static lookup of resized
// derivative files for every product image, additively -- it never
// overwrites or moves an original. Same traversal pattern as
// scripts/generate-image-dimensions.mjs (Phase 3): parse
// productCatalog.ts for every `image: "..."` string, resolve it under
// public/, read it with `sharp` (already a direct dependency, confirmed
// in package.json before writing this script -- not a new one).
//
// Why these three widths: the Phase 4 audit measured real rendered
// column widths across every breakpoint the discovery grid uses --
// roughly 156-195px at the narrowest mobile tier, 235-367px across
// tablet, 228-248px on desktop (capped by the grid's max-w-7xl). 240 /
// 480 / 720 covers that whole range at both 1x and 2x density without
// generating "dozens of unnecessary variants" -- three sizes, not a
// full responsive-image ladder.
//
// Every derivative is written as .webp regardless of the source format
// (a few originals are .jpg) purely for smaller output size; the
// original file and its own <img src> fallback are completely untouched
// -- DiscoveryPostCard.astro only ADDS a srcset/sizes pair pointing at
// these when they exist, and falls back to plain <img src> exactly as
// before when they don't.
//
// Run manually whenever product photography changes:
//
//   node scripts/generate-image-derivatives.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalogPath = path.join(rootDir, "src/data/productCatalog.ts");
const outputPath = path.join(rootDir, "src/data/imageVariants.json");
const publicDir = path.join(rootDir, "public");

const DERIVATIVE_WIDTHS = [240, 480, 720];

const catalogSource = readFileSync(catalogPath, "utf8");
const imagePaths = new Set();
const imageRe = /image: "([^"]+)"/g;
let match;
while ((match = imageRe.exec(catalogSource))) {
  imagePaths.add(match[1]);
}

const variants = {};
const missing = [];
const failed = [];

for (const imagePath of imagePaths) {
  const absoluteSourcePath = path.join(publicDir, imagePath.replace(/^\//, ""));

  if (!existsSync(absoluteSourcePath)) {
    missing.push(imagePath);
    continue;
  }

  const parsed = path.parse(imagePath);
  const entry = {};

  for (const width of DERIVATIVE_WIDTHS) {
    const derivativeRelativePath = path.posix.join(
      parsed.dir.replaceAll("\\", "/"),
      `${parsed.name}-${width}w.webp`
    );
    const derivativeAbsolutePath = path.join(publicDir, derivativeRelativePath.replace(/^\//, ""));

    try {
      mkdirSync(path.dirname(derivativeAbsolutePath), { recursive: true });

      await sharp(absoluteSourcePath)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(derivativeAbsolutePath);

      entry[width] = derivativeRelativePath;
    } catch (error) {
      failed.push({ imagePath, width, error: String(error) });
    }
  }

  if (Object.keys(entry).length > 0) {
    variants[imagePath] = entry;
  }
}

writeFileSync(outputPath, JSON.stringify(variants, null, 2) + "\n");

console.log(
  `Wrote derivatives for ${Object.keys(variants).length} image(s) (${DERIVATIVE_WIDTHS.join("/")}w) to ${outputPath}`
);

if (missing.length > 0) {
  console.log(`\nWARNING -- ${missing.length} referenced image(s) could not be read:`);
  missing.forEach((p) => console.log(`  ${p}`));
}

if (failed.length > 0) {
  console.log(`\nWARNING -- ${failed.length} derivative(s) failed to generate:`);
  failed.forEach(({ imagePath, width, error }) => console.log(`  ${imagePath} @ ${width}w: ${error}`));
}
