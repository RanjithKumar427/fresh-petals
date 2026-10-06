// Image sizes and WebP derivatives for static storefront pages (the shared
// manifests). Garland photos are not listed here: garlands are rendered live
// and carry their own sizes and derivatives (see garlandPhotoSrcset in
// src/data/garlandRules.ts).
import imageVariantsData from "./imageVariants.json";
import imageDimensionsData from "./imageDimensions.json";

type Dimensions = Record<string, { width: number; height: number }>;
type Variants = Record<string, Record<string, string>>;

export const photoDimensions: Dimensions = imageDimensionsData as Dimensions;
export const photoVariants: Variants = imageVariantsData as Variants;

/** srcset for a photo: its derivatives plus the original at its own width. */
export function photoSrcset(path: string): string | undefined {
  const variants = photoVariants[path];
  if (!variants) return undefined;
  const width = photoDimensions[path]?.width;
  return [...Object.entries(variants).map(([w, p]) => `${p} ${w}w`), ...(width ? [`${path} ${width}w`] : [])].join(", ");
}
