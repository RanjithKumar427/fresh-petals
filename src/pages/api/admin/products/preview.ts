import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import ProductCard from "../../../../components/ProductCard.astro";
import { json } from "../../../../server/http/json";

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

  const container = await AstroContainer.create();
  const html = await container.renderToString(ProductCard, {
    props: {
      name: body.name || "Untitled Product",
      image: body.image || "/images/product-placeholder.svg",
      category: body.category || "Uncategorized",
      description: body.description || "Fresh flowers made on order based on availability.",
      slug: body.slug || undefined,
      priceType: body.priceType || "market",
      isAvailable: true,
    },
  });

  return json({ ok: true, data: { html } });
};
