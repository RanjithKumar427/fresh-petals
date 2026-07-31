import { create } from "zustand";
import type { EmotionId, StudioView } from "../types/studio";

interface StudioState {
  view: StudioView;
  selectedEmotion: EmotionId | null;
  selectEmotion: (emotion: EmotionId) => void;
  backToLanding: () => void;
}

/**
 * Single source of truth for the Studio route. Deliberately small right now —
 * Phase 3+ (canvas stems, undo/redo, budget) extends this store rather than
 * introducing a second one, so the whole feature stays inspectable from one file.
 */
export const useStudioStore = create<StudioState>((set) => ({
  view: "landing",
  selectedEmotion: null,
  selectEmotion: (emotion) => set({ selectedEmotion: emotion, view: "canvas" }),
  backToLanding: () => set({ selectedEmotion: null, view: "landing" }),
}));
