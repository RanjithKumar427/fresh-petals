import StatusPill from "../../shared/StatusPill";
import type { ProductDraft } from "../types";

interface Props {
  draft: ProductDraft;
  blockers: string[];
  onSaveDraft: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PublishingSection({ draft, blockers, onSaveDraft, onPublish, onArchive, onUnarchive }: Props) {
  return (
    <section id="section-publishing" className="fp-card scroll-mt-6 p-6">
      <h2 className="fp-serif text-lg tracking-[0.08em] text-[#171717]">Publishing</h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="fp-eyebrow">Status</p>
          <div className="mt-1.5">
            <StatusPill status={draft.status} />
          </div>
        </div>
        <div>
          <p className="fp-eyebrow">Publish Date</p>
          <p className="mt-1.5 text-[13px] text-[#171717]">{formatDate(draft.publishedAt)}</p>
        </div>
        <div>
          <p className="fp-eyebrow">Last Updated</p>
          <p className="mt-1.5 text-[13px] text-[#171717]">{formatDate(draft.updatedAt)}</p>
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="mt-5 rounded-xl bg-[#FFF7E8] p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#9A6B1F]">Before you publish</p>
          <ul className="mt-2 space-y-1">
            {blockers.map((blocker) => (
              <li key={blocker} className="flex items-center gap-2 text-[13px] text-[#7A5210]">
                <span aria-hidden>•</span> {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSaveDraft}
          className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
        >
          Save Draft
        </button>

        {draft.status === "archived" ? (
          <button
            type="button"
            onClick={onUnarchive}
            className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#7C243E]"
          >
            Restore to Draft
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#7C243E]"
          >
            Archive
          </button>
        )}

        {draft.status !== "published" && (
          <button
            type="button"
            onClick={onPublish}
            className="rounded-full bg-[#111111] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#7C243E]"
          >
            Publish
          </button>
        )}

        <a
          href={`/products/${draft.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-full border border-[#D8D1D4] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#7C243E]"
        >
          Preview ↗
        </a>
      </div>
      <p className="mt-2 text-[11px] text-[#9B948F]">
        Preview opens the live storefront page — new products appear there once the storefront is rebuilt.
      </p>
    </section>
  );
}
