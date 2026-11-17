// The petal silhouette shared by the homepage's three-petal scene: the
// WebGL surface (src/scripts/petal-scene.ts) and the static HTML petals that
// render first and stay as the fallback (src/components/home/PetalHero.astro)
// use the same outline, so the hand-over from one to the other does not
// change the shape. Pure and dependency-free.

/** A petal's width over its height. Narrower than the 3:4 photographs, which are cropped at the sides to fit. */
export const PETAL_ASPECT = 0.54;
/** The petal photographs' width over height (scripts/hero-campaign-images.mjs PETAL boxes). */
export const PETAL_IMAGE_ASPECT = 0.75;

// A smooth teardrop: v^a (1 - v)^b, widest at a / (a + b) ≈ 63% of the
// height, rounding to the tip and narrowing to a point at the base.
const A = 0.95;
const B = 0.55;
const PEAK = Math.pow(A / (A + B), A) * Math.pow(B / (A + B), B);

/**
 * Half the petal's width at height v (0 = base, 1 = tip), as a fraction of
 * the bounding box's half width (1 at the widest point).
 */
export function petalHalfWidth(v: number): number {
  const t = Math.min(1, Math.max(0, v));
  return (Math.pow(t, A) * Math.pow(1 - t, B)) / PEAK;
}

/**
 * The outline as an SVG path in a 0..1 × 0..1 box (y down, base at the
 * bottom centre), for a CSS mask (objectBoundingBox units).
 */
export function petalPath(steps = 48): string {
  const right: string[] = [];
  const left: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const v = i / steps;
    const w = petalHalfWidth(v) * 0.5;
    const y = (1 - v).toFixed(4);
    right.push(`${(0.5 + w).toFixed(4)} ${y}`);
    left.unshift(`${(0.5 - w).toFixed(4)} ${y}`);
  }
  return `M0.5 1L${right.join("L")}L${left.join("L")}Z`;
}

/** The angle, in radians, between the centre petal and each side petal (counter-clockwise positive). */
export const PETAL_SPREAD = 0.73;
/** How far each side petal's base sits from the centre petal's, in petal heights, so the three read as separate petals. */
export const PETAL_OFFSET = 0.13;
/** The petals' relative sizes at rest: the centre petal stands taller. */
export const PETAL_SCALE = { centre: 1.06, side: 0.88 } as const;

/**
 * Where a petal's photograph sits so it stays upright when the petal is
 * turned by `theta` about its base: the photograph covers the turned
 * petal's bounding box. Returned in the turned (upright) frame, in units of
 * the petal's height, base at the origin, y up: the box centre (ox, oy) and
 * its size (sx × sy, at the photograph's own aspect ratio).
 */
export function petalPhotoBox(theta: number): { ox: number; oy: number; sx: number; sy: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i <= 64; i++) {
    const v = i / 64;
    const w = petalHalfWidth(v) * (PETAL_ASPECT / 2);
    for (const x of [-w, w]) {
      const X = c * x - s * v;
      const Y = s * x + c * v;
      minX = Math.min(minX, X); maxX = Math.max(maxX, X);
      minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
    }
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const cover = w / h > PETAL_IMAGE_ASPECT ? { sx: w, sy: w / PETAL_IMAGE_ASPECT } : { sx: h * PETAL_IMAGE_ASPECT, sy: h };
  return { ox: (minX + maxX) / 2, oy: (minY + maxY) / 2, ...cover };
}
