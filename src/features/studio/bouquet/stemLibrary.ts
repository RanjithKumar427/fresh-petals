import type { StemType, StemVisualMeta } from "./types";

/**
 * The florist knowledge the layout engine draws on: where each stem type
 * likes to sit in a hand-tied dome (band/greenery toward the back and edges,
 * focal blooms toward the front and centre), independent of any one bouquet.
 * Pure data — importable by the layout engine, the renderer, or a future
 * pricing/AI module without pulling in React or SVG.
 */
export const STEM_LIBRARY: Record<StemType, StemVisualMeta> = {
  rose: {
    type: "rose",
    category: "focal",
    label: "Rose",
    angleSpread: 46,
    angleJitter: 6,
    radiusBand: [0.32, 0.55],
    depthBand: [0.55, 0.85],
    baseScale: 1,
    rotationJitter: 6,
  },
  tulip: {
    type: "tulip",
    category: "focal",
    label: "Tulip",
    angleSpread: 40,
    angleJitter: 5,
    radiusBand: [0.3, 0.5],
    depthBand: [0.5, 0.8],
    baseScale: 0.85,
    rotationJitter: 5,
  },
  lily: {
    type: "lily",
    category: "focal",
    label: "Lily",
    angleSpread: 34,
    angleJitter: 5,
    radiusBand: [0.42, 0.68],
    depthBand: [0.6, 0.9],
    baseScale: 1.2,
    rotationJitter: 5,
  },
  gerbera: {
    type: "gerbera",
    category: "focal",
    label: "Gerbera",
    angleSpread: 50,
    angleJitter: 7,
    radiusBand: [0.28, 0.48],
    depthBand: [0.5, 0.78],
    baseScale: 0.9,
    rotationJitter: 6,
  },
  carnation: {
    type: "carnation",
    category: "focal",
    label: "Carnation",
    angleSpread: 55,
    angleJitter: 7,
    radiusBand: [0.25, 0.45],
    depthBand: [0.45, 0.72],
    baseScale: 0.8,
    rotationJitter: 7,
  },
  eucalyptus: {
    type: "eucalyptus",
    category: "filler",
    label: "Eucalyptus",
    angleSpread: 70,
    angleJitter: 8,
    radiusBand: [0.45, 0.85],
    depthBand: [0.15, 0.4],
    baseScale: 0.75,
    rotationJitter: 10,
  },
  "babys-breath": {
    type: "babys-breath",
    category: "filler",
    label: "Baby's Breath",
    angleSpread: 75,
    angleJitter: 10,
    radiusBand: [0.38, 0.7],
    depthBand: [0.35, 0.55],
    baseScale: 0.4,
    rotationJitter: 14,
  },
  greenery: {
    type: "greenery",
    category: "greenery",
    label: "Greenery",
    angleSpread: 80,
    angleJitter: 6,
    radiusBand: [0.5, 0.95],
    depthBand: [0.05, 0.25],
    baseScale: 1,
    rotationJitter: 8,
  },
};

export const STEM_TYPES: StemType[] = Object.keys(STEM_LIBRARY) as StemType[];
