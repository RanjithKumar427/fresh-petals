import { hashString, mulberry32, r2Point } from "./deterministicRandom";
import { STEM_LIBRARY } from "./stemLibrary";
import type { BouquetDNA, BouquetLayout, LayoutDirectives, LayoutStem, StemType } from "./types";

/**
 * Pure layout math. This file must never import React, SVG, zustand, or
 * pricing code — it takes bouquet data in and hands positioned stems back
 * out. That boundary is what lets the same engine drive the live canvas,
 * a static share-link preview, and a future server-side render.
 */

export const BOUQUET_VIEWBOX = { width: 480, height: 560 };
export const BOUQUET_GRIP = { x: 240, y: 528 };

/**
 * A flower head's approximate on-screen radius at scale 1, in the same
 * units as the viewBox. StemGlyph artwork is authored to roughly this size
 * (see its file header) — the layout engine uses it only to keep the whole
 * bouquet inside the frame, never to draw anything itself.
 */
export const GLYPH_REFERENCE_RADIUS = 11;

/**
 * Every tunable constant the placement math depends on, gathered in one
 * place so a future pass (including an AI Florist tuning pass) has one spot
 * to read or adjust, instead of hunting for numbers scattered through the
 * function body.
 */
const LAYOUT_TUNING = {
  /** Px a stem travels per unit of radiusFraction (1 = full reach). */
  maxRadius: 380,
  /** Deg, half-width of the arc distinct focal types are seated across. */
  focalDomeSpread: 62,
  /** How much a focal type's angular seat widens per extra stem of that
   * type, before the sqrt dampening below — this is what stops 20 roses
   * from being crammed into the same seat width as a single rose. */
  seatDensityGrowth: 0.9,
  /** How much a type's radial band thickens per extra stem of that type —
   * pairs with seatDensityGrowth so a type's available *area*, not just its
   * angular width, grows with its count. Deliberately lets a heavy bouquet
   * grow past the viewBox; fitStemsWithinViewBox then zooms the whole
   * result out to fit, which preserves these spacing ratios exactly. */
  radialDensityGrowth: 0.16,
  /** Default fraction of a focal seat's width stems actually use, leaving
   * the rest as a gutter between neighbouring seats. */
  seatFillFactor: 0.78,
  /** Fraction-of-radius deterministic jitter applied per stem. */
  radiusJitter: 0.04,
  /** How far directive.heightBias (-1..1) can push radiusFraction. */
  heightBiasStrength: 0.2,
  depthJitter: 0.02,
  /** How far directive.scaleBias (-1..1) can scale a flower head. */
  scaleBiasStrength: 0.35,
  depthScaleBase: 0.85,
  depthScaleRange: 0.3,
  scaleJitter: 0.08,
  /** How much a stem's outward angle carries into its own rotation. */
  rotationFollow: 0.35,
  /** Px of clearance kept at the viewBox edges when auto-fitting. */
  boundsMargin: 20,
} as const;

/** Stable per-type offset into the R2 sequence, so different stem types
 * don't sample the same point at the same occurrence count. */
function typePhaseOffset(type: StemType): number {
  return hashString(type) % 97;
}

/**
 * Deterministic per-stem "organic" variance in [-1, 1], seeded by the stem's
 * type and position in the bouquet — never by call order or Math.random —
 * so re-running layout on identical DNA always yields identical jitter.
 */
