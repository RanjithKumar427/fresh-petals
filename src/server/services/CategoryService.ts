import { CategoryRepository, type Category } from "../db/repositories/CategoryRepository";
import { categoryInputSchema } from "../validation/categorySchema";
import { slugify } from "../utils/slugify";
import { ok, fail, zodFieldErrors, type ServiceResult } from "./result";

export const CategoryService = {
  async list(): Promise<Category[]> {
    return CategoryRepository.list();
  },

  async get(id: number): Promise<Category | null> {
    return CategoryRepository.findById(id);
  },

  async getBySlug(slug: string): Promise<Category | null> {
    return CategoryRepository.findBySlug(slug);
  },

  async create(input: unknown): Promise<ServiceResult<Category>> {
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    if (await CategoryRepository.findBySlug(slug)) {
      return fail("A category with this slug already exists.", { slug: "Slug already in use." });
    }

    const category = await CategoryRepository.create({ ...data, slug });
    return ok(category);
  },

  async update(id: number, input: unknown): Promise<ServiceResult<Category>> {
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    const clashing = await CategoryRepository.findBySlug(slug);
    if (clashing && clashing.id !== id) {
      return fail("A category with this slug already exists.", { slug: "Slug already in use." });
    }

    const category = await CategoryRepository.update(id, { ...data, slug });
    if (!category) return fail("Category not found.");
    return ok(category);
  },

  /**
   * Every product needs a real category_id (schema keeps that FK required —
   * see docs/architecture/admin-dashboard.md). A brand-new draft is created
   * before the florist has chosen anything, so it's pinned to this
   * always-present placeholder until Classification is filled in.
   */
  async getOrCreateUncategorized(): Promise<Category> {
    const existing = await CategoryRepository.findBySlug("uncategorized");
    if (existing) return existing;
    return CategoryRepository.create({
      name: "Uncategorized",
      slug: "uncategorized",
      description: "Default category for new drafts until a real one is chosen.",
      sortOrder: -1,
    });
  },

  async remove(id: number): Promise<ServiceResult<null>> {
    const productCount = await CategoryRepository.countProducts(id);
    if (productCount > 0) {
      return fail(
        `${productCount} product${productCount === 1 ? "" : "s"} still use this category. Reassign or delete them first.`
      );
    }

    await CategoryRepository.delete(id);
    return ok(null);
  },
};
