import type { APIRoute } from "astro";
import { ProductService } from "../../../../server/services/ProductService";
import type { ProductStatus } from "../../../../server/db/repositories/ProductRepository";
import { json } from "../../../../server/http/json";

export const prerender = false;

/** Backs the Product List island's search/category/status/featured filtering — no page reload per filter change. */
export const GET: APIRoute = async ({ url }) => {
  const search = url.searchParams.get("search") ?? undefined;
  const categoryId = url.searchParams.get("categoryId");
  const status = url.searchParams.get("status") as ProductStatus | null;
  const featured = url.searchParams.get("featured") === "true";

  const products = ProductService.list({
    search,
    categoryId: categoryId ? Number(categoryId) : undefined,
    status: status ?? undefined,
    featured: featured || undefined,
  });

  return json({ ok: true, data: products });
};
