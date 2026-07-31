import { STEM_LIBRARY } from "../../bouquet/stemLibrary";
import type { BouquetStemInstance } from "../../state/bouquetStore";
import StemGlyph from "./StemGlyph";

interface StemListProps {
  stems: BouquetStemInstance[];
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

/** Reorder and remove stems via explicit controls. Order in this list is the
 * bouquet's stacking order, so moving a stem here is what makes the engine
 * rebalance the whole arrangement — not a free drag. */
export default function StemList({ stems, onRemove, onMove }: StemListProps) {
  if (stems.length === 0) {
    return <p className="mt-4 text-sm text-[#66565D]">Add a stem below to start your bouquet.</p>;
  }

  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {stems.map((stem, index) => (
        <li
          key={stem.id}
          className="flex items-center gap-2 rounded-lg border border-[#eee5e8] bg-white px-2.5 py-1.5"
        >
          <svg viewBox="-16 -16 32 32" width={22} height={22} aria-hidden="true" className="shrink-0">
            <StemGlyph type={stem.type} />
          </svg>
          <span className="flex-1 text-xs font-medium text-[#171717]">{STEM_LIBRARY[stem.type].label}</span>

          <button
            type="button"
            onClick={() => onMove(stem.id, "up")}
            disabled={index === 0}
            className="rounded-md px-1.5 py-1 text-[#66565D] transition hover:bg-[#f8dce5]/50 disabled:opacity-25"
            aria-label={`Move ${STEM_LIBRARY[stem.type].label} earlier`}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMove(stem.id, "down")}
            disabled={index === stems.length - 1}
            className="rounded-md px-1.5 py-1 text-[#66565D] transition hover:bg-[#f8dce5]/50 disabled:opacity-25"
            aria-label={`Move ${STEM_LIBRARY[stem.type].label} later`}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRemove(stem.id)}
            className="rounded-md px-1.5 py-1 text-[#66565D] transition hover:bg-[#f8dce5]/50 hover:text-[#7C243E]"
            aria-label={`Remove ${STEM_LIBRARY[stem.type].label}`}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
