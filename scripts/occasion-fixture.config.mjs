// Local preview of the homepage occasion carousel with all six occasions,
// for design review. Run: npm run preview:occasions
//
// Development server only. Nothing is written to the database or to any
// file: the admin's occasion assignments (OccasionMembership.ts) are read as
// usual and then adjusted in memory for this dev server. `astro build` with
// this config is refused, so fixture assignments can never be deployed.
//
// FP_OCCASION_FIXTURE adjusts the assignments ("route=slug,slug;route=" —
// the listed products gain the route and every other product loses it; an
// empty list clears a route, e.g. "birthday=;anniversary=;sympathy=" for the
// empty state). Prices and real assignments are read from DATABASE_URL
// (read-only).
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

const fixtureMembership = {
  name: "fresh-petals:occasion-fixture",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith("/src/server/services/OccasionMembership.ts")) return;
    return `${code}
const __readOccasionMembership = loadOccasionMembership;
loadOccasionMembership = async (slugs) => {
  const membership = await __readOccasionMembership(slugs);
  for (const [route, chosen] of ${JSON.stringify(rules)}) {
    for (const [slug, list] of membership) {
      const next = list.filter((occasion) => occasion !== route);
      if (chosen.includes(slug)) next.push(route);
      membership.set(slug, next.sort());
    }
  }
  return membership;
};
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
    plugins: [fixtureMembership, ...(process.env.FP_LOCAL_PG === "1" ? [localPostgres] : []), ...(base.vite?.plugins ?? [])],
  },
};
