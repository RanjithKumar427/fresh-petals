import { motion } from "framer-motion";
import type { EmotionOption } from "../types/studio";

interface EmotionCardProps {
  emotion: EmotionOption;
  index: number;
  onSelect: (id: EmotionOption["id"]) => void;
}

export default function EmotionCard({ emotion, index, onSelect }: EmotionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(emotion.id)}
      className="fp-card group flex flex-col items-start gap-3 p-6 text-left"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      aria-label={`Start designing a ${emotion.label} bouquet`}
    >
      <span className="text-3xl" aria-hidden="true">
        {emotion.icon}
      </span>

      <span className="fp-serif text-xl uppercase tracking-[0.04em] text-[#171717]">
        {emotion.label}
      </span>

      <span className="text-sm leading-6 text-[#66565D]">{emotion.description}</span>

      <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#7C243E] transition group-hover:text-[#111111]">
        Start designing
        <svg
          className="h-3 w-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </span>
    </motion.button>
  );
}
