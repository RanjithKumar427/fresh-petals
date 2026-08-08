import { SECTIONS, getSectionStatus, type SectionStatus } from "./completion";
import type { ProductDraft } from "./types";

interface Props {
  draft: ProductDraft;
  activeSectionId: string;
  uncategorizedCategoryId: number;
}

function StatusMark({ status }: { status: SectionStatus }) {
  if (status === "complete") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#F3FFF7] text-[10px] text-[#075838]">
        ✓
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFF7E8] text-[10px] text-[#9A6B1F]">
        !
      </span>
    );
  }
  return <span className="h-4 w-4 text-center text-[11px] text-[#D8D1D4]">–</span>;
}

/** Section nav for the single-scroll editor — click scrolls smoothly to the section, it never changes route or hides content. */
export default function Sidebar({ draft, activeSectionId, uncategorizedCategoryId }: Props) {
  const scrollToSection = (id: string) => {
    const section = document.getElementById(`section-${id}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Focus the first field once the scroll settles, so keyboard users
    // land ready to type instead of having to tab through from the top.
    window.setTimeout(() => {
      const field = section?.querySelector<HTMLElement>("input, textarea, select, button[data-focusable]");
      field?.focus({ preventScroll: true });
    }, 400);
  };

  return (
    <nav className="space-y-0.5">
      {SECTIONS.map((section) => {
        const status = getSectionStatus(section.id, draft, uncategorizedCategoryId);
        const isActive = section.id === activeSectionId;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => scrollToSection(section.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition ${
              isActive ? "bg-[#F8DCE5] text-[#7C243E] font-medium" : "text-[#66565D] hover:bg-[#F8F1F3]"
            }`}
          >
            <span>{section.label}</span>
            <StatusMark status={status} />
          </button>
        );
      })}
    </nav>
  );
}
