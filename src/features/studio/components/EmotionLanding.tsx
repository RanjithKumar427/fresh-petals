import { motion } from "framer-motion";
import { emotionOptions } from "../services/emotions";
import { useStudioStore } from "../state/studioStore";
import EmotionCard from "./EmotionCard";
import type { EmotionId } from "../types/studio";

export default function EmotionLanding() {
  const selectEmotion = useStudioStore((state) => state.selectEmotion);

  const handleSelect = (id: EmotionId) => {
    selectEmotion(id);
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 md:px-8 md:py-20">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="fp-eyebrow">Fresh Petals Studio</p>
        <h1 className="fp-serif mt-4 text-4xl uppercase leading-[0.95] text-[#171717] md:text-6xl">
          What are you creating today?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#66565D] md:text-base">
          Start with the feeling, not the flowers. Choose what this is for and the Studio
          builds the first draft with you.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {emotionOptions.map((emotion, index) => (
          <EmotionCard key={emotion.id} emotion={emotion} index={index} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}
