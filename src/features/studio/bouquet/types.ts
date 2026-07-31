/**
 * Bouquet DNA: the ordered list of stem types is the entire, serializable
 * definition of a bouquet. Nothing else — no ids, no coordinates — is needed
 * to reproduce a layout, which is what makes it safe to save, hash, share as
 * a URL/string, and re-render identically later.
 */
export type StemType =
  | "rose"
  | "tulip"
  | "lily"
  | "gerbera"
  | "carnation"
  | "eucalyptus"
  | "babys-breath"
  | "greenery";

export type StemCategory = "focal" | "filler" | "greenery";

export type BouquetDNA = StemType[];

export interface StemVisualMeta {
  type: StemType;
  category: StemCategory;
  label: string;
  /** Degrees either side of centre this type's stems fan out across. */
  angleSpread: number;
  /** Degrees of deterministic per-stem angular jitter, for an unstacked look. */
  angleJitter: number;
  /** [min, max] stem length as a fraction of the bouquet's max radius. */
  radiusBand: [number, number];
  /** [min, max] paint-order depth (0 = furthest back, 1 = frontmost). */
  depthBand: [number, number];
  /** Relative flower-head size before depth scaling and jitter. */
  baseScale: number;
  /** Degrees of deterministic rotation jitter applied to the flower head. */
  rotationJitter: number;
}

/**
 * A single steerable knob per stem type. This is the seam the future AI
 * Florist speaks through — "move the lilies higher" becomes
 * `{ lily: { heightBias: 0.4 } }` passed into the same pure layout function,
 * never a rewrite of the engine or renderer.
 */
export interface LayoutDirective {
  /** -1..1, pushes this type's stems further from (or closer to) the grip. */
  heightBias?: number;
  /** -1..1, widens (or narrows) this type's fan angle. */
  spreadBias?: number;
  /** -1..1, scales this type's flower heads up or down. */
  scaleBias?: number;
}

export type LayoutDirectives = Partial<Record<StemType, LayoutDirective>>;

export interface LayoutStem {
  type: StemType;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  /** 0 (back) .. 1 (front); drives paint order and stem-line opacity. */
  depth: number;
  /** Integer paint-order rank, back to front, stable for equal depth. */
  zIndex: number;
}

export interface BouquetLayout {
  /** Same length and order as the input DNA — stems[i] describes dna[i]. */
  stems: LayoutStem[];
  viewBox: { width: number; height: number };
  /** The point every stem visually converges on, e.g. the hand-tie point. */
  grip: { x: number; y: number };
}
