import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import ProductCard from "../../../../components/ProductCard.astro";
import GarlandCard from "../../../../components/GarlandCard.astro";
import { json } from "../../../../server/http/json";
import { formatPriceLabel } from "../../../../shared/pricing";

export const prerender = false;

// Renders the *real* ProductCard.astro server-side and hands back plain
// HTML — this is the whole live-preview mechanism. No iframe, no
// postMessage protocol, no second "preview" page route to keep in sync:
// the component the storefront actually uses is rendered here exactly as
// it would be anywhere else, just fed draft data instead of a saved
// product. The panel injects the returned markup into a plain div; any
// <script> in ProductCard (its add-to-cart handler) comes along as inert
// text since it wasn't inserted via the DOM's normal parsing path — which
// is desirable here, an admin preview shouldn't wire up a live cart button.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));

  const priceType = body.priceType || "market";
  const priceLabel = formatPriceLabel({ priceType, sellingPrice: body.sellingPrice ?? null });

  const container = await AstroContainer.create();

  // Garlands preview as the real GarlandCard the storefront uses for them.
  if (body.garland && typeof body.garland.designCode === "string") {
    const g = body.garland;
    const priced = priceType === "fixed" && Number(body.sellingPrice) > 0;
    const design = {
      code: g.designCode,
      slug: body.slug || "",
      title: body.name || "Untitled garland",
      filters: Array.isArray(g.filters) ? g.filters : [],
      filterRecipeVerified: !!g.flowerRecipe,
      // The card's "Draft" badge follows the real publication rules.
      status: g.status === "published" ? "published" : "draft",
      published: g.status === "published",
      hasStoredPhoto: !!g.hasStoredPhoto,
      readyForSale: !!g.readyForSale,
      sellingMode: g.sellingMode === "cart" ? "cart" : "enquiry",
      price: priced ? Number(body.sellingPrice) : null,
      currency: "INR",
      priceConfirmed: priced,
      soldUnit: g.soldUnit ?? null,
      length: g.length ?? null,
      flowerRecipe: g.flowerRecipe ?? null,
      weightOrThickness: g.thickness ?? null,
      finish: g.finish ?? null,
      leadTime: g.leadTime ?? null,
      substitutionPolicy: g.substitutionPolicy ?? null,
      options: [],
      photoPermission: g.photoPermission ?? "unconfirmed",
      sampleVerified: !!g.sampleVerified,
      firstSample: false,
      image: { path: body.image || "/images/product-placeholder.svg", width: g.width || 800, height: g.height || 1000, alt: g.altText || body.name || "" },
      gallery: [],
      relatedViews: [],
    };
    const html = await container.renderToString(GarlandCard, {
      props: { product: { ...design, id: `garland-${design.code.toLowerCase()}`, name: design.title, category: "Garlands", image: design.image.path, priceLabel, priceType, description: "", longDescription: "", isAvailable: true, requiresConfirmation: true, badge: design.code, collectionTags: [], occasionTags: [], flowerTypes: [], whatsIncluded: [], careNotes: [], garland: design } },
    });
    return json({ ok: true, data: { html } });
  }

  const html = await container.renderToString(ProductCard, {
    props: {
      name: body.name || "Untitled Product",
      image: body.image || "/images/product-placeholder.svg",
      category: body.category || "Uncategorized",
      description: body.description || "Fresh flowers made on order based on availability.",
      slug: body.slug || undefined,
      priceType,
      priceLabel,
      isAvailable: true,
    },
  });

  return json({ ok: true, data: { html } });
};
