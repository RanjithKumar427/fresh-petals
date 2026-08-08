import {
  ProductRepository,
  type Product,
  type ProductListItem,
  type ProductListFilter,
  type ProductStatus,
} from "../db/repositories/ProductRepository";
import { CategoryRepository } from "../db/repositories/CategoryRepository";
import { productInputSchema } from "../validation/productSchema";
import { slugify } from "../utils/slugify";
import { ok, fail, zodFieldErrors, type ServiceResult } from "./result";

function splitInput(data: ReturnType<typeof productInputSchema.parse>) {
  const core = {
    slug: data.slug,
    name: data.name,
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    categoryId: data.categoryId,
    status: data.status,
    featured: data.featured,
    bestseller: data.bestseller,
    newArrival: data.newArrival,
    priceType: data.priceType,
    sellingPrice: data.sellingPrice ?? null,
    discountPrice: data.discountPrice ?? null,
    costPrice: data.costPrice ?? null,
    stemCount: data.stemCount ?? null,
    colourTheme: data.colourTheme ?? null,
    requiresWhatsappConfirmation: data.requiresWhatsappConfirmation,
    seoTitle: data.seoTitle ?? null,
    seoDescription: data.seoDescription ?? null,
  };

  const relations = {
    images: data.images,
    occasionIds: data.occasionIds,
    moodIds: data.moodIds,
    flowerTypeIds: data.flowerTypeIds,
    whatsIncluded: data.whatsIncluded,
    careInstructions: data.careInstructions,
  };

  return { core, relations };
}

export const ProductService = {
  list(filter?: ProductListFilter): ProductListItem[] {
    return ProductRepository.list(filter);
  },

  get(id: number): Product | null {
    return ProductRepository.findById(id);
  },

  getBySlug(slug: string): Product | null {
    return ProductRepository.findBySlug(slug);
  },

  create(input: unknown): ServiceResult<Product> {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    if (ProductRepository.findBySlug(slug)) {
      return fail("A product with this slug already exists.", { slug: "Slug already in use." });
    }
    if (!CategoryRepository.findById(data.categoryId)) {
      return fail("Selected category does not exist.", { categoryId: "Choose a valid category." });
    }

    const { core, relations } = splitInput({ ...data, slug });
    const product = ProductRepository.create(core, relations);
    return ok(product);
  },

  update(id: number, input: unknown): ServiceResult<Product> {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    const clashing = ProductRepository.findBySlug(slug);
    if (clashing && clashing.id !== id) {
      return fail("A product with this slug already exists.", { slug: "Slug already in use." });
    }
    if (!CategoryRepository.findById(data.categoryId)) {
      return fail("Selected category does not exist.", { categoryId: "Choose a valid category." });
    }

    const { core, relations } = splitInput({ ...data, slug });
    const product = ProductRepository.update(id, core, relations);
    if (!product) return fail("Product not found.");
    return ok(product);
  },

  remove(id: number): ServiceResult<null> {
    if (!ProductRepository.findById(id)) return fail("Product not found.");
    ProductRepository.delete(id);
    return ok(null);
  },

  setStatus(id: number, status: ProductStatus): ServiceResult<Product> {
    const product = ProductRepository.setStatus(id, status);
    if (!product) return fail("Product not found.");
    return ok(product);
  },

  /** Clones a product as a new draft — images/tags/bullets copied, slug de-duplicated. */
  duplicate(id: number): ServiceResult<Product> {
    const source = ProductRepository.findById(id);
    if (!source) return fail("Product not found.");

    let candidateSlug = `${source.slug}-copy`;
    let suffix = 2;
    while (ProductRepository.findBySlug(candidateSlug)) {
      candidateSlug = `${source.slug}-copy-${suffix}`;
      suffix += 1;
    }

    const core = {
      slug: candidateSlug,
      name: `${source.name} (Copy)`,
      shortDescription: source.shortDescription,
      description: source.description,
      categoryId: source.categoryId,
      status: "draft" as const,
      featured: false,
      bestseller: false,
      newArrival: false,
      priceType: source.priceType,
      sellingPrice: source.sellingPrice,
      discountPrice: source.discountPrice,
      costPrice: source.costPrice,
      stemCount: source.stemCount,
      colourTheme: source.colourTheme,
      requiresWhatsappConfirmation: source.requiresWhatsappConfirmation,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
    };

    const relations = {
      images: source.images.map((image, index) => ({
        mediaId: image.mediaId,
        altText: image.altText,
        sortOrder: index,
        isPrimary: image.isPrimary,
      })),
      occasionIds: source.occasionIds,
      moodIds: source.moodIds,
      flowerTypeIds: source.flowerTypeIds,
      whatsIncluded: source.whatsIncluded,
      careInstructions: source.careInstructions,
    };

    return ok(ProductRepository.create(core, relations));
  },
};
