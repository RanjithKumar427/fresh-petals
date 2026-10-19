# Catalogue publication and discovery (19 October 2026)

How a catalogue product (anything that is not a garland design) becomes visible on the storefront, and what the admin can and cannot change without a deployment.

## Two sources

- **`src/data/productCatalog.ts`**: the storefront entry for each product. It holds the name, descriptions, photograph, category, flower types, what's included, care notes, collection tags and seed occasion tags.
- **The database `products` record**, edited in the admin. The storefront reads three things from it:

  | From the database | When it reaches the storefront |
  |---|---|
  | Publication status | Next successful deployment |
  | Price | Next successful deployment |
  | Suitable occasions | At once on occasion pages and lists (rendered on request; the cache is purged on save). The prebuilt header menu changes with the next deployment. |

  Edits to every other field are **not shown**: the storefront uses the catalogue entry for those.
  - **Compared for drift:** name, short and long description, main photograph, category and stem count. Each has a one-to-one catalogue field.
  - **Not compared:** flower types, moods, colour theme, included items, care, size, arrangement style, SEO fields and additional photographs. None has a reliable one-to-one catalogue field.

Garland designs are different. They are read live from the database (`src/data/garlands.ts`), and their publication rules are unchanged.

## The publication snapshot

Each build reads every product record once (`src/content.config.ts`) and saves three collections from that single read:

- `publishedPrices`
- `catalogueStatus`
- `occasionAssignments`

`src/server/services/PublicCatalogue.ts` serves the public catalogue: the catalogue entries whose record is `published` in the snapshot. Every catalogue surface reads it:

- product pages (only public ones are built) and related products;
- category pages, All Flowers and the bouquet list;
- search and `sitemap.xml` (pages and images);
- city pages and city shop views;
- occasion pages, the occasion sitemap, `/occasions` and the homepage;
- guides, saved items, basket prices and add-on options.

**Never public**: a record that is a draft, archived, missing, or has an unknown status. A product page for one of these is not built. Its address falls through to the on-request route, which answers **404, `noindex`**, says the product isn't on sale, and offers no basket, no enquiry and no redirect.

**The build fails** when:

- the database cannot be read;
- the database returns no records;
- no catalogue product is published.

A production server with no snapshot refuses to treat the catalogue as published. Development reads the database directly.

**Reconciliation report** (printed in the build log, `[catalogue]` lines):

- products excluded and why;
- catalogue entries with no record, or an unknown status (PROBLEM);
- records published in the dashboard that have no catalogue entry and are therefore **not live** (PROBLEM, with the fields such an entry needs);
- dashboard edits the storefront does not show, for the compared fields. Whitespace is ignored. A catalogue placeholder photograph is a reviewed, deliberate replacement and is not compared. Deliberate catalogue rewrites (`DELIBERATE_CATALOGUE_COPY`) are listed separately as deliberate;
- the fields that are not compared.

**Admin**: the product editor's Publishing section shows a **Storefront** panel. It keeps four things apart:

- dashboard status;
- whether this deployment's catalogue includes the product, and as what;
- what is waiting for the next deployment (status, and the price when the storefront shows one);
- whether a storefront entry exists.

It also lists the compared fields edited in the dashboard that the storefront does not show, as of when the page was opened. The overall message is:

| Panel | Meaning |
|---|---|
| Live | The deployed snapshot publishes it. |
| Pending | Published, or archived, here; this takes effect with the next successful deployment. |
| Not live — no catalogue entry | It has no storefront page whatever its status. |

The save and publish actions themselves are unchanged.

**Baskets and saved items.** Every page's header carries this deployment's unpublished catalogue slugs (`#fp-unavailable-products`). A basket saved earlier drops such a product, or such an add-on, the first time any basket reader runs (`src/utils/cart.ts`, and `src/scripts/inline/cart.js` on the basket page). It therefore leaves the count, the basket and the WhatsApp draft together, and a reload or quantity change cannot bring it back. Other lines keep their quantity, options and delivery context. The basket page says once what was removed. A basket left empty shows the empty state and produces no draft or enquiry. The saved-items page shows public products only and drops other saved ids.

This cannot change a page already open in a browser, or a WhatsApp message or link a customer copied earlier.

**Unlisted forms.** Advice about what to ask for, such as loose jasmine or gajra, a pooja box, or bulk flowers, stays even when no product of that form is public. City pages keep such a pooja section without examples, with a WhatsApp prompt. Links to a pooja-collection section that has no public product are dropped. Copy never presents an unpublished product as listed.

## Ranges and featured selections (`src/data/catalogueRange.ts`)

| Range | Rule |
|---|---|
| Bouquets | Every public Bouquets or Lilies record that is not an add-on. `/categories/bouquets` lists all of them. |
| Bouquet groups | `#roses` and `#lilies` are read from recorded flower types, never the name. They overlap, and the page says so. `#mixed`, labelled "Other bouquets", is every bouquet with neither; it is not a verified mixed-flower class. Each bouquet is in at least one group, and counts and filters count distinct products. |
| All Flowers | Fresh-flower product types (bouquets, lilies, flowerboxes, baskets, stems, torans, pooja flowers) whose record names flowers, plus records already tagged `all-flowers`. Add-ons, subscriptions, plants, vases, tools, hampers and dried flowers are excluded. |
| `/categories/rose`, `/categories/lilies` | Every arrangement whose recorded flowers include that flower, then that flower by the stem. |
| `/categories/roses` | Roses by the stem. Its URL and canonical are unchanged. |
| Featured | The eight slugs in `src/data/launchCatalogue.ts`, filtered to public products. They feed the homepage four, the city "Featured bouquets" collection and guide examples, and never decide what a full list holds. |
| Colours | From recorded flower types only. One rule: lavender, lilac, violet and mauve are filed under Purple, and `?colour=lavender` reads as purple. Unknown values are ignored. |
