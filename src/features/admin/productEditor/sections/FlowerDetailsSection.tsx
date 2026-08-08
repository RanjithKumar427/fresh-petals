import { useState } from "react";
import FormField, { inputClassName } from "../../shared/FormField";
import Chip from "../../shared/Chip";
import type { ProductDraft, TagOption } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
  flowerTypes: TagOption[];
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export default function FlowerDetailsSection({ draft, onChange, flowerTypes }: Props) {
  const [search, setSearch] = useState("");

  const selected = flowerTypes.filter((type) => draft.flowerTypeIds.includes(type.id));
  const visible = search.trim()
    ? flowerTypes.filter((type) => type.name.toLowerCase().includes(search.trim().toLowerCase()))
    : flowerTypes;

  return (
    <section id="section-flower-details" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Flower Details</h2>

      <div className="mt-5 space-y-5">
        <div>
          <label className="fp-label block text-[10px] text-[#66565D]">Flower Types</label>

          {selected.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.map((type) => (
                <Chip
                  key={type.id}
                  label={type.name}
                  selected
                  onClick={() => onChange({ flowerTypeIds: toggleId(draft.flowerTypeIds, type.id) })}
                />
              ))}
            </div>
          )}

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search flower types…"
            className={`${inputClassName} mt-2`}
          />
          <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[#EEE5E8] p-3">
            {visible.length === 0 && <p className="text-[12px] text-[#9B948F]">No matches.</p>}
            {visible.map((type) => (
              <Chip
                key={type.id}
                label={type.name}
                selected={draft.flowerTypeIds.includes(type.id)}
                onClick={() => onChange({ flowerTypeIds: toggleId(draft.flowerTypeIds, type.id) })}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Stem Count" htmlFor="stemCount" hint="e.g. 18–24">
            <input
              id="stemCount"
              type="text"
              value={draft.stemCount ?? ""}
              onChange={(event) => onChange({ stemCount: event.target.value || null })}
              className={inputClassName}
            />
          </FormField>

          <FormField label="Colour Theme" htmlFor="colourTheme" hint="e.g. Blue & White">
            <input
              id="colourTheme"
              type="text"
              value={draft.colourTheme ?? ""}
              onChange={(event) => onChange({ colourTheme: event.target.value || null })}
              className={inputClassName}
            />
          </FormField>

          <FormField label="Arrangement Style" htmlFor="arrangementStyle" hint="e.g. Hand-tied, Vase, Flower Box">
            <input
              id="arrangementStyle"
              type="text"
              value={draft.arrangementStyle ?? ""}
              onChange={(event) => onChange({ arrangementStyle: event.target.value || null })}
              className={inputClassName}
            />
          </FormField>

          <FormField label="Size" htmlFor="size" hint="e.g. Small, Medium, Large">
            <input
              id="size"
              type="text"
              value={draft.size ?? ""}
              onChange={(event) => onChange({ size: event.target.value || null })}
              className={inputClassName}
            />
          </FormField>
        </div>
      </div>
    </section>
  );
}
