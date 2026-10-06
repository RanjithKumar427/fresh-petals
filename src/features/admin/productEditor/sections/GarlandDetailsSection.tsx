import FormField, { inputClassName } from "../../shared/FormField";
import Chip from "../../shared/Chip";
import type { GarlandDraft, GarlandFilter, GarlandUnit, ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

const FILTERS: { key: GarlandFilter; label: string }[] = [
  { key: "rose", label: "Rose" },
  { key: "tuberose", label: "Tuberose" },
  { key: "lotus", label: "Lotus" },
  { key: "designer-mixed", label: "Designer / Mixed" },
];

const UNITS: { value: GarlandUnit | ""; label: string }[] = [
  { value: "", label: "Not confirmed yet" },
  { value: "single", label: "Single garland" },
  { value: "pair", label: "Pair" },
  { value: "set", label: "Set" },
];

const TEXT_FACTS: { key: keyof GarlandDraft; label: string; hint: string; multiline?: boolean; max: number }[] = [
  { key: "length", label: "Length", hint: "e.g. 1.5 m each", max: 60 },
  { key: "flowerRecipe", label: "Flowers", hint: "The exact flowers used", multiline: true, max: 400 },
  { key: "thickness", label: "Thickness / weight", hint: "e.g. 8 cm thick", max: 60 },
  { key: "finish", label: "Finish / tassels", hint: "e.g. Gold tassels, pearl hangers", max: 120 },
  { key: "leadTime", label: "Preparation time", hint: "e.g. Order 2 days ahead", max: 80 },
  { key: "substitutionPolicy", label: "Substitution policy", hint: "What happens if a flower is unavailable", multiline: true, max: 400 },
];

/**
 * Garland-only facts. Every field may stay blank: a blank fact is shown to
 * customers as "To be confirmed on WhatsApp", never guessed. The design code
 * is shown but can't be edited.
 */
export default function GarlandDetailsSection({ draft, onChange }: Props) {
  const garland = draft.garland;
  if (!garland) return null;
  const update = (patch: Partial<GarlandDraft>) => onChange({ garland: { ...garland, ...patch } });
  const toggleFilter = (key: GarlandFilter) =>
    update({ filters: garland.filters.includes(key) ? garland.filters.filter((f) => f !== key) : FILTERS.map((f) => f.key).filter((k) => k === key || garland.filters.includes(k)) });

  const cartProblem =
    garland.sellingMode === "cart" && !(garland.readyForSale && draft.priceType === "fixed" && draft.sellingPrice)
      ? "Cart mode needs a fixed price and 'Ready for sale'. Until then this garland stays a WhatsApp enquiry."
      : undefined;

  return (
    <section id="section-garland-details" className="fp-card scroll-mt-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Garland Details</h2>
        <span className="rounded-full bg-[#F8DCE5] px-3 py-1 text-[11px] font-bold tracking-[0.12em] text-[#7C243E]" data-design-code>
          {garland.designCode}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[#9B948F]">
        Leave anything you haven't confirmed blank — customers see "To be confirmed on WhatsApp", never a guess.
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="fp-label block text-[10px] text-[#66565D]">Flower filters</label>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Flower filters">
            {FILTERS.map((filter) => (
              <Chip key={filter.key} label={filter.label} selected={garland.filters.includes(filter.key)} onClick={() => toggleFilter(filter.key)} />
            ))}
          </div>
          <p className="mt-1 text-[12px] text-[#9B948F]">Which browsing filters show this design on the Garlands page.</p>
        </div>

        <FormField label="Sold as" htmlFor="garland-soldUnit" hint="Quantities in WhatsApp messages use this unit once it's confirmed.">
          <select
            id="garland-soldUnit"
            value={garland.soldUnit ?? ""}
            onChange={(event) => update({ soldUnit: (event.target.value || null) as GarlandUnit | null })}
            className={inputClassName}
          >
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {TEXT_FACTS.map((fact) => {
            const value = (garland[fact.key] as string | null) ?? "";
            const tooLong = value.length > fact.max ? `Keep this under ${fact.max} characters.` : undefined;
            const id = `garland-${fact.key}`;
            return (
              <div key={fact.key} className={fact.multiline ? "sm:col-span-2" : undefined}>
                <FormField label={fact.label} htmlFor={id} hint={fact.hint} error={tooLong}>
                  {fact.multiline ? (
                    <textarea id={id} rows={2} value={value} onChange={(event) => update({ [fact.key]: event.target.value || null })} className={inputClassName} />
                  ) : (
                    <input id={id} type="text" value={value} onChange={(event) => update({ [fact.key]: event.target.value || null })} className={inputClassName} />
                  )}
                </FormField>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#EEE5E8] p-4">
          <p className="fp-label text-[10px] text-[#66565D]">How customers order</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["enquiry", "cart"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => update({ sellingMode: mode })}
                aria-pressed={garland.sellingMode === mode}
                className={`rounded-lg border px-3 py-2 text-left transition ${garland.sellingMode === mode ? "border-[#7C243E] bg-[#F8DCE5]" : "border-[#D8D1D4] hover:border-[#9B6B78]"}`}
              >
                <p className="text-[12px] font-semibold text-[#171717]">{mode === "enquiry" ? "WhatsApp enquiry" : "Cart"}</p>
                <p className="text-[10px] text-[#9B948F]">{mode === "enquiry" ? "Default — customer messages you first" : "Uses the bouquet cart and checkout flow"}</p>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-[#171717]">
            <input id="garland-readyForSale" type="checkbox" checked={garland.readyForSale} onChange={(event) => update({ readyForSale: event.target.checked })} />
            Ready for sale
          </label>
          <p className="mt-1 text-[12px] text-[#9B948F]">A price on its own never enables the cart.</p>
          {cartProblem && <p className="mt-1 text-[12px] text-[#B3352D]">{cartProblem}</p>}
        </div>

        <div className="rounded-xl border border-[#EEE5E8] p-4">
          <p className="fp-label text-[10px] text-[#66565D]">Approvals (required to publish)</p>
          <FormField label="Photo permission" htmlFor="garland-photoPermission" hint="Permission to publish these photos, or 'Granted' once you use your own.">
            <select
              id="garland-photoPermission"
              value={garland.photoPermission}
              onChange={(event) => update({ photoPermission: event.target.value as GarlandDraft["photoPermission"] })}
              className={inputClassName}
            >
              <option value="unconfirmed">Not confirmed</option>
              <option value="granted">Granted / own photos</option>
              <option value="refused">Refused</option>
            </select>
          </FormField>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-[#171717]">
            <input id="garland-sampleVerified" type="checkbox" checked={garland.sampleVerified} onChange={(event) => update({ sampleVerified: event.target.checked })} />
            A sample has been made and checked
          </label>
        </div>
      </div>
    </section>
  );
}
