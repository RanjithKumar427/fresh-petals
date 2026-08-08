import { useEffect, useRef, useState } from "react";

export type OverflowMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

/** Shared "⋯" menu — used by both the product list rows and the editor top bar. */
export default function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#66565D] transition hover:bg-[#F8F1F3] hover:text-[#171717]"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-[#EEE5E8] bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-3 py-2 text-left text-[13px] transition hover:bg-[#F8F1F3] ${
                item.danger ? "text-[#B3352D]" : "text-[#171717]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
