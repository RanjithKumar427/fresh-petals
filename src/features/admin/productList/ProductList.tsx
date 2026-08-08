import { useEffect, useMemo, useState } from "react";
import ProductListToolbar, { type SortOption } from "./ProductListToolbar";
import ProductListRow from "./ProductListRow";
import ConfirmDialog from "../shared/ConfirmDialog";
import { formatPrice, type CategoryOption, type ProductListItem, type ProductStatus } from "./types";

interface Props {
  categories: CategoryOption[];
}

export default function ProductList({ categories }: Props) {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("updated");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/products");
    const result = await response.json();
    if (result.ok) setProducts(result.data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const statusCounts = useMemo(() => {
    const counts = { all: products.length, draft: 0, published: 0, archived: 0 };
    for (const product of products) counts[product.status] += 1;
    return counts;
  }, [products]);

  const visibleProducts = useMemo(() => {
    let list = products;

    if (status !== "all") list = list.filter((p) => p.status === status);
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
    if (featuredOnly) list = list.filter((p) => p.featured);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(term) || p.slug.includes(term));
    }

    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "price") sorted.sort((a, b) => (a.sellingPrice ?? 0) - (b.sellingPrice ?? 0));
    else sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return sorted;
  }, [products, status, categoryId, featuredOnly, search, sort]);

  const setProductStatus = async (id: number, next: ProductStatus) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status: next } : p)));
    await fetch(`/api/admin/products/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const handleDuplicate = async (id: number) => {
    await fetch(`/api/admin/products/${id}/duplicate`, { method: "POST" });
    refresh();
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    await fetch(`/api/admin/products/${deletingId}`, { method: "DELETE" });
    setDeletingId(null);
    refresh();
  };

  const deletingProduct = products.find((p) => p.id === deletingId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13px] text-[#77706F]">
          {loading ? "Loading…" : `${visibleProducts.length} of ${products.length} products`}
        </p>
        <a
          href="/admin/products/new"
          className="rounded-full bg-[#111111] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#7C243E]"
        >
          + Add Product
        </a>
      </div>

      <ProductListToolbar
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        categories={categories}
        status={status}
        onStatusChange={setStatus}
        statusCounts={statusCounts}
        featuredOnly={featuredOnly}
        onFeaturedOnlyChange={setFeaturedOnly}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="fp-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-10 text-center text-[13px] text-[#9B948F]">Loading products…</p>
        ) : visibleProducts.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-medium text-[#171717]">No products match these filters</p>
            <p className="mt-1 text-[13px] text-[#9B948F]">Try clearing search or filters, or add a new product.</p>
          </div>
        ) : (
          visibleProducts.map((product) => (
            <ProductListRow
              key={product.id}
              product={product}
              onPublish={() => setProductStatus(product.id, "published")}
              onArchive={() => setProductStatus(product.id, "archived")}
              onUnarchive={() => setProductStatus(product.id, "draft")}
              onDuplicate={() => handleDuplicate(product.id)}
              onDelete={() => setDeletingId(product.id)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={deletingId !== null}
        title="Delete this product?"
        message={
          deletingProduct
            ? `"${deletingProduct.name}" (${formatPrice(deletingProduct)}) will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
