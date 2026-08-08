export type MediaFilter = "all" | "unused" | "recent";
export type ViewMode = "grid" | "list";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  filter: MediaFilter;
  onFilterChange: (value: MediaFilter) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  onUploadClick: () => void;
}

export default function MediaToolbar({ search, onSearchChange, filter, onFilterChange, view, onViewChange, onUploadClick }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by filename or alt text…"
        className="w-full max-w-xs rounded-full border border-[#D8D1D4] px-4 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
      />

      <select
        value={filter}
        onChange={(event) => onFilterChange(event.target.value as MediaFilter)}
        className="rounded-full border border-[#D8D1D4] px-3 py-2 text-[12px] text-[#171717] outline-none focus:border-[#7C243E]"
      >
        <option value="all">All images</option>
        <option value="unused">Unused images</option>
        <option value="recent">Recently uploaded</option>
      </select>

      <div className="flex gap-1 rounded-full bg-[#F8F1F3] p-1">
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          aria-label="Grid view"
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            view === "grid" ? "bg-white text-[#7C243E] shadow-sm" : "text-[#77706F]"
          }`}
        >
          Grid
        </button>
        <button
          type="button"
          onClick={() => onViewChange("list")}
          aria-label="List view"
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
            view === "list" ? "bg-white text-[#7C243E] shadow-sm" : "text-[#77706F]"
          }`}
        >
          List
        </button>
      </div>

      <button
        type="button"
        onClick={onUploadClick}
        className="ml-auto rounded-full bg-[#111111] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#7C243E]"
      >
        + Upload
      </button>
    </div>
  );
}
