# National coverage release, 13 October 2026

The first national release: the site now says where Fresh Petals takes orders (59 cities, confirmed by the owner), has a directory of those cities, five city pages, and carries the recipient city from a city page through to the WhatsApp draft. It is a local commit and preview. Nothing in this document claims a ranking, traffic or enquiry result.

Base: `origin/main` at `366df38` (which already contains the live release `297aa03`: pooja discovery links and bouquet and pooja guidance). Those changes were checked in the base and are not reapplied here.

## Three facts kept apart

| Fact | Where it lives | What it means |
|---|---|---|
| Coverage | `serviceable` in `src/data/serviceCities.ts` | The owner confirmed fulfilment for the city on 13 Oct 2026. All 59 are serviceable. |
| Pages | `hub`: `published`, `queued` or `none` | Whether a city page exists. Five are published, ten are queued, 44 have none. |
| Demand | `demand`: `measured` or `unknown` | Whether search demand has been measured. Only Bengaluru has a Keyword Planner export. |

A city is serviceable whether or not it has a page or a measured volume. Every count shown on the site ("59 cities") is computed from the registry.

Coverage is not a delivery promise. No same-day claim, flat fee, pincode guarantee, dispatch origin or branch is stated anywhere. Bangalore, Gurgaon, Mysore and similar spellings are aliases: they resolve to the one city and never get an entry or a page of their own (`/locations/bangalore` redirects to `/locations/bengaluru`).

## What was built

- **Registry** (`src/data/serviceCities.ts`): slug, name, aliases, state, region, coverage, hub status, demand status. No database migration.
- **`/locations`**: all 59 cities in four regions. The five hubs link to their page; each of the other 54 has a WhatsApp action that names that city. Works without scripts; a name filter and a recipient-city control are added when scripts run.
- **Five city pages** (`/locations/bengaluru`, `hyderabad`, `chennai`, `pune`, `mumbai`): words in `src/data/cityHubs.ts`, layout in `src/pages/locations/[city].astro`. A city without a published page answers 404.
- **Homepage**: title "Flower Delivery Across India | Bouquets & Garlands | Fresh Petals" and the visible coverage sentence under the hero. The three-slide hero, headline, photographs, layout and motion are unchanged; only the eyebrow ("Floral moments across India"), the wordmark's small label ("India") and the top strip changed wording.
- **Geographic wording**: collection, occasion, garland, product, About, Contact, delivery, FAQ and custom-order copy no longer restricts service to two Bengaluru neighbourhoods. About keeps the history ("We began with deliveries in Chamarajpet and Basavanagudi, Bengaluru"). The Hyderabad reviews keep their attribution.
- **Recipient city in ordering**: one stored value (`src/utils/destination.ts`), shown and editable on product pages, garland pages, the basket and city pages.
- **Footer**: Flowers, Occasions, Delivery cities, Choosing flowers, Business and help, plus contact. "Shop by Occasion" now leads with `/occasions`. Garland model names are text links; the whole card still opens the design.
- **Delivery estimator**: with no estimate for a pincode the site now says "Delivery charges will be confirmed on WhatsApp", never that a city is unavailable.

## City pages: emphasis and sources

The emphasis is an editorial starting point. It is not a measured ranking of demand and not a limit on what can be ordered in that city.

| City | Leads with | Products come from |
|---|---|---|
| Bengaluru | Choosing a bouquet; flowers for a pooja; wedding garlands | One bouquet per launch group; three pooja records; one public garland per flower collection |
| Hyderabad | Birthday and anniversary gifts; garlands for a ceremony | Bouquets the admin assigned to each occasion; public rose and lotus garlands |
| Chennai | Comparing garlands; jasmine and gajra; flowers for a pooja | Two public garlands per flower collection; jasmine and pooja records |
| Pune | Bouquet by occasion; wrapped or in a vase | Occasion assignments; presentation read from the bouquet records |
| Mumbai | What a sender needs to give us; birthday and anniversary designs | One bouquet per group; occasion assignments |

Products are never typed into a page. Each section names a source and lists what is public when the page is rendered, so an unpublished garland or a removed occasion assignment disappears, and a section with nothing public is not shown. The pages carry the `garlands`, `occasion-index` and `occasion:<route>` cache tags that an admin save already purges. A regression test checks that, with city names removed, no paragraph or answer is shared between two hubs.

Photographs are design examples, and each page says so. No page contains a local delivery story, neighbourhood claim, review, flower recipe, dimension or lead time.

## Research, and what it changed

Bounded research on 13 Oct 2026. Limits: the web searches ran from a US-based tool and are not localised to any Indian city or device, so no rank is inferred for any site; no paid keyword tool was available (Semrush had no API units; nothing was purchased).

| Source | Finding | What it changed |
|---|---|---|
| Owner's Keyword Planner export, Bengaluru, Sep 2025 to Aug 2026 | "send flowers to bangalore", "flower delivery bangalore", "florist bangalore" and "flowers in bangalore" each sit in the 5,000 band; "bouquet delivery bangalore" in the 500 band. Bands only, no seasonality. | The Bengaluru page keeps "Bangalore" in its title and answers the spelling question. Both wordings ("flowers for delivery in", "send flowers to") are used across the hubs. |
| Three later exports the owner saved the same day | They cover unrelated services (cleaning, pet care, coffee) with two flower terms: "flower delivery" (5,000 band) and "birthday flower bouquet" (500 band). | Not used for city decisions. |
| Searches for "send flowers to Mumbai / Hyderabad", "flower bouquet delivery Pune" | Results are dominated by national gift sites whose pages address a sender who is elsewhere, including abroad, and lead with same-day and midnight promises. | Mumbai and Hyderabad are written for the sender (what we need from you; who we confirm with). We state plainly that same-day and timed delivery are not promised, instead of matching the claim. |
| A competitor's Pune city page (structure only) | Occasion quick filters (birthday, anniversary), a product grid, a long list of neighbourhoods and local-area links, star ratings on cards. | Pune is organised by occasion. Neighbourhood lists and ratings were deliberately left out: we have no confirmed area list and no verified ratings. |
| Search for garland, jasmine and gajra delivery in Chennai | No consumer page surfaced in this unlocalised search; results were wholesale listings. Nothing can be concluded about Chennai rankings from it. | Chennai leads with garland comparison and jasmine, as planned, and is labelled as an editorial emphasis. |
| One competitor product page | States that the picture is indicative. | Each hub says what the photographs are and are not. |

City-level search volumes and seasonality for the other four pilot cities are **unknown**. Bengaluru's volumes were not transferred to them.

## Query family to page

| Query family | Page |
|---|---|
| Brand and national: fresh petals, flower delivery, online flower delivery india, send flowers | `/` |
| Which cities: flower delivery cities, do you deliver to <city> | `/locations` |
| Bengaluru: flower delivery bangalore, send flowers to bangalore, florist bangalore, flowers in bengaluru | `/locations/bengaluru` |
| Hyderabad: send flowers to hyderabad, birthday / anniversary flowers hyderabad | `/locations/hyderabad` |
| Chennai: wedding garland chennai, jasmine / gajra chennai, pooja flowers chennai | `/locations/chennai` |
| Pune: bouquet delivery pune, flower bouquet pune | `/locations/pune` |
| Mumbai: send bouquet to mumbai, send flowers to mumbai | `/locations/mumbai` |
| Bouquets without a city: flower bouquet, rose bouquet, lily bouquet | `/categories/bouquets` |
| Pooja and jasmine without a city | `/categories/pooja-flowers` |
| Wedding garlands, by flower, and how to choose | `/categories/garlands`, the three collections, `/guides/choosing-wedding-garlands` |
| Occasions: birthday, anniversary, wedding, sympathy flowers | `/occasions/<route>` |
| A city with no page yet (54 cities) | `/locations` until its page is written |

The homepage and the Bengaluru page are separate destinations with their own canonicals; neither redirects to the other. City and tracking parameters never create a new indexable URL: every canonical drops the query string, so there is one page per model and no city copies of the 156 garlands.

## Recipient city in ordering

- **One value.** `fresh_petals_destination_city` holds a registry slug. Product drafts, the basket and its draft read it, so they cannot name different cities. The unused "selected area" value is no longer read by product cards or product pages.
- **Entry.** Links from a city page carry `?city=<slug>` next to the existing `occ`, `for` and `from` parameters. The value is validated against the registry wherever it is read; anything else is ignored.
- **Browsing is not deciding.** Visiting a city page or a `?city=` link sets the destination only when nothing is decided yet (no destination, or an empty basket). A basket that already has a destination is never re-pointed: the page asks "Your basket is going to Mumbai. This page is about Pune." with two buttons. Only the select or "Send the order to Pune" changes it.
- **Old baskets and direct visits.** No city is required. A draft with none says "Recipient city: Not chosen — please confirm the recipient city" (basket) or leaves the line out (single product). The pincode stays optional in the basket.
- **Garlands.** The enquiry check (`/garland-enquiry`) accepts `city`, looks it up in the registry and adds "Recipient city" to the message; an unknown value is dropped.

## Delivery estimator

The estimator (`DeliveryService`, `/api/delivery/check`) quotes a fee and a slot only from a `delivery_zones` row for a city the owner has approved. The only rows that exist were seeded for an earlier Hyderabad storefront, with fees and same-day flags nobody has confirmed since, so they are still never quoted, and no fee, pincode or capability was invented. What changed is the wording: no estimate now reads "Delivery charges will be confirmed on WhatsApp" in the basket, the product page and the draft, in a neutral panel rather than an error. When the owner confirms zones for a city, its rows are quoted with no other change. The order-confirmation requirements in the basket (name, phone, date, slot, recipient, landmark) are unchanged.

## Indexing

Counts in this build (13 Oct 2026). The "157 URLs" in the previous report was `sitemap.xml` alone, not the whole site.

| Sitemap | URLs | Change |
|---|---|---|
| `sitemap.xml` | 163 | The 157 live entries, plus `/locations` and five city pages, each with `<lastmod>2026-10-13</lastmod>` (the date their content was written, not the build time) |
| `sitemap-garlands.xml` | 161 | Unchanged |
| `sitemap-occasions.xml` | 11 | Unchanged |
| All three, de-duplicated | 335 | No URL appears in more than one |

Structured data: the homepage's Organization lists the 59 cities as `areaServed`. It is an Organization, not a LocalBusiness: there is no verified address, branch, hours, rating or logo. City pages carry a BreadcrumbList only. Quote-only products still have no numeric offer.

## Measurement

No tracking was added and nothing is sent until `PUBLIC_GA_MEASUREMENT_ID` is set. The existing events (`view_item_list`, `view_item`, `whatsapp_enquiry_click`, `basket_quote_request`) now also carry `destination_city`, a registry slug, when the visitor has chosen a city or is on a city page. City pages report `view_item_list` with `item_category` `city:<slug>`. Never sent: phone numbers, addresses, names, pincodes or the draft text.

**Baseline for this release, kept separate from `297aa03` (live 13 Oct 2026, 12:08 IST).**

- Search Console, owner's screenshot taken 13 Oct 2026, 10:09 IST (24-hour view, Web, "last update 8.5 hours ago"): 4 clicks, 20 impressions, average position 8.3. Queries listed, one impression each: "pooja flowers online bangalore" (1 click), "fragrant lily", "flower subscription", "fresh flowers for vase", "red flowers for pooja". 24-hour figures are preliminary.
- This corrects the earlier release record, which said the property still showed "Processing data" with no impressions. The property held data before that release went live; the statement in `search-expansion-2026-10.md` was wrong and is marked there.
- Search Console was not opened again during this work. Pages, 28-day totals and indexing counts were therefore not recorded: **UNKNOWN**, to be exported before this release is deployed.
- Sitemap submission status: **UNKNOWN** (not checked). The three sitemaps are `https://onlyfreshpetals.in/sitemap.xml`, `https://onlyfreshpetals.in/sitemap-garlands.xml` and `https://onlyfreshpetals.in/sitemap-occasions.xml`. Submitting them helps discovery; it does not start data collection and does not guarantee indexing or ranking.
- No city page existed before this release, so city-page impressions start from zero by definition.

**Read weekly, after deployment** (complete weeks, ending at least three days before the export):

1. Non-brand impressions (`node scripts/seo/report.mjs <folder>`, see `measurement.md`).
2. Query-family coverage: how many families in the table above have at least one query with impressions.
3. City pages: impressions per `/locations/...` URL, and whether each is indexed (URL inspection or the Pages report).
4. Image search: the same export with Search type set to Image.

A city word in a query says where the flowers are going, not where the searcher is; Search Console has no city dimension for the searcher. WhatsApp clicks are a secondary signal that someone asked. They are not orders; confirmed orders are still recorded by hand. Rows under 30 impressions are not evidence of change.

## Corrections to the planning workbook

The national plan workbook (not in the repository) was written before the last two releases. Where it differs from the site:

- The Condolence occasion's address is `/occasions/sympathy`.
- Garlands are live: 156 designs, FP-G001 to FP-G156, plus Event Garlands. They are not "imported drafts awaiting review".
- Gift baskets (`/categories/baskets`) and the Pooja Basket (a pooja product) are different products; the workbook's "floral baskets" does not distinguish them.
- The workbook's generic Custom Orders groups (poola jada, veni, floral jewellery) have no confirmed products or service content yet. `/custom-orders` does not claim them, and no page was built for them.
- 885 city and category rows are research hypotheses. No page was created from them.

## Queue

Next ten city pages, in the registry as `queued`: Delhi, Gurugram, Noida, Kolkata, Ahmedabad, Jaipur, Coimbatore, Visakhapatnam, Vijayawada, Mysuru. The remaining 44 stay serviceable with no page. A city page is written when it has something of its own to say; 59 near-identical pages and 885 city-category pages are not planned.

To publish a queued city: write its entry in `src/data/cityHubs.ts`, set `hub` to `published` in the registry. The directory, footer, sitemap and tests follow from those two edits.

## Verification, 13 Oct 2026 (local preview of the production build)

Preview connected to the production database for reads only. `/api/inquiries` and every admin route were refused by the preview server and aborted in the browser; WhatsApp was never opened (drafts were captured).

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite (`node --test scripts/audit/regression.test.mjs`) | PASS, 34 of 34 (29 existing, 5 new) |
| Type check | 20 errors, all in three files this release does not touch (`SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1): the same errors as the base. No new error. |
| Browser and HTML checks at 375, 390, 768 and 1440 px | PASS, 203 of 203 |

The 203 checks cover: exactly 59 unique registry cities; the directory without scripts; five hubs and 54 city-specific WhatsApp actions; 404 for unpublished and unknown cities and redirects for aliases; titles, H1s, canonicals with and without query parameters; server-rendered linked product names and working product routes; quote-only by product (bouquets, lilies, garlands and Event Garlands show no amount in cards, drafts or structured data, while pooja products keep their prices, identical to the live site); the recipient city through product and basket drafts, an explicit change, a refused silent change, invalid parameters and an old basket with no city; all 156 garlands; the hero; the bouquet and pooja improvements; sitemap membership; no horizontal overflow or broken images; control sizes and names; no script errors.

Comparison limits: untouched behaviour was compared with the live site's public pages (pooja prices, the `sitemap.xml` entries, one product label) and with the base source. The previous deployment's own URL was not used.

## Deployment handoff

Not pushed, merged or deployed. When publishing is authorised:

1. Export Search Console (Queries and Pages, 28 days, Web and Image) first, so this release has a proper baseline.
2. Fast-forward `main` to this branch; push `main` alone and wait for the Production deployment before pushing the branch.
3. Check live: `/`, `/locations`, the five city pages, `/locations/delhi` (404), `/sitemap.xml` (163 URLs), a basket draft with a city (captured, not sent).
4. Then, in Search Console: confirm or submit the three sitemaps and request indexing for `/locations` and the five city pages.
5. Optional: `node scripts/seo/indexnow.mjs` for the six new URLs and the pages whose titles changed.

Titles and H1s of the homepage, the bouquet, pooja and subscription collections, the birthday, anniversary and wedding pages and the garland pages no longer contain "Bengaluru" or "Bangalore". Bengaluru searches are now answered by `/locations/bengaluru`. Expect those pages' Bengaluru impressions to move to the city page over some weeks; that movement is a consequence of this release, not a loss to diagnose.

## Still needed from the owner

- Whether pooja flowers, subscriptions and garlands are offered in all 59 cities or only some. The site currently treats coverage as the same for every product.
- Confirmed delivery zones and charges for any city, if the basket should ever show an estimate.
- Whether the Instagram account (still named for Hyderabad) should change.
- Where flowers are dispatched from, if that should ever be stated. Nothing on the site states it now.
