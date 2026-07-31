import { STEM_LIBRARY, STEM_TYPES } from "../../bouquet/stemLibrary";
import type { StemType } from "../../bouquet/types";
import StemGlyph from "./StemGlyph";

interface StemPaletteProps {
  onAdd: (type: StemType) => void;
}

/** Add-stem controls. Deliberately buttons, not a drag source — the engine
 * decides where a new stem lands, the user only decides what it is. */
export default function StemPalette({ onAdd }: StemPaletteProps) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#66565D]">Add a stem</p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {STEM_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[#eee5e8] bg-white p-2.5 transition hover:border-[#e8a7b8] hover:bg-[#f8dce5]/40 active:scale-95"
            aria-label={`Add ${STEM_LIBRARY[type].label}`}
          >
            <svg viewBox="-16 -16 32 32" width={26} height={26} aria-hidden="true">
              <StemGlyph type={type} />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#66565D]">
              {STEM_LIBRARY[type].label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
