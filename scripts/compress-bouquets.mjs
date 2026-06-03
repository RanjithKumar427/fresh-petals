import fs from "fs";
import path from "path";
import sharp from "sharp";

const inputDir = "C:/Users/ranji/Downloads/boquets/newb";
const outputDir = "C:/Users/ranji/Downloads/fresh-petals/public/images/bouquets";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const files = fs
  .readdirSync(inputDir)
  .filter((file) => file.toLowerCase().endsWith(".png"));

for (const file of files) {
  const inputPath = path.join(inputDir, file);

  const outputFileName = file.replace(/\.png$/i, ".webp");
  const outputPath = path.join(outputDir, outputFileName);

  await sharp(inputPath)
    .resize({
      width: 1200,
      withoutEnlargement: true,
    })
    .webp({
      quality: 85,
      effort: 6,
    })
    .toFile(outputPath);

  const originalSize = fs.statSync(inputPath).size / 1024;
  const compressedSize = fs.statSync(outputPath).size / 1024;

  console.log(
    `${file} -> ${outputFileName} | ${originalSize.toFixed(0)} KB -> ${compressedSize.toFixed(0)} KB`
  );
}

console.log("Done. Compressed bouquet images saved to public/images/bouquets");