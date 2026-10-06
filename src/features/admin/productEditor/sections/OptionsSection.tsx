import { useState } from "react";
import { inputClassName } from "../../shared/FormField";
import type { OptionDraft, ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

function chargeOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/**
 * Option choices a customer can pick (e.g. Finish → Gold tassels), each with
 * an optional extra charge. Choices sharing a name form one dropdown on the
 * product page; the charge is shown next to the choice and quoted in the
 * WhatsApp message — it is never added into a total.
 */
export default function OptionsSection({ draft, onChange }: Props) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [charge, setCharge] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setOptions = (options: OptionDraft[]) => onChange({ options: options.map((o, i) => ({ ...o, sortOrder: i })) });

  const add = () => {
    const optionName = name.trim();
    const valueLabel = value.trim();
    const extraCharge = chargeOrNull(charge);
    if (!optionName || !valueLabel) return setError("Enter both the option name and the choice.");
    if (charge.trim() !== "" && (extraCharge === null || extraCharge < 0)) return setError("The extra charge must be a positive number of rupees, or blank.");
    if (draft.options.some((o) => o.optionName.toLowerCase() === optionName.toLowerCase() && o.valueLabel.toLowerCase() === valueLabel.toLowerCase())) {
      return setError("That choice already exists.");
    }
    setOptions([...draft.options, { optionName, valueLabel, extraCharge, sortOrder: draft.options.length }]);
    setValue("");
    setCharge("");
    setError(null);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.options.length) return;
    const next = [...draft.options];
    [next[index], next[target]] = [next[target], next[index]];
    setOptions(next);
  };

  return (
    <section id="section-options" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Options & Extra Charges</h2>
      <p className="mt-1 text-[12px] text-[#9B948F]">e.g. Finish → Gold tassels (+₹500). Leave the charge blank when a choice costs nothing extra.</p>

      {draft.options.length > 0 && (
        <ul className="mt-4 space-y-1.5" data-options-list>
          {draft.options.map((option, index) => (
            <li key={`${option.optionName}-${option.valueLabel}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#EEE5E8] bg-white px-3 py-2">
              <span className="text-[12px] font-semibold text-[#66565D]">{option.optionName}</span>
              <span className="flex-1 text-[13px] text-[#171717]">{option.valueLabel}</span>
              <input
                type="number"
                min={0}
                aria-label={`Extra charge for ${option.valueLabel}`}
                value={option.extraCharge ?? ""}
                placeholder="No extra"
                onChange={(event) => setOptions(draft.options.map((o, i) => (i === index ? { ...o, extraCharge: chargeOrNull(event.target.value) } : o)))}
                className="w-28 rounded-lg border border-[#D8D1D4] px-2 py-1 text-[12px]"
              />
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up" className="text-[12px] text-[#9B948F] disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === draft.options.length - 1} aria-label="Move down" className="text-[12px] text-[#9B948F] disabled:opacity-30">↓</button>
              <button type="button" onClick={() => setOptions(draft.options.filter((_, i) => i !== index))} aria-label={`Remove ${option.valueLabel}`} className="text-[14px] text-[#9B948F] hover:text-[#B3352D]">×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
        <input aria-label="Option name" placeholder="Option, e.g. Finish" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClassName} mt-0`} list="garland-option-names" />
        <datalist id="garland-option-names">
          {[...new Set(draft.options.map((o) => o.optionName))].map((n) => <option key={n} value={n} />)}
        </datalist>
        <input aria-label="Choice" placeholder="Choice, e.g. Gold tassels" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} className={`${inputClassName} mt-0`} />
        <input aria-label="Extra charge (₹)" placeholder="+₹ (optional)" type="number" min={0} value={charge} onChange={(e) => setCharge(e.target.value)} className={`${inputClassName} mt-0`} />
        <button type="button" onClick={add} className="rounded-lg border border-[#D8D1D4] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#171717] hover:border-[#7C243E] hover:text-[#7C243E]">
          Add
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-[#B3352D]" role="alert">{error}</p>}
    </section>
  );
}
