import { motion } from "framer-motion";
import { emotionOptions } from "../services/emotions";
import { useStudioStore } from "../state/studioStore";
import BouquetBuilder from "./bouquet/BouquetBuilder";

/**
 * Phase 3: the bouquet composition engine replaces the placeholder. Stem
 * drag-and-drop is deliberately not here yet — add/remove/reorder go through
 * BouquetBuilder's controls, and the layout engine owns every position.
 */
export default function CanvasEntry() {
  const selectedEmotion = useStudioStore((state) => state.selectedEmotion);
  const backToLanding = useStudioStore((state) => state.backToLanding);

  const emotion = emotionOptions.find((option) => option.id === selectedEmotion);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="fp-eyebrow">{emotion?.label ?? "Your bouquet"}</p>
            <h1 className="fp-serif mt-2 text-3xl uppercase leading-[0.95] text-[#171717] md:text-4xl">
              Design your arrangement
            </h1>
          </div>
          <button
            type="button"
            onClick={backToLanding}
            className="fp-btn-pill-dark shrink-0 rounded-full"
          >
            Choose a different feeling
          </button>
        </div>

        <div className="mt-8">
          <BouquetBuilder />
        </div>
      </motion.div>
    </div>
  );
}
