import { useBouquetStore } from "../../state/bouquetStore";
import BouquetSvg from "./BouquetSvg";
import StemList from "./StemList";
import StemPalette from "./StemPalette";

/**
 * The only place bouquet data, the layout engine (via BouquetSvg), and user
 * interaction meet. This is where React and the store live — BouquetSvg and
 * the layout engine underneath it stay ignorant of both.
 */
export default function BouquetBuilder() {
  const stems = useBouquetStore((state) => state.stems);
  const addStem = useBouquetStore((state) => state.addStem);
  const removeStem = useBouquetStore((state) => state.removeStem);
  const moveStem = useBouquetStore((state) => state.moveStem);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="fp-card flex items-center justify-center p-4">
        <BouquetSvg stems={stems} className="aspect-[6/7] w-full max-w-md" />
      </div>

      <div>
        <p className="fp-eyebrow">Your composition</p>
        <h2 className="fp-serif mt-2 text-2xl uppercase leading-[0.95] text-[#171717]">
          {stems.length} stem{stems.length === 1 ? "" : "s"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#66565D]">
          Add, remove or reorder stems below — the arrangement rebalances itself around them.
        </p>

        <StemList stems={stems} onRemove={removeStem} onMove={moveStem} />

        <div className="mt-6 border-t border-[#eee5e8] pt-6">
          <StemPalette onAdd={addStem} />
        </div>
      </div>
    </div>
  );
}
