import FormField, { inputClassName } from "../../shared/FormField";
import { computeDiscountPercent, computeMargin, computeSavings, formatCurrency } from "../../../../shared/pricing";
import type { PriceType, ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  onChange: (patch: Partial<ProductDraft>) => void;
}

const PRICE_TYPE_OPTIONS: { value: PriceType; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed", hint: "One set price" },
  { value: "from", label: "Starting From", hint: "e.g. “From ₹1,499”" },
  { value: "market", label: "Market Price", hint: "Confirmed on WhatsApp" },
  { value: "quote", label: "Custom Quote", hint: "Confirmed on WhatsApp" },
];

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PricingSection({ draft, onChange }: Props) {
  const needsSellingPrice = draft.priceType === "fixed" || draft.priceType === "from";
  const savings = computeSavings(draft.sellingPrice, draft.compareAtPrice);
  const discountPercent = computeDiscountPercent(draft.sellingPrice, draft.compareAtPrice);
  const margin = computeMargin(draft.sellingPrice, draft.costPrice);

  return (
    <section id="section-pricing" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Pricing</h2>

      <div className="mt-5">
        <label className="fp-label block text-[10px] text-[#66565D]">Price Type</label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRICE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ priceType: option.value })}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                draft.priceType === option.value
                  ? "border-[#7C243E] bg-[#F8DCE5]"
                  : "border-[#D8D1D4] hover:border-[#9B6B78]"
              }`}
            >
              <p className="text-[12px] font-semibold text-[#171717]">{option.label}</p>
              <p className="text-[10px] text-[#9B948F]">{option.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          label={`Selling Price ${needsSellingPrice ? "" : "(optional)"}`}
          htmlFor="sellingPrice"
          tip={needsSellingPrice && !draft.sellingPrice ? "Enter a selling price." : undefined}
        >
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9B948F]">
              ₹
            </span>
            <input
              id="sellingPrice"
              type="number"
              min={0}
              value={draft.sellingPrice ?? ""}
              onChange={(event) => onChange({ sellingPrice: numberOrNull(event.target.value) })}
              className={`${inputClassName} mt-0 pl-7`}
            />
          </div>
        </FormField>

        <FormField label="Compare-at Price (optional)" htmlFor="compareAtPrice" hint="Shown struck through, above the selling price.">
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9B948F]">
              ₹
            </span>
            <input
              id="compareAtPrice"
              type="number"
              min={0}
              value={draft.compareAtPrice ?? ""}
              onChange={(event) => onChange({ compareAtPrice: numberOrNull(event.target.value) })}
              className={`${inputClassName} mt-0 pl-7`}
            />
          </div>
        </FormField>

        <FormField label="Cost Price (optional)" htmlFor="costPrice" hint="Internal only — never shown to customers.">
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9B948F]">
              ₹
            </span>
            <input
              id="costPrice"
              type="number"
              min={0}
              value={draft.costPrice ?? ""}
              onChange={(event) => onChange({ costPrice: numberOrNull(event.target.value) })}
              className={`${inputClassName} mt-0 pl-7`}
            />
          </div>
        </FormField>

        <FormField
          label="Delivery Charge Override (optional)"
          htmlFor="deliveryChargeOverride"
          hint="Leave blank to use the standard delivery charge."
        >
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9B948F]">
              ₹
            </span>
            <input
              id="deliveryChargeOverride"
              type="number"
              min={0}
              value={draft.deliveryChargeOverride ?? ""}
              onChange={(event) => onChange({ deliveryChargeOverride: numberOrNull(event.target.value) })}
              className={`${inputClassName} mt-0 pl-7`}
            />
          </div>
        </FormField>
      </div>

      {(savings !== null || margin !== null) && (
        <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-[#FBF7F5] p-4 sm:grid-cols-3">
          <div>
            <p className="fp-eyebrow">Customer Savings</p>
            <p className="mt-1 text-[16px] font-semibold text-[#171717]">
              {savings !== null ? formatCurrency(savings) : "—"}
            </p>
          </div>
          <div>
            <p className="fp-eyebrow">Discount</p>
            <p className="mt-1 text-[16px] font-semibold text-[#171717]">
              {discountPercent !== null ? `${discountPercent}%` : "—"}
            </p>
          </div>
          <div>
            <p className="fp-eyebrow">Profit Margin</p>
            <p className="mt-1 text-[16px] font-semibold text-[#171717]">
              {margin !== null ? `${formatCurrency(margin.amount)} (${margin.percent}%)` : "—"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
