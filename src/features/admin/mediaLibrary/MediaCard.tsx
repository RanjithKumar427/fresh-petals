import { FOLDER_LABELS, formatBytes, formatDate, type MediaListItem } from "./types";

interface Props {
  media: MediaListItem;
  view: "grid" | "list";
  onClick: () => void;
}

export default function MediaCard({ media, view, onClick }: Props) {
  const dimensions = media.width && media.height ? `${media.width}×${media.height}` : null;

  if (view === "list") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-4 border-b border-[#EEE5E8] px-4 py-3 text-left last:border-b-0 hover:bg-[#FBF7F5]"
      >
        <img src={media.url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-[#EEE5E8] object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#171717]">{media.filename}</p>
          <p className="text-[11px] text-[#9B948F]">
            {FOLDER_LABELS[media.folder]} · {dimensions ?? "—"} · {formatBytes(media.sizeBytes)}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-[#9B948F]">{formatDate(media.createdAt)}</span>
        <span className="shrink-0 text-[11px] text-[#9B948F]">
          {media.usageCount} use{media.usageCount === 1 ? "" : "s"}
        </span>
        {media.isPrimary && (
          <span className="shrink-0 rounded-full bg-[#F8DCE5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#7C243E]">
            Primary
          </span>
        )}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className="group overflow-hidden rounded-xl border border-[#EEE5E8] bg-white text-left transition hover:shadow-md">
      <div className="relative aspect-square bg-[#F8F1F3]">
        <img
          src={media.url}
          alt={media.altText ?? ""}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        {media.isPrimary && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#7C243E] shadow-sm">
            Primary
          </span>
        )}
        {media.usageCount > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white">
            {media.usageCount}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition group-hover:opacity-100">
          <p className="truncate text-[11px] font-medium text-white">{media.filename}</p>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[11px] font-medium text-[#171717]">{media.filename}</p>
        <p className="mt-0.5 text-[10px] text-[#9B948F]">
          {FOLDER_LABELS[media.folder]} {dimensions && `· ${dimensions}`} · {formatBytes(media.sizeBytes)}
        </p>
      </div>
    </button>
  );
}
