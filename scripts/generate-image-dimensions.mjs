// Phase 3 (Physical Discovery Feed) milestone — generates
// src/data/imageDimensions.json, a static lookup of each product image's
// real intrinsic pixel dimensions. Consumed by DiscoveryPostCard.astro to
// set width/height attributes on the <img> tag, which is the standard,
// zero-JS, zero-dependency browser mechanism for reserving the correct
// aspect-ratio box before the image decodes (per the CSS spec's
// "aspect-ratio from width/height attributes" behavior, supported in all
// modern browsers) -- this is what stops the masonry from reflowing/
// reshuffling as each image loads, without forcing every card to a
// synthetic fixed ratio.
//
// Uses `sharp`, already present in node_modules as a transitive build
// dependency (confirmed before writing this script) -- not a new
// dependency added to package.json. Run manually whenever product
// photography changes:
//
//   node scripts/generate-image-dimensions.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalogPath = path.join(rootDir, "src/data/productCatalog.ts");
const outputPath = path.join(rootDir, "src/data/imageDimensions.json");
const publicDir = path.join(rootDir, "public");

const catalogSource = readFileSync(catalogPath, "utf8");
const imagePaths = new Set();
const imageRe = /image: "([^"]+)"/g;
let match;
while ((match = imageRe.exec(catalogSource))) {
  imagePaths.add(match[1]);
}

const dimensions = {};
const missing = [];

for (const imagePath of imagePaths) {
  const absolutePath = path.join(publicDir, imagePath.replace(/^\//, ""));

  if (!existsSync(absolutePath)) {
    missing.push(imagePath);
    continue;
  }

  const metadata = await sharp(absolutePath).metadata();

  if (!metadata.width || !metadata.height) {
    missing.push(imagePath);
    continue;
  }

  dimensions[imagePath] = { width: metadata.width, height: metadata.height };
}

writeFileSync(outputPath, JSON.stringify(dimensions, null, 2) + "\n");

console.log(`Wrote ${Object.keys(dimensions).length} image dimensions to ${outputPath}`);

if (missing.length > 0) {
  console.log(`\nWARNING -- ${missing.length} referenced image(s) could not be read:`);
  missing.forEach((p) => console.log(`  ${p}`));
}
