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
  // ProductRepository is Postgres-backed (async) as of Phase 2B.1;
  // CategoryRepository/MediaRepository stay SQLite-backed (sync) until
  // their own migration phases. The three Postgres reads run concurrently
  // via Promise.all — they're independent queries, no reason to serialize
  // them — while the two SQLite reads resolve synchronously in between.
  async getStats(): Promise<DashboardStats> {
    const [totalProducts, publishedProducts, draftProducts, lastUpdated] = await Promise.all([
      ProductRepository.countAll(),
      ProductRepository.countByStatus("published"),
      ProductRepository.countByStatus("draft"),
      ProductRepository.lastUpdatedAt(),
    ]);

    return {
      totalProducts,
      publishedProducts,
      draftProducts,
      categories: CategoryRepository.count(),
      images: MediaRepository.count(),
      lastUpdated,
    };
  },
};
