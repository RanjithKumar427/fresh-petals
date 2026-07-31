/**
 * General-purpose deterministic randomness. Nothing here knows what a
 * bouquet, a stem, or a layout is — these are reusable wherever "same input,
 * same output, forever" matters (which is most of the layout engine).
 */

/** FNV-1a: a fast, dependency-free string hash for seeding the PRNG below. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny deterministic PRNG. Same seed, same output, forever. */
export function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * R2 low-discrepancy sequence (Martin Roberts): the plastic number and its
 * powers generate a 2D point sequence that covers an area evenly without
 * clustering, for any prefix length. Unlike deriving two axes from the same
 * ratio, the two coordinates here are decorrelated — points fill an area
 * instead of stringing out along a single curve.
 */
const PLASTIC_NUMBER = 1.32471795724474602596;
const R2_ALPHA_1 = 1 / PLASTIC_NUMBER;
const R2_ALPHA_2 = 1 / (PLASTIC_NUMBER * PLASTIC_NUMBER);

export function r2Point(index: number): [number, number] {
  const u = (0.5 + R2_ALPHA_1 * index) % 1;
  const v = (0.5 + R2_ALPHA_2 * index) % 1;
  return [u, v];
}
