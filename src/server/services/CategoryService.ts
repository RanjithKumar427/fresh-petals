import { CategoryRepository, type Category } from "../db/repositories/CategoryRepository";
import { categoryInputSchema } from "../validation/categorySchema";
import { slugify } from "../utils/slugify";
import { ok, fail, zodFieldErrors, type ServiceResult } from "./result";

export const CategoryService = {
  list(): Category[] {
    return CategoryRepository.list();
  },

  get(id: number): Category | null {
    return CategoryRepository.findById(id);
  },

  getBySlug(slug: string): Category | null {
    return CategoryRepository.findBySlug(slug);
  },

  create(input: unknown): ServiceResult<Category> {
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    if (CategoryRepository.findBySlug(slug)) {
      return fail("A category with this slug already exists.", { slug: "Slug already in use." });
    }

    const category = CategoryRepository.create({ ...data, slug });
    return ok(category);
  },

  update(id: number, input: unknown): ServiceResult<Category> {
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    const clashing = CategoryRepository.findBySlug(slug);
    if (clashing && clashing.id !== id) {
      return fail("A category with this slug already exists.", { slug: "Slug already in use." });
    }

    const category = CategoryRepository.update(id, { ...data, slug });
    if (!category) return fail("Category not found.");
    return ok(category);
  },

  remove(id: number): ServiceResult<null> {
    const productCount = CategoryRepository.countProducts(id);
    if (productCount > 0) {
      return fail(
        `${productCount} product${productCount === 1 ? "" : "s"} still use this category. Reassign or delete them first.`
      );
    }

    CategoryRepository.delete(id);
    return ok(null);
  },
};
