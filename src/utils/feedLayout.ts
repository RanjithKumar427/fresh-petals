// Phase 1 (Discovery System Hardening), Stage 2b -- extracted from
// DiscoveryFeed.astro so saved.astro's migration off the older CSS-columns
// layout reuses the exact same grid math instead of re-deriving it a
// second time. DiscoveryFeed.astro's own header comment has the full
// measurement history (three iterations, each caught by live measurement:
// a single reference over-reserving mobile space, then row-gap being
// double-counted inside `grid-row: span N`, then a single mobile/desktop
// split still cropping images in the 640-767px band) -- that history isn't
// duplicated here, only the resulting constants and formula, which both
// surfaces must now share byte-for-byte to stay correct.
export const ROW_UNIT_PX = 4;
export const CAPTION_ROWS = 19;
export const MOBILE_COLUMN_WIDTH = 195; // real range ~164-303px across <640px viewports
export const TABLET_COLUMN_WIDTH = 310; // real range ~304-367px across 640-767px viewports
export const DESKTOP_COLUMN_WIDTH = 240; // real range ~233-318px across >=768px viewports

export function computeRowSpan(
  image: string,
  referenceWidth: number,
  imageDimensions: Record<string, { width: number; height: number }>
): number {
  const dimensions = imageDimensions[image];
  const renderedImageHeight = dimensions
    ? referenceWidth * (dimensions.height / dimensions.width)
    : referenceWidth;
  return Math.ceil(renderedImageHeight / ROW_UNIT_PX) + CAPTION_ROWS;
}
