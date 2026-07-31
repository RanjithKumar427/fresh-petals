import { AnimatePresence, motion } from "framer-motion";
import { useStudioStore } from "../state/studioStore";
import EmotionLanding from "./EmotionLanding";
import CanvasEntry from "./CanvasEntry";

/**
 * The single mount point for the Studio route. Everything the Studio needs —
 * state, views, future canvas — lives under src/features/studio and renders
 * through this one component so Studio.astro never grows business logic.
 */
export default function StudioRoot() {
  const view = useStudioStore((state) => state.view);

  return (
    <div className="bg-white">
      <AnimatePresence mode="wait">
        {view === "landing" ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <EmotionLanding />
          </motion.div>
        ) : (
          <motion.div
            key="canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <CanvasEntry />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
