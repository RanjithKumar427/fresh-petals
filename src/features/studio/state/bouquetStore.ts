import { create } from "zustand";
import type { StemType } from "../bouquet/types";

export interface BouquetStemInstance {
  /** Instance identity for React/animation only — not part of the bouquet's
   * saved DNA. Two bouquets with the same type sequence are the same
   * bouquet even if their instance ids differ. */
  id: string;
  type: StemType;
}

let nextStemId = 0;
const makeStemId = () => `stem-${nextStemId++}`;

/** The starting arrangement from the Phase 3 brief: rose, rose, tulip, lily, eucalyptus. */
const DEFAULT_DNA: StemType[] = ["rose", "rose", "tulip", "lily", "eucalyptus"];

interface BouquetState {
  stems: BouquetStemInstance[];
  addStem: (type: StemType) => void;
  removeStem: (id: string) => void;
  moveStem: (id: string, direction: "up" | "down") => void;
}

/**
 * Owns the bouquet's data — the composition layer's only job is to keep an
 * ordered list of stem instances and mutate it. It never computes a
 * position, never touches SVG, and never sees the layout engine; the
 * renderer derives layout from `stems.map(s => s.type)` on every read.
 */
export const useBouquetStore = create<BouquetState>((set) => ({
  stems: DEFAULT_DNA.map((type) => ({ id: makeStemId(), type })),

  addStem: (type) =>
    set((state) => ({ stems: [...state.stems, { id: makeStemId(), type }] })),

  removeStem: (id) =>
    set((state) => ({ stems: state.stems.filter((stem) => stem.id !== id) })),

  moveStem: (id, direction) =>
    set((state) => {
      const index = state.stems.findIndex((stem) => stem.id === id);
      if (index === -1) return state;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.stems.length) return state;

      const stems = [...state.stems];
      [stems[index], stems[targetIndex]] = [stems[targetIndex], stems[index]];
      return { stems };
    }),
}));
