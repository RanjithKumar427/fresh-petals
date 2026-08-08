import type { CategoryOption, ProductStatus } from "./types";

export type SortOption = "updated" | "name" | "price";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  categoryId: number | null;
  onCategoryChange: (value: number | null) => void;
  categories: CategoryOption[];
  status: ProductStatus | "all";
  onStatusChange: (value: ProductStatus | "all") => void;
  statusCounts: Record<"all" | ProductStatus, number>;
  featuredOnly: boolean;
  onFeaturedOnlyChange: (value: boolean) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
}

const STATUS_TABS: { key: "all" | ProductStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

export default function ProductListToolbar({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  categories,
  status,
  onStatusChange,
  statusCounts,
  featuredOnly,
  onFeaturedOnlyChange,
  sort,
  onSortChange,
}: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-1 rounded-full bg-[#F8F1F3] p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onStatusChange(tab.key)}
            className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
              status === tab.key ? "bg-white text-[#7C243E] shadow-sm" : "text-[#66565D] hover:text-[#171717]"
            }`}
          >
            {tab.label} <span className="text-[10px] opacity-70">{statusCounts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search products…"
          className="w-full max-w-xs rounded-full border border-[#D8D1D4] px-4 py-2 text-[13px] text-[#171717] outline-none focus:border-[#7C243E]"
        />

        <select
          value={categoryId ?? ""}
          onChange={(event) => onCategoryChange(event.target.value ? Number(event.target.value) : null)}
          className="rounded-full border border-[#D8D1D4] px-3 py-2 text-[12px] text-[#171717] outline-none focus:border-[#7C243E]"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onFeaturedOnlyChange(!featuredOnly)}
          className={`rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
            featuredOnly ? "border-[#7C243E] bg-[#F8DCE5] text-[#7C243E]" : "border-[#D8D1D4] text-[#66565D]"
          }`}
        >
          ★ Featured only
        </button>

        <select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortOption)}
          className="ml-auto rounded-full border border-[#D8D1D4] px-3 py-2 text-[12px] text-[#171717] outline-none focus:border-[#7C243E]"
        >
          <option value="updated">Sort: Last updated</option>
          <option value="name">Sort: Name</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>
    </div>
  );
}
