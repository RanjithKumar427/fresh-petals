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
  getStats(): DashboardStats {
    return {
      totalProducts: ProductRepository.countAll(),
      publishedProducts: ProductRepository.countByStatus("published"),
      draftProducts: ProductRepository.countByStatus("draft"),
      categories: CategoryRepository.count(),
      images: MediaRepository.count(),
      lastUpdated: ProductRepository.lastUpdatedAt(),
    };
  },
};
