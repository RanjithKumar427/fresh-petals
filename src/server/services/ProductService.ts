import {
  ProductRepository,
  type Product,
  type ProductListItem,
  type ProductListFilter,
  type ProductStatus,
} from "../db/repositories/ProductRepository";
import { CategoryRepository } from "../db/repositories/CategoryRepository";
import { CategoryService } from "./CategoryService";
import { productInputSchema } from "../validation/productSchema";
import { slugify } from "../utils/slugify";
import { ok, fail, zodFieldErrors, type ServiceResult } from "./result";

/** Appends -2, -3, ... until a slug that isn't already taken is found (optionally ignoring one product's own row). */
async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (true) {
    const clash = await ProductRepository.findBySlug(candidate);
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/**
 * Friendly, specific reasons a product isn't ready to publish — mirrored
 * (for instant feedback) by the editor's own checklist in PublishingSection,
 * but this copy is the one that actually gates the transition server-side.
 * Pure/synchronous: only inspects an already-loaded Product, no DB access.
 */
export function getPublishBlockers(product: Product): string[] {
  const blockers: string[] = [];

  if (!product.name.trim() || product.name === "Untitled Product") {
    blockers.push("Give this product a name.");
  }
  if (product.images.length === 0) {
    blockers.push("Add at least one image.");
  }
  if (product.categoryId === CategoryService.getOrCreateUncategorized().id) {
    blockers.push("Select where this product belongs.");
  }
  if ((product.priceType === "fixed" || product.priceType === "from") && !product.sellingPrice) {
    blockers.push("Enter a selling price.");
  }

  return blockers;
}

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
    compareAtPrice: data.compareAtPrice ?? null,
    costPrice: data.costPrice ?? null,
    deliveryChargeOverride: data.deliveryChargeOverride ?? null,
    stemCount: data.stemCount ?? null,
    colourTheme: data.colourTheme ?? null,
    arrangementStyle: data.arrangementStyle ?? null,
    size: data.size ?? null,
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

/** Every ProductRepository call in this service can now throw a RepositoryError (see pgErrors.ts) instead of a raw pg error — this turns that into the same friendly ServiceResult shape every other validation failure already uses, so API routes don't need to know anything changed. */
function friendlyMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong saving this product. Please try again.";
}

