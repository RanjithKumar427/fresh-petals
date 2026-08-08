import MediaCard from "./MediaCard";
import type { MediaListItem } from "./types";

interface Props {
  items: MediaListItem[];
  view: "grid" | "list";
  loading: boolean;
  onSelect: (media: MediaListItem) => void;
}

export default function MediaGrid({ items, view, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-xl bg-[#EEE5E8]" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="fp-card px-4 py-16 text-center">
        <p className="text-[14px] font-medium text-[#171717]">No images found</p>
        <p className="mt-1 text-[13px] text-[#9B948F]">Try a different search or filter, or upload a new image.</p>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div className="fp-card overflow-hidden">
        {items.map((media) => (
          <MediaCard key={media.id} media={media} view="list" onClick={() => onSelect(media)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((media) => (
        <MediaCard key={media.id} media={media} view="grid" onClick={() => onSelect(media)} />
      ))}
    </div>
  );
}
