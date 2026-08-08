interface Props {
  label: string;
  selected: boolean;
  onClick: () => void;
}

/** Toggleable pill — used everywhere the editor needs "chips instead of checkboxes" (Occasions, Moods, Flower Types, merchandising flags). */
export default function Chip({ label, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${
        selected
          ? "border-[#7C243E] bg-[#F8DCE5] text-[#7C243E]"
          : "border-[#D8D1D4] text-[#66565D] hover:border-[#9B6B78]"
      }`}
    >
      {label}
    </button>
  );
}
