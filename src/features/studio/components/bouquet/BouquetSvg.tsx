import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { computeBouquetLayout } from "../../bouquet/layoutEngine";
import type { BouquetDNA, LayoutDirectives } from "../../bouquet/types";
import StemGlyph from "./StemGlyph";

interface BouquetStemInstance {
  /** Stable per-instance id owned by the interaction layer — used only as a
   * React key so add/remove/reorder animate correctly. The layout engine
   * itself never sees or needs this. */
  id: string;
  type: BouquetDNA[number];
}

interface BouquetSvgProps {
  stems: BouquetStemInstance[];
  directives?: LayoutDirectives;
  className?: string;
}

const SPRING = { type: "spring" as const, stiffness: 220, damping: 24, mass: 0.6 };

/**
 * The SVG renderer: pure presentation over whatever the layout engine
 * computes. It knows nothing about pricing, emotions, or where the bouquet
 * data came from — swap in a different data source and this still works.
 * Every flower renders as its own independent `<motion.g>` layer, so a
 * future animation layer (or an AI-driven relayout) only ever has to change
 * numbers, never markup.
 */
export default function BouquetSvg({ stems, directives, className }: BouquetSvgProps) {
  const dna = useMemo(() => stems.map((stem) => stem.type), [stems]);
  const layout = useMemo(() => computeBouquetLayout(dna, directives), [dna, directives]);

  const layers = useMemo(
    () =>
      stems
        .map((stem, index) => ({ id: stem.id, type: stem.type, layout: layout.stems[index] }))
        .sort((a, b) => a.layout.zIndex - b.layout.zIndex),
    [stems, layout],
  );

  const { viewBox, grip } = layout;

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      className={className}
      role="img"
      aria-label={`A bouquet of ${stems.length} stem${stems.length === 1 ? "" : "s"}`}
    >
      <g aria-hidden="true">
        {layers.map(({ id, layout: stemLayout }) => (
          <line
            key={`stem-${id}`}
            x1={grip.x}
            y1={grip.y}
            x2={stemLayout.x}
            y2={stemLayout.y}
            stroke="#6f8f6a"
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.3 + stemLayout.depth * 0.35}
          />
        ))}
      </g>

      <ellipse cx={grip.x} cy={grip.y - 6} rx={22} ry={13} fill="#7c243e" aria-hidden="true" />
      <ellipse cx={grip.x} cy={grip.y - 6} rx={22} ry={13} fill="none" stroke="#5c1a2c" strokeWidth={1} aria-hidden="true" />

      <AnimatePresence initial={false}>
        {layers.map(({ id, type, layout: stemLayout }) => (
          <motion.g
            key={id}
            data-stem-type={type}
            initial={{ x: grip.x, y: grip.y, scale: 0, opacity: 0 }}
            animate={{ x: stemLayout.x, y: stemLayout.y, rotate: stemLayout.rotation, scale: stemLayout.scale, opacity: 1 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
            transition={SPRING}
          >
            <StemGlyph type={type} />
          </motion.g>
        ))}
      </AnimatePresence>
    </svg>
  );
}
