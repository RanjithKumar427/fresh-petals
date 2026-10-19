// The dashboard status versus what the deployed storefront shows, for
// non-garland products (rules in ./storefrontReadiness.ts).
import type { ProductStatus } from "./types";
import { storefrontDetails, storefrontMessage, type StorefrontReadiness } from "./storefrontReadiness";

export type { StorefrontReadiness };

const TONES = {
  ok: "bg-[#EEF5EE] text-[#2E5A3A]",
  pending: "bg-[#FFF7E8] text-[#7A5210]",
  off: "bg-[#F5F2F3] text-[#66565D]",
  problem: "bg-[#FBEAEE] text-[#7C243E]",
};

export default function StorefrontStatus({ status, sellingPrice, readiness }: { status: ProductStatus; sellingPrice: number | null; readiness: StorefrontReadiness }) {
  const message = storefrontMessage(status, readiness);
  const details = storefrontDetails(status, sellingPrice, readiness);
  return (
    <div className="mt-5 space-y-2" data-storefront-status={message.tone}>
      <p className="fp-eyebrow">Storefront</p>
      <p className={`rounded-lg px-3 py-2 text-[12px] leading-5 ${TONES[message.tone]}`}>{message.text}</p>
      <dl className="grid grid-cols-1 gap-1 text-[12px] leading-5 sm:grid-cols-3" data-storefront-rows>
        {details.rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[#77706F]">{row.label}</dt>
            <dd className="font-medium text-[#171717]">{row.value}</dd>
          </div>
        ))}
      </dl>
      {details.pending.length > 0 && (
        <div className="text-[12px] leading-5 text-[#7A5210]" data-storefront-pending>
          <p className="font-semibold">Waiting for the next deployment</p>
          <ul className="list-disc pl-5">
            {details.pending.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}
      {details.notShown.length > 0 && (
        <p className="text-[12px] leading-5 text-[#7A5210]" data-storefront-drift>
          Edited here but not shown on the storefront (it uses the catalogue entry): {details.notShown.join(", ")}. As of when this page was opened.
        </p>
      )}
      {details.deliberate.length > 0 && (
        <p className="text-[12px] leading-5 text-[#77706F]">Deliberate differences: {details.deliberate.join("; ")}.</p>
      )}
      <p className="text-[12px] leading-5 text-[#77706F]">
        The storefront takes {readiness.databaseFields.join(", ")} from here. It does not show edits to {readiness.unmappedFields.join(", ")}:{" "}
        {readiness.mapped ? "those come from the product's catalogue entry, and differences are listed above." : "a catalogue entry has to supply them."}
        {readiness.uncomparedFields && readiness.uncomparedFields.length > 0 ? ` ${readiness.uncomparedFields.join(", ")} have no matching catalogue field: not shown and not compared.` : ""}
      </p>
    </div>
  );
}
