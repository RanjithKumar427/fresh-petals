// Local preview of the homepage occasion carousel with all six occasions,
// for design review. Run: npm run preview:occasions
//
// Development server only. Nothing is written to the database, to
// productCatalog.ts or to any build output: occasion tags are rewritten in
// memory while the dev server loads the catalogue. `astro build` with this
// config is refused, so fixture assignments can never be deployed.
//
// FP_OCCASION_FIXTURE overrides the assignment ("route=slug,slug;route=" —
// an empty list removes a route's tags, e.g. "birthday=;anniversary=" for the
// empty state). Prices are still read from DATABASE_URL (read-only).
// FP_LOCAL_PG=1 connects to a plain local Postgres without the Supabase TLS
// certificate (see docs/occasion-carousel.md).
import base from "../astro.config.mjs";

const SIX_OCCASIONS =
  "wedding=red-affair,rose-promise;engagement=pink-lily-wish;housewarming=sunshine-story,colourful-confession;sympathy=blush-lily-letter";
const spec = process.env.FP_OCCASION_FIXTURE ?? SIX_OCCASIONS;
const rules = spec
  .split(";")
  .filter(Boolean)
  .map((part) => {
    const [route, slugs = ""] = part.split("=");
    return [route.trim(), slugs.split(",").map((slug) => slug.trim()).filter(Boolean)];
  });

const fixtureTags = {
  name: "fresh-petals:occasion-fixture",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith("/src/data/productCatalog.ts")) return;
    return `${code}
for (const [route, slugs] of ${JSON.stringify(rules)}) {
  for (const product of productCatalog) {
    const tags = (product.occasionTags ?? []).filter((tag) => tag !== route);
    if (slugs.includes(product.slug)) tags.push(route);
    product.occasionTags = tags;
  }
}
`;
  },
};

const localPostgres = {
  name: "fresh-petals:local-postgres",
  enforce: "pre",
  resolveId(id) {
    if (/(^|\/)supabaseCa(\.ts)?$/.test(id)) return "\0fp-local-postgres-ssl";
  },
  load(id) {
    if (id === "\0fp-local-postgres-ssl") return "export const supabasePoolSsl = false;";
  },
};

const devOnly = {
  name: "fresh-petals:occasion-fixture-dev-only",
  hooks: {
    "astro:config:setup": ({ command }) => {
      if (command !== "dev") {
        throw new Error("scripts/occasion-fixture.config.mjs is for `astro dev` previews only; build with the normal config.");
      }
    },
  },
};

export default {
  ...base,
  integrations: [...(base.integrations ?? []), devOnly],
  vite: {
    ...base.vite,
    plugins: [fixtureTags, ...(process.env.FP_LOCAL_PG === "1" ? [localPostgres] : []), ...(base.vite?.plugins ?? [])],
  },
};
