// Circular positioning for the homepage occasion carousel
// (src/components/atelier/OccasionDeck.astro). Pure functions, no DOM: the
// component turns the result into data-slot attributes and CSS does the
// motion. One element per occasion — nothing is duplicated to fill the ring,
// so a card that has to cross from one end to the other leaves the stage,
// is moved while hidden, and comes back in on the far side.

/** A place on the stage ("0" centre, "-1"/"1" neighbours, "-2"/"2" outer) or a hidden park on either side. */
export type Slot = "0" | "1" | "-1" | "2" | "-2" | "off-left" | "off-right";
export type Side = "off-left" | "off-right";
export type Direction = 1 | -1;

export type Move =
  /** On stage before and after: one place over. */
  | { kind: "glide"; to: Slot }
  /** Leaves the stage on `via`; parked (hidden) at `to` once the step has finished. */
  | { kind: "exit"; via: Side; to: Side }
  /** Comes on stage at `to`, starting hidden at `from`. */
  | { kind: "enter"; from: Side; to: Slot }
  /** Every card is on stage, so this one leaves on `via` and re-enters from `from`. */
  | { kind: "wrap"; via: Side; from: Side; to: Slot }
  /** Hidden before and after. */
  | { kind: "park"; to: Side };

export const wrapIndex = (index: number, count: number) => ((index % count) + count) % count;

/** Card `index`'s signed distance from the active card round the ring, in (-count/2, count/2]. */
export function circularOffset(index: number, active: number, count: number): number {
  const raw = wrapIndex(index - active, count);
  return raw > count / 2 ? raw - count : raw;
}

/**
 * Neighbours on stage each side of the centre. Three and four occasions show
 * one each side (the fourth waits off stage, which keeps the composition
 * symmetrical); five or more show two where there is room for them (`wide`).
 */
export function visibleRadius(count: number, wide: boolean): number {
  if (count < 3) return 0;
  return wide && count >= 5 ? 2 : 1;
}

export function slotFor(offset: number, radius: number): Slot {
  if (Math.abs(offset) <= radius) return String(offset) as Slot;
  return offset > 0 ? "off-right" : "off-left";
}

/** Where each card rests while `active` is centred. */
export function restingSlots(count: number, active: number, radius: number): Slot[] {
  return Array.from({ length: count }, (_, index) => slotFor(circularOffset(index, active, count), radius));
}

/**
 * What each card does when the centre moves one place: `1` brings the next
 * occasion in from the right, `-1` the previous one from the left.
 */
export function planStep(count: number, active: number, direction: Direction, radius: number): Move[] {
  const next = wrapIndex(active + direction, count);
  const exitSide: Side = direction > 0 ? "off-left" : "off-right";
  const enterSide: Side = direction > 0 ? "off-right" : "off-left";
  return Array.from({ length: count }, (_, index): Move => {
    const before = circularOffset(index, active, count);
    const after = circularOffset(index, next, count);
    const wasOn = Math.abs(before) <= radius;
    const isOn = Math.abs(after) <= radius;
    const to = slotFor(after, radius);
    if (wasOn && isOn) return Math.abs(after - before) === 1 ? { kind: "glide", to } : { kind: "wrap", via: exitSide, from: enterSide, to };
    if (wasOn) return { kind: "exit", via: exitSide, to: to as Side };
    if (isOn) return { kind: "enter", from: enterSide, to };
    return { kind: "park", to: to as Side };
  });
}

/**
 * Presses made while a step is running: at most `limit` are kept, and a
 * press the other way cancels the last one waiting instead of queueing a
 * there-and-back.
 */
export function enqueueStep(queue: Direction[], direction: Direction, limit = 2): Direction[] {
  const last = queue[queue.length - 1];
  if (last !== undefined && last !== direction) return queue.slice(0, -1);
  return queue.length < limit ? [...queue, direction] : queue;
}
