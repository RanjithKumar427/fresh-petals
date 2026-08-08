import StatusPill from "../shared/StatusPill";
import OverflowMenu, { type OverflowMenuItem } from "../shared/OverflowMenu";
import { formatPrice, type ProductListItem } from "./types";

interface Props {
  product: ProductListItem;
  onPublish: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

export default function ProductListRow({ product, onPublish, onArchive, onUnarchive, onDuplicate, onDelete }: Props) {
  const menuItems: OverflowMenuItem[] = [
    { label: "Duplicate", onClick: onDuplicate },
    ...(product.status === "archived"
      ? [{ label: "Restore to Draft", onClick: onUnarchive }]
      : [{ label: "Archive", onClick: onArchive }]),
    { label: "Delete", onClick: onDelete, danger: true },
  ];

  return (
    <div className="flex items-center gap-4 border-b border-[#EEE5E8] px-4 py-3 last:border-b-0 hover:bg-[#FBF7F5]">
      <img
        src={product.primaryImageUrl || "/images/product-placeholder.svg"}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg border border-[#EEE5E8] object-cover"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/admin/products/edit/${product.id}`}
            className="truncate text-[14px] font-medium text-[#171717] hover:text-[#7C243E]"
          >
            {product.name}
          </a>
          {product.featured && (
            <span className="inline-flex items-center rounded-full bg-[#F8DCE5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#7C243E]">
              ★ Featured
            </span>
          )}
          {product.bestseller && (
            <span className="inline-flex items-center rounded-full bg-[#FFF1E0] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#9A5B1F]">
              🔥 Bestseller
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[#9B6B78]">{product.categoryName}</p>
      </div>

      <div className="hidden w-28 shrink-0 text-[13px] text-[#171717] sm:block">{formatPrice(product)}</div>

      <div className="hidden w-28 shrink-0 sm:block">
        <StatusPill status={product.status} />
      </div>

      <div className="hidden w-24 shrink-0 text-[12px] text-[#9B948F] md:block">{timeAgo(product.updatedAt)}</div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={`/products/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Preview on storefront"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#66565D] transition hover:bg-[#F8F1F3] hover:text-[#171717]"
        >
          👁
        </a>
        <a
          href={`/admin/products/edit/${product.id}`}
          className="rounded-full border border-[#D8D1D4] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#171717] transition hover:border-[#7C243E] hover:text-[#7C243E]"
        >
          Edit
        </a>
        {product.status !== "published" && (
          <button
            type="button"
            onClick={onPublish}
            className="rounded-full bg-[#111111] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#7C243E]"
          >
            Publish
          </button>
        )}
        <OverflowMenu items={menuItems} />
      </div>
    </div>
  );
}