function seededJitter(type: StemType, index: number) {
  const rand = mulberry32(hashString(`${type}:${index}`));
  return {
    angle: rand() * 2 - 1,
    radius: rand() * 2 - 1,
    scale: rand() * 2 - 1,
    rotation: rand() * 2 - 1,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * A focal type's angular seat grows with how many stems of it are present
 * (sqrt-dampened: doubling the count doesn't double the width), which is
 * what stops a heavy single-type bouquet — 20 roses — from being crammed
 * into the same seat a single rose would get.
 */
function focalSeatWeight(count: number): number {
  return 1 + LAYOUT_TUNING.seatDensityGrowth * Math.sqrt(Math.max(0, count - 1));
}

/**
 * Distinct focal types each get their own seat across the dome, sized by
 * `focalSeatWeight` and ordered by first appearance in the DNA — so
 * reordering the DNA reassigns seats, which is exactly the mechanism behind
 * "reorder stems rebalances the bouquet". Filler and greenery don't get a
 * private seat: they're meant to weave through the whole width behind the
 * focal blooms, not claim a slice of it.
 */
function computeFocalSeats(
  focalTypesInOrder: StemType[],
  totalsByType: Map<StemType, number>,
): Map<StemType, { start: number; width: number }> {
  const weights = focalTypesInOrder.map((type) => focalSeatWeight(totalsByType.get(type) ?? 1));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const domeWidth = LAYOUT_TUNING.focalDomeSpread * 2;

  const seats = new Map<StemType, { start: number; width: number }>();
  let cursor = -LAYOUT_TUNING.focalDomeSpread;
  focalTypesInOrder.forEach((type, i) => {
    const width = totalWeight > 0 ? (weights[i] / totalWeight) * domeWidth : domeWidth;
    seats.set(type, { start: cursor, width });
    cursor += width;
  });
  return seats;
}

/**
 * Scales every stem's distance from the grip point (and its own size) down
 * just enough to keep the whole bouquet inside the viewBox, if it wouldn't
 * otherwise fit. A single uniform factor, so relative spacing — and
 * therefore whether two stems collide — is unchanged; this only guarantees
 * containment, never crowding relief. Mutates in place; only ever called on
 * an array this function just built, never on caller-owned data.
 */
function fitStemsWithinViewBox(
  stems: LayoutStem[],
  viewBox: { width: number; height: number },
  grip: { x: number; y: number },
): void {
  const margin = LAYOUT_TUNING.boundsMargin;
  let maxOffsetX = 0;
  let maxOffsetUp = 0;
  let maxOffsetDown = 0;

  for (const stem of stems) {
    const glyphRadius = GLYPH_REFERENCE_RADIUS * stem.scale;
    maxOffsetX = Math.max(maxOffsetX, Math.abs(stem.x - grip.x) + glyphRadius);
    const upOffset = grip.y - stem.y;
    if (upOffset >= 0) {
      maxOffsetUp = Math.max(maxOffsetUp, upOffset + glyphRadius);
    } else {
      maxOffsetDown = Math.max(maxOffsetDown, -upOffset + glyphRadius);
    }
  }

  const availableHalfWidth = Math.max(1, Math.min(grip.x, viewBox.width - grip.x) - margin);
  const availableUp = Math.max(1, grip.y - margin);
  const availableDown = Math.max(1, viewBox.height - grip.y - margin);

  const fitScale = Math.min(
    1,
    maxOffsetX > 0 ? availableHalfWidth / maxOffsetX : 1,
    maxOffsetUp > 0 ? availableUp / maxOffsetUp : 1,
    maxOffsetDown > 0 ? availableDown / maxOffsetDown : 1,
  );

  if (fitScale >= 1) return;

  for (const stem of stems) {
    stem.x = grip.x + (stem.x - grip.x) * fitScale;
    stem.y = grip.y + (stem.y - grip.y) * fitScale;
    stem.scale *= fitScale;
  }
}

/**
 * Computes a florist-plausible dome layout for a bouquet: every stem
 * emanates from a single grip point, focal blooms sit forward and central,
 * filler and greenery sit further back and fan wider. Deterministic —
 * calling this twice with the same `dna` and `directives` always produces
 * the same layout, which is what makes saving, sharing, and editing a
 * bouquet safe. Guaranteed to fit inside `viewBox` and never overlap its own
 * stems into an unreadable pile, at any bouquet size from one stem to
 * several dozen.
 */
export function computeBouquetLayout(dna: BouquetDNA, directives: LayoutDirectives = {}): BouquetLayout {
  const totalsByType = new Map<StemType, number>();
  for (const type of dna) {
    totalsByType.set(type, (totalsByType.get(type) ?? 0) + 1);
  }

  const focalTypesInOrder: StemType[] = [];
  const seenFocal = new Set<StemType>();
  for (const type of dna) {
    if (STEM_LIBRARY[type].category === "focal" && !seenFocal.has(type)) {
      seenFocal.add(type);
      focalTypesInOrder.push(type);
    }
  }
  const focalSeats = computeFocalSeats(focalTypesInOrder, totalsByType);

  const occurrenceSoFar = new Map<StemType, number>();

  const stems: LayoutStem[] = dna.map((type, index) => {
    const meta = STEM_LIBRARY[type];
    const directive = directives[type] ?? {};
    const jitter = seededJitter(type, index);

    const occurrence = occurrenceSoFar.get(type) ?? 0;
    occurrenceSoFar.set(type, occurrence + 1);

    // u drives angle, v drives radius. Both come from the same occurrence
    // index but are decorrelated by the R2 sequence, so same-type stems
    // fill their seat's area instead of stringing out along one arc (which
    // is what a naive occurrence/total ratio on both axes produces, and
    // what caused real collisions at higher same-type counts). The type's
    // own phase offset is added so two *different* types don't sample the
    // same point in the sequence at the same occurrence count and land on
    // top of each other where their ranges overlap.
    const [u, v] = r2Point(occurrence + typePhaseOffset(type));

    let angleDeg: number;
    if (meta.category === "focal") {
      const seat = focalSeats.get(type) ?? { start: -meta.angleSpread, width: meta.angleSpread * 2 };
      // Stems fill most, not all, of their seat — the unused margin is a
      // gutter that keeps stems near one seat's edge from crowding stems
      // near the neighbouring seat's edge.
      const spreadMultiplier = clamp(LAYOUT_TUNING.seatFillFactor + (directive.spreadBias ?? 0) * 0.35, 0.3, 2);
      const width = Math.max(4, seat.width * spreadMultiplier);
      const center = seat.start + seat.width / 2;
      angleDeg = center + (u - 0.5) * width + jitter.angle * meta.angleJitter;
    } else {
      const spread = Math.max(4, meta.angleSpread + (directive.spreadBias ?? 0) * 12);
      angleDeg = (u - 0.5) * 2 * spread + jitter.angle * meta.angleJitter;
    }
    const angle = (angleDeg * Math.PI) / 180;

    const [radiusMin, radiusMax] = meta.radiusBand;
    const total = totalsByType.get(type) ?? 1;
    const radiusGrowth = LAYOUT_TUNING.radialDensityGrowth * Math.sqrt(Math.max(0, total - 1));
    let radiusFraction = radiusMin + v * (radiusMax + radiusGrowth - radiusMin);
    radiusFraction += jitter.radius * LAYOUT_TUNING.radiusJitter;
    radiusFraction += (directive.heightBias ?? 0) * LAYOUT_TUNING.heightBiasStrength;
    // Upper bound is a sanity ceiling against pathological inputs, not a
    // viewBox constraint — fitStemsWithinViewBox (below) owns containment,
    // so a large, legitimately-grown radiusFraction is left alone here.
    radiusFraction = clamp(radiusFraction, 0.08, 3);

    const radius = radiusFraction * LAYOUT_TUNING.maxRadius;
    const x = BOUQUET_GRIP.x + Math.sin(angle) * radius;
    const y = BOUQUET_GRIP.y - Math.cos(angle) * radius;

    const [depthMin, depthMax] = meta.depthBand;
    let depth = depthMin + (1 - radiusFraction) * (depthMax - depthMin);
    depth += jitter.radius * LAYOUT_TUNING.depthJitter;
    depth = clamp(depth, 0, 1);

    const scaleBias = 1 + (directive.scaleBias ?? 0) * LAYOUT_TUNING.scaleBiasStrength;
    const depthScale = LAYOUT_TUNING.depthScaleBase + depth * LAYOUT_TUNING.depthScaleRange;
    const jitterScale = 1 + jitter.scale * LAYOUT_TUNING.scaleJitter;
    const scale = meta.baseScale * scaleBias * depthScale * jitterScale;

    const rotation = angleDeg * LAYOUT_TUNING.rotationFollow + jitter.rotation * meta.rotationJitter;

    return { type, x, y, rotation, scale, depth, zIndex: 0 };
  });

  fitStemsWithinViewBox(stems, BOUQUET_VIEWBOX, BOUQUET_GRIP);

  // Assign back-to-front paint order from depth, stable on original index.
  const paintOrder = stems
    .map((stem, index) => ({ stem, index }))
    .sort((a, b) => a.stem.depth - b.stem.depth || a.index - b.index);
  paintOrder.forEach(({ stem }, rank) => {
    stem.zIndex = rank;
  });

  return { stems, viewBox: BOUQUET_VIEWBOX, grip: BOUQUET_GRIP };
}
