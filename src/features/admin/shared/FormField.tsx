import type { ReactNode } from "react";

interface Props {
  label: string;
  htmlFor?: string;
  hint?: string;
  tip?: string;
  error?: string;
  children: ReactNode;
}

export const inputClassName =
  "mt-1 w-full rounded-lg border border-[#D8D1D4] px-3 py-2.5 text-[14px] text-[#171717] outline-none transition focus:border-[#7C243E]";

/** One label/input/help-text group, styled consistently across every editor section. */
export default function FormField({ label, htmlFor, hint, tip, error, children }: Props) {
  return (
    <div>
      <label className="fp-label block text-[10px] text-[#66565D]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[12px] text-[#9B948F]">{hint}</p>}
      {tip && !error && (
        <p className="mt-1 text-[12px] text-[#7C243E]">
          <span aria-hidden>✨ </span>
          {tip}
        </p>
      )}
      {error && <p className="mt-1 text-[12px] text-[#B3352D]">{error}</p>}
    </div>
  );
}
