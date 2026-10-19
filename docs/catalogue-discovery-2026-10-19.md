# Catalogue discovery release, 19 October 2026

Full bouquet, occasion and flower ranges from the public catalogue, instead of eight hard-coded slugs, and one build-time publication snapshot for every catalogue surface. The rules are in `docs/catalogue-publication.md`.

- **Base:** `origin/main` at `0e7aa79` (the security release, live as `dpl_2mxT7U5x64E3KKGoi8BgXJHSWCXk`).
- **Branch:** `catalogue/discovery-2026-10-19`.
- **Not changed:** database records, migrations, Supabase settings and dependencies.

## What changed

- **Bouquets:** `/categories/bouquets` lists every public bouquet.
  - `#roses` and `#lilies` come from recorded flowers and overlap.
  - `#mixed` is "Other bouquets", meaning no roses or lilies are recorded.
  - Totals count each bouquet once.
- **Featured shortlist:** the eight featured bouquets remain an editorial shortlist (the homepage four, city "Featured bouquets", guide examples).
- **Occasions:** the gift occasions list every assigned public bouquet. A pooja assignment no longer implies Housewarming.
  - The directory counts real sets: get-well links to its bouquets; Housewarming and Baby shower link to their gift lists.
  - The prebuilt header's occasion menu reads the build's snapshot of assignments.
- **Categories:**
  - All Flowers is the fresh-flower range, derived from product type.
  - `/categories/rose` and `/categories/lilies` list arrangements with that flower, plus its stems.
  - Colours add blue, purple (including lavender) and orange.
- **Publication:** only records that are `published` in the build snapshot get pages or listings, search or sitemap entries, or related-product places. Archived addresses answer 404 with `noindex` and no sales actions.
  - The build fails on a database outage, an empty result or zero published products.
  - The build log reports exclusions, unmapped records, drift for the compared fields and deliberate differences.
- **Admin:** the Storefront panel shows dashboard status, the deployment's catalogue, pending changes and the storefront entry separately.
- **Baskets:** a saved basket drops items and add-ons that are no longer published, says so once, and never sends them. Saved items show public products only.
- **Pooja and jasmine copy:** no unpublished product is presented as listed; guidance on unlisted forms stays.
  - Dangling pooja-section links are dropped.
  - Dates updated: the Bengaluru, Coimbatore and Mysuru hubs and the jasmine guide (`2026-10-19`).

## Publication snapshot of the release candidate

Local production build at 16:25 IST on 19 Oct 2026 against the production database. It made 87 read statements and no writes (write guard).

| | Count |
|---|---|
| Catalogue records | 89 |
| Published | 82 |
| Archived | 7: `daily-pooja-flower-subscription`, `jasmine-gajra`, `jasmine-malli`, `pooja-basket`, `pooja-flower-box`, `pooja-flowerbox`, `temple-bulk-flowers` |

- **Drift:** `premium-card-addon` main photograph. Deliberate differences: `pet-friendly-flowerbox` short and long description.
- **Vercel rebuilds the commit and reads the database at its own build time.** Its snapshot can differ if records change in between, and the expected sets follow the records, not these numbers.

## Expected public sets (from that snapshot)

| Surface | Before (live `0e7aa79`) | After |
|---|---|---|
| `/categories/bouquets` | 8 | 47 unique (roses 13, lilies 15, other 20; one in both rose and lily) |
| All Flowers | 51 | 58 |
| `/categories/rose` | 1 | 14 |
| `/categories/lilies` | 11 | 16 |
| Birthday | 8 | 43 |
| Anniversary | 5 | 25 |
| Housewarming | 0 | 3 |
| Mom-to-be | 0 | 1 |
| Condolence | 7 | 7 |
| Search (catalogue) | 89 | 82, plus live garlands |
| City catalogue | 245 | 238 |
| Pooja collection | 11 | 4 |
| `sitemap.xml` | 221 URLs, 46 images | 213 URLs, 45 images |

- **`sitemap.xml` removals:** the 7 archived products and `/categories/bulk-orders` (now empty and noindexed).
- **`sitemap.xml` `lastmod`:** changed only for the edited hubs, the guide and their directories.
- **Occasion sitemap:** adds Housewarming and Mom-to-be.

## Checks on the candidate

| Check | Result |
|---|---|
| Regression suite | 45 of 45 |
| Catalogue suite | 18 of 18 |
| Security suite | 28 of 28 |
| Garland import suites | 6 of 6 and 4 of 4 |
| Type check | Errors, warnings and hints identical to `0e7aa79` (20 pre-existing errors) |
| Browser | 14 of 14 at 390 and 1440 px, with and without scripts |
| Basket fixture | 6 of 6 |
| Pooja/jasmine pages | 11 of 11 |
| Before/after comparison | As above |
