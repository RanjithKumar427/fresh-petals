import { useState } from "react";

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}

/**
 * Add/remove/reorder for a plain list of short text lines — shared by
 * What's Included and Care Instructions since both are exactly this
 * pattern with different labels and example copy. Reorder is up/down
 * buttons rather than drag here (unlike ImagesSection's grid, a single
 * column of text rows doesn't benefit much visually from drag, and
 * buttons are more precise and keyboard-accessible).
 */
export default function EditableList({ items, onChange, placeholder, addLabel }: Props) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-[#EEE5E8] bg-white px-3 py-2"
            >
              <span className="flex-1 text-[13px] text-[#171717]">{item}</span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="text-[12px] text-[#9B948F] transition hover:text-[#171717] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className="text-[12px] text-[#9B948F] transition hover:text-[#171717] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem(index)}
                aria-label="Remove"
                className="text-[14px] text-[#9B948F] transition hover:text-[#B3352D]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-[#D8D1D4] px-3 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
        />
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-[#D8D1D4] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}
