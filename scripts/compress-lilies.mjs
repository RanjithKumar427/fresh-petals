import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

const inputDir = path.join(process.cwd(), "public", "images", "lilies");

const files = await fs.readdir(inputDir);

const pngFiles = files.filter((file) => file.toLowerCase().endsWith(".png"));

if (pngFiles.length === 0) {
  console.log("No PNG files found in:", inputDir);
  process.exit(0);
}

for (const file of pngFiles) {
  const inputPath = path.join(inputDir, file);
  const outputFile = file.replace(/\.png$/i, ".webp");
  const outputPath = path.join(inputDir, outputFile);

  await sharp(inputPath)
    .resize({
      width: 1400,
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 6,
    })
    .toFile(outputPath);

  console.log(`Compressed: ${file} -> ${outputFile}`);
}

console.log("Lily image compression completed.");