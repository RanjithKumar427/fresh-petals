# City catalogue release, 13 October 2026

Every one of the 59 service cities now has a complete shopping view with every public collection and every eligible product. Local commit and preview only: not pushed, merged or deployed. No ranking is claimed.

Base: `origin/main` at `9d3c298` (the live search-competitiveness release and the GA4 privacy fix are untouched).

## What was built

- **One shared catalogue** (`src/server/services/CityCatalogue.ts`). It reads the shop's existing sources: the category pages' own product lists, the featured launch bouquets, and public listed garlands from the admin database, as one collection and by browsing group. Nothing is sampled or limited, and nothing varies by city, because no per-city stock or restriction exists. Empty collections are dropped. Public eligibility is whatever those sources already enforce.
- **A shop view for every city**: `/locations/<city>/shop`, for all 59. When checked it held 245 products in 61 collections, the same in every city. Collections and pages are query parameters (`?collection=garlands-lotus&page=2`), so there is one address per city, not a city URL per collection.
- **Headings name the city**: "Lotus wedding garlands in Bengaluru", "Pooja flowers and jasmine in Hyderabad", "All flowers and products for delivery in Kochi".
- **All Products** counts each product once (245), while a product keeps its place in every collection it belongs to.
- **Pagination**: 24 products a page with plain previous, next and numbered links, so every product is reachable without scripts. Only the first row of photographs loads immediately.
- **City pages** (the fifteen published ones) gained an "Everything you can order for <city>" section: a tile per main collection with a photograph, the city label and the count, linking into the shop view. Their authored sections are unchanged.
- **The directory** gives each of the 44 cities without its own page a "Shop" link to its shop view, beside its WhatsApp action.
- **City kept throughout**: opening a city's shop marks the order for that city; product links carry it; drafts and garland enquiries name it. A basket already going elsewhere is not re-pointed: the page asks, as before.

Counts when checked: all flowers 51, featured bouquets 8, lilies 11, wedding garlands 156 (rose 78, lotus 30, tuberose 24, designer and mixed 60), pooja flowers and jasmine 11, and 51 further catalogue collections. All are computed.

## Indexing decision

The shop views are `noindex, follow`, canonical to themselves, and not in the sitemap. They are a shopping tool: 59 pages listing the same catalogue under different city names would be near-duplicates, which the city-page work has avoided throughout. The indexable page for a city remains `/locations/<city>` where one is published. The 44 cities without a published page therefore have a complete shopping destination but still no indexable city page; writing those pages is separate work. `sitemap.xml` is unchanged.

## Not changed

Quote-only ordering (bouquets, lilies and garlands show no amount in cards or drafts), prices on other products, all 156 garlands, the hero and palette, GA4 and its privacy controls, cache tags and admin invalidation, destination-change confirmation. No city wording claims a branch, a local testimonial, a delivery time or a specification.

## Verification (local preview of the production build)

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 40 of 40 (1 new) |
| City-catalogue checks at 375, 390, 768 and 1440 px | PASS, 59 of 59 |
| Type check | 20 errors, all in three files this release does not touch (`SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1): the same errors as the base. No new error. |

Covered by the 59 checks:

- **Parity:** all 59 cities return a shop view with identical collections and counts, each marked with its own city.
- **Completeness, in Bengaluru, Hyderabad and Kochi (newly enabled):** the whole lotus collection (30 designs over two pages, equal to the national lotus collection), featured bouquets, rose and tuberose garlands, pooja flowers and lilies, each product once; All Products reaches all 245 with no duplicate, including all 156 garlands.
- **Ordering:** every card links its product with the city; bouquet drafts name the product, its canonical link and the city with no amount; garland enquiries carry the design code and the city; pooja products keep their prices.
- **Destination:** opening Kochi's shop sets Kochi; a Kochi basket is not re-pointed by browsing Bengaluru's lotus collection, the page asks, and the explicit switch is kept on page two.
- **Technical:** noindex with a self-canonical; nothing added to the sitemap; pagination and collection links working with scripts off; only the first row of photographs eager; aliases redirect and unknown cities 404; no overflow, broken photographs or undersized controls.
- **Preserved:** city pages keep their sections, H1, canonical and indexing; the hero, 156 garlands and the quote-only bouquet collection are intact; no Google tag in the local build.

Screenshots read by eye: the top of "Lotus wedding garlands in Bengaluru" on mobile and the Bengaluru city page's catalogue tiles on desktop. The product grids, the Kochi view and the other widths were checked by script only.

Not rerun for this release: the earlier city-hub, basket and search-competitiveness suites.

## Handoff

Fast-forward `main` to this branch, push `main` alone, wait for Production, then push the branch. Rollback reference: `9d3c298`. After deploying, check `/locations/bengaluru/shop?collection=garlands-lotus` (30 designs over two pages), a newly enabled city such as `/locations/kochi/shop`, the tiles on a city page, and one captured draft.
