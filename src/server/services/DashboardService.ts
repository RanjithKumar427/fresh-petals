import { ProductRepository } from "../db/repositories/ProductRepository";
import { CategoryRepository } from "../db/repositories/CategoryRepository";
import { MediaRepository } from "../db/repositories/MediaRepository";

export type DashboardStats = {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  categories: number;
  images: number;
  lastUpdated: string | null;
};

export const DashboardService = {
  // All five reads are Postgres-backed as of Phase 2B.2 (Product since
  // 2B.1; Category and Media joined this phase) — independent queries,
  // run concurrently via Promise.all rather than serialized, same
  // reasoning as Phase 2B.1's original version of this method.
  async getStats(): Promise<DashboardStats> {
    const [totalProducts, publishedProducts, draftProducts, lastUpdated, categories, images] = await Promise.all([
      ProductRepository.countAll(),
      ProductRepository.countByStatus("published"),
      ProductRepository.countByStatus("draft"),
      ProductRepository.lastUpdatedAt(),
      CategoryRepository.count(),
      MediaRepository.count(),
    ]);

    return { totalProducts, publishedProducts, draftProducts, categories, images, lastUpdated };
  },
};