export const ProductService = {
  async list(filter?: ProductListFilter): Promise<ProductListItem[]> {
    return ProductRepository.list(filter);
  },

  async get(id: number): Promise<Product | null> {
    return ProductRepository.findById(id);
  },

  async getBySlug(slug: string): Promise<Product | null> {
    return ProductRepository.findBySlug(slug);
  },

  async create(input: unknown): Promise<ServiceResult<Product>> {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    if (await ProductRepository.findBySlug(slug)) {
      return fail("A product with this slug already exists.", { slug: "Slug already in use." });
    }
    if (!CategoryRepository.findById(data.categoryId)) {
      return fail("Selected category does not exist.", { categoryId: "Choose a valid category." });
    }

    const { core, relations } = splitInput({ ...data, slug });
    try {
      const product = await ProductRepository.create(core, relations);
      return ok(product);
    } catch (error) {
      return fail(friendlyMessage(error));
    }
  },

  async update(id: number, input: unknown): Promise<ServiceResult<Product>> {
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error.issues));
    }

    const data = parsed.data;
    const slug = data.slug || slugify(data.name);

    const clashing = await ProductRepository.findBySlug(slug);
    if (clashing && clashing.id !== id) {
      return fail("A product with this slug already exists.", { slug: "Slug already in use." });
    }
    if (!CategoryRepository.findById(data.categoryId)) {
      return fail("Selected category does not exist.", { categoryId: "Choose a valid category." });
    }

    const { core, relations } = splitInput({ ...data, slug });
    try {
      const product = await ProductRepository.update(id, core, relations);
      if (!product) return fail("Product not found.");
      return ok(product);
    } catch (error) {
      return fail(friendlyMessage(error));
    }
  },

  async remove(id: number): Promise<ServiceResult<null>> {
    if (!(await ProductRepository.findById(id))) return fail("Product not found.");
    try {
      await ProductRepository.delete(id);
      return ok(null);
    } catch (error) {
      return fail(friendlyMessage(error));
    }
  },

  async setStatus(id: number, status: ProductStatus): Promise<ServiceResult<Product>> {
    const existing = await ProductRepository.findById(id);
    if (!existing) return fail("Product not found.");

    // The editor's checklist does this same check client-side for instant
    // feedback, but this is the authoritative gate — a direct API call
    // (or a future non-editor caller) can't skip it.
    if (status === "published") {
      const blockers = getPublishBlockers(existing);
      if (blockers.length > 0) {
        return fail(blockers.join(" "));
      }
    }

    try {
      const product = await ProductRepository.setStatus(id, status);
      if (!product) return fail("Product not found.");
      return ok(product);
    } catch (error) {
      return fail(friendlyMessage(error));
    }
  },

  /** Clones a product as a new draft — images/tags/bullets copied, slug de-duplicated. */
  async duplicate(id: number): Promise<ServiceResult<Product>> {
    const source = await ProductRepository.findById(id);
    if (!source) return fail("Product not found.");

    const candidateSlug = await uniqueSlug(`${source.slug}-copy`);

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
      compareAtPrice: source.compareAtPrice,
      costPrice: source.costPrice,
      deliveryChargeOverride: source.deliveryChargeOverride,
      stemCount: source.stemCount,
      colourTheme: source.colourTheme,
      arrangementStyle: source.arrangementStyle,
      size: source.size,
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

    try {
      const product = await ProductRepository.create(core, relations);
      return ok(product);
    } catch (error) {
      return fail(friendlyMessage(error));
    }
  },

  /**
   * Creates the empty draft row the instant "Add Product" is clicked —
   * before the florist has typed anything. This is what makes autosave and
   * image upload possible at all (uploads need a real product id to attach
   * to), and it's why the schema's category_id stays NOT NULL rather than
   * nullable: every product, even a blank one, points at a real category
   * row (a standing "Uncategorized" placeholder) instead of carving out a
   * null-FK special case that every join would then have to handle. That
   * placeholder category is already migrated into Postgres (Phase 2A), so
   * this specific insert never touches the media-FK gap noted in
   * SupabaseProductRepository — there are no images or tags to reference yet.
   */
  async createDraft(): Promise<Product> {
    const uncategorized = CategoryService.getOrCreateUncategorized();
    const slug = await uniqueSlug("untitled-product");

    return ProductRepository.create(
      {
        slug,
        name: "Untitled Product",
        shortDescription: null,
        description: null,
        categoryId: uncategorized.id,
        status: "draft",
        featured: false,
        bestseller: false,
        newArrival: false,
        priceType: "market", // no sellingPrice required yet — Pricing section fills this in later
        sellingPrice: null,
        compareAtPrice: null,
        costPrice: null,
        deliveryChargeOverride: null,
        stemCount: null,
        colourTheme: null,
        arrangementStyle: null,
        size: null,
        requiresWhatsappConfirmation: true,
        seoTitle: null,
        seoDescription: null,
      },
      {
        images: [],
        occasionIds: [],
        moodIds: [],
        flowerTypeIds: [],
        whatsIncluded: [],
        careInstructions: [],
      }
    );
  },

  /** Powers the slug field's live "already taken" check + alternative suggestions in Basic Information. */
  async checkSlug(slug: string, excludeId?: number): Promise<{ available: boolean; suggestions: string[] }> {
    const clash = await ProductRepository.findBySlug(slug);
    const available = !clash || clash.id === excludeId;

    if (available) return { available: true, suggestions: [] };

    const suggestions: string[] = [];
    for (let suffix = 2; suggestions.length < 3 && suffix <= 8; suffix += 1) {
      const candidate = `${slug}-${suffix}`;
      if (!(await ProductRepository.findBySlug(candidate))) suggestions.push(candidate);
    }
    return { available: false, suggestions };
  },
};
