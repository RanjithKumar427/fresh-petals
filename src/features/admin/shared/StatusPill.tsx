// React port of src/components/admin/StatusBadge.astro's lookup tables —
// Astro components can't render inside a React tree, and this one is a
// 3-line color/label map, small enough that keeping two trivial copies in
// sync costs less than routing every list row through a server call (unlike
// ProductCard, which is why that one goes through the preview endpoint
// instead of being ported).
const STYLES: Record<string, string> = {
  draft: "bg-[#F3F0EE] text-[#77706F]",
  published: "bg-[#F3FFF7] text-[#075838]",
  archived: "bg-[#FBEAEE] text-[#7C243E]",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${STYLES[status] ?? STYLES.draft}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
