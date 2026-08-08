import { useEffect, useMemo, useState } from "react";
import FolderChips from "./FolderChips";
import MediaToolbar, { type MediaFilter, type ViewMode } from "./MediaToolbar";
import MediaGrid from "./MediaGrid";
import MediaDetailPanel from "./MediaDetailPanel";
import UploadModal from "./UploadModal";
import { MEDIA_FOLDERS, type Media, type MediaFolder, type MediaListItem } from "./types";

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function MediaLibrary() {
  const [items, setItems] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<MediaFolder | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderCounts, setFolderCounts] = useState<Record<MediaFolder, number>>(
    Object.fromEntries(MEDIA_FOLDERS.map((f) => [f, 0])) as Record<MediaFolder, number>
  );

  const refresh = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder);
    if (search.trim()) params.set("search", search.trim());
    if (filter === "unused") params.set("unused", "true");

    const [listResponse, folderResponse] = await Promise.all([
      fetch(`/api/admin/media?${params.toString()}`),
      fetch("/api/admin/media/folders"),
    ]);
    const listResult = await listResponse.json();
    const folderResult = await folderResponse.json();

    if (listResult.ok) setItems(listResult.data);
    if (folderResult.ok) setFolderCounts(folderResult.data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, filter]);

  // Search is debounced client-side rather than re-fetching per keystroke.
  useEffect(() => {
    const timer = setTimeout(refresh, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visibleItems = useMemo(() => {
    if (filter !== "recent") return items;
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  }, [items, filter]);

  const totalCount = Object.values(folderCounts).reduce((sum, n) => sum + n, 0);

  const handleUploaded = (_media: Media) => {
    refresh();
  };

  return (
    <div>
      <div className="mb-4 space-y-3">
        <FolderChips active={folder} onChange={setFolder} counts={folderCounts} total={totalCount} />
        <MediaToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          view={view}
          onViewChange={setView}
          onUploadClick={() => setUploadOpen(true)}
        />
      </div>

      <p className="mb-3 text-[13px] text-[#77706F]">{loading ? "Loading…" : `${visibleItems.length} images`}</p>

      <MediaGrid items={visibleItems} view={view} loading={loading} onSelect={(media) => setSelectedId(media.id)} />

      <UploadModal
        open={uploadOpen}
        defaultFolder={folder ?? "products"}
        onUploaded={handleUploaded}
        onClose={() => {
          setUploadOpen(false);
          refresh();
        }}
      />

      <MediaDetailPanel
        mediaId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
        onDeleted={() => {
          setSelectedId(null);
          refresh();
        }}
      />
    </div>
  );
}
