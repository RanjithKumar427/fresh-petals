# City hubs, release 2 (ten more city pages), 13 October 2026

Ten more city pages, built on the national release (`46c47a6`, first live 13 Oct 2026, 15:45:27 IST; see `national-coverage-2026-10.md`). This is a local commit and preview: not pushed, merged or deployed. Nothing here claims a ranking, traffic or enquiry result.

Base: `origin/main` at `951d6d7`.

## End state

| | Before | After |
|---|---|---|
| Serviceable cities | 59 | 59 |
| Published city pages | 5 | 15 |
| Cities with a WhatsApp action on `/locations` | 54 | 44 |
| Queued | 10 | 0 |

New routes: `/locations/delhi`, `/gurugram`, `/noida`, `/kolkata`, `/ahmedabad`, `/jaipur`, `/coimbatore`, `/visakhapatnam`, `/vijayawada`, `/mysuru`.

Only two data files decide this: ten registry entries moved from `queued` to `published` (`src/data/serviceCities.ts`) and ten entries were written in `src/data/cityHubs.ts`. The directory, footer, sitemap and redirects follow from them. Greater Noida stays a separate serviceable city with no page; `/locations/greater-noida` answers 404.

## What each page is built around

A buyer task, not a claim about what sells in the city or about measured demand.

| City | Task the page works through | Sections (and where their products come from) |
|---|---|---|
| Delhi | Two ways to choose: by occasion or by flower | Occasion (one birthday, one anniversary assignment); flower (one bouquet per group) |
| Gurugram | Where the flowers will be received decides the design | Wrapped or vase (read from records); receiving details for a home or office (one per group) |
| Noida | Arranging a gift for someone else | Design (birthday assignments); message and gift details (lily and mixed alternatives). Tells Noida and Greater Noida apart. |
| Kolkata | Choosing for family | Who it is for (birthday assignment); roses; lilies and mixed |
| Ahmedabad | Comparing when the price is quoted, not shown | By colour (rose group); by presentation; shortlisting without a displayed price |
| Jaipur | A gift bouquet and a wedding garland are different orders | Bouquets; choosing a garland design; what a ceremony enquiry needs (designer and mixed designs) |
| Coimbatore | Garlands one browsing group at a time; the right form of jasmine | Rose; lotus; tuberose; four jasmine and pooja forms |
| Visakhapatnam | Keeping a bouquet and a ceremony request apart | Sending a bouquet; a separate ceremony request (event garlands, bulk flowers, two garland designs) |
| Vijayawada | Three answers settle a poola mala order | Design code; one or a pair; ceremony date and other requirements |
| Mysuru | Loose jasmine or strings | Jasmine forms; what to tell us for a pooja (both boxes, a basket); a bouquet to give |

No two of the fifteen pages share the same sequence of sections and sources (a regression test checks this, along with the existing test that no paragraph or answer is shared once city names are removed). The layout and the ordering steps are shared on purpose.

One new product source was added, `bouquet-group`: the bouquets of one launch group, read from the same launch catalogue as `/categories/bouquets`. No static assignment or fallback was introduced. Each product still appears once per page, and a section with nothing public is not shown.

Deliberately not said anywhere: where jasmine is grown or its variety (the Mysuru page says plainly that no variety or origin is claimed), the flowers inside a garland (the flower groups are described as a way of browsing the photographs), lengths, quantities, preparation times, delivery speed, fees, branches or local reviews. Photographs are design examples.

## Research, and what it changed

13 Oct 2026. Limits: searches ran from a US-based tool and are not localised to any Indian city or device; competitor pages were read once, as references for structure only. No rank is inferred for any site, no volume is invented, and no keyword access was bought. City-level search volumes for all ten cities are **unknown**.

| Reference | What it does | What changed here |
|---|---|---|
| A national florist's Delhi page | Menus by occasion, flower type, colour, presentation and recipient; filters by flower type; FAQs mostly about delivery cut-offs; store addresses | Delhi offers the same two entry points buyers are used to (occasion, flower). Our FAQs answer what to send us instead of cut-off times, and say Delhi, Gurugram and Noida are separate cities. No addresses: we have none to state. |
| A national gift site's Kolkata page | Recipient links (mother, father, wife, friend) and personality tags; no question-and-answer section | Kolkata is organised around who the flowers are for, with advice for parents and older relatives, in our own words. |
| Search: flowers to an office in Gurgaon | Results are gift-site listings; nothing addresses receiving at an office or a gated society | Gurugram leads with the receiving question and the details that matter for a home or an office. |
| A Vijayawada garland seller's site | Garlands by category and name with photographs; no codes, sizes, pair or single, or lead time; enquiry by WhatsApp with the product name | Vijayawada is built on the three things such listings leave open: the design code, one or a pair, and the date. We also do not publish sizes or lead times, and say they are confirmed. |
| A garland specialist's site | Garlands organised by flower type; name and photograph only | Coimbatore shows garlands one browsing group at a time, and states that a group is not an ingredient list. |
| Both national sites | Same-day, midnight and timed-delivery claims on cards and in titles | None repeated. Every page states that same-day and timed delivery are not promised. |

Searches by people outside the recipient city ("send flowers to …") shaped Delhi, Noida, Kolkata and Visakhapatnam, which address the sender directly.

## Query family to page

| Query family (examples; volumes unknown) | Page |
|---|---|
| send flowers to delhi, flower delivery delhi, birthday / anniversary flowers delhi | `/locations/delhi` |
| flower delivery gurgaon / gurugram, flowers to office gurgaon | `/locations/gurugram` |
| send flowers to noida, bouquet delivery noida | `/locations/noida` |
| flowers greater noida | `/locations` (no page; WhatsApp action) |
| send flowers to kolkata / calcutta, birthday flowers for mother kolkata | `/locations/kolkata` |
| flower bouquet ahmedabad / amdavad, rose bouquet ahmedabad | `/locations/ahmedabad` |
| flowers jaipur, varmala / jaimala jaipur, wedding garland jaipur | `/locations/jaipur` |
| wedding garland coimbatore / kovai, jasmine coimbatore, pooja flowers coimbatore | `/locations/coimbatore` |
| send flowers to vizag / visakhapatnam, event flowers vizag | `/locations/visakhapatnam` |
| poola mala vijayawada, pelli dandalu vijayawada, wedding garland vijayawada | `/locations/vijayawada` |
| jasmine mysore / mysuru, mallige mysore, pooja flowers mysore, bouquet mysore | `/locations/mysuru` |

Queries without a city stay with the national collection, occasion and guide pages. Global titles approved in the first release are unchanged, and no city copy of any product or category page was created.

## Discovery

- **Footer:** the Delivery cities group now sets its fifteen links and the directory link in columns (two on phones, four on tablets, two within a wider cell on desktop). Still server-rendered anchors; the other four groups, the palette and the contact links are unchanged.
- **Regional cross-links:** each page offers at most three other published city pages from the same region, under "Sending somewhere else nearby?", with a line saying each is a separate city. Delhi links Gurugram, Noida and Jaipur; Noida links Delhi and Gurugram; Mysuru links Bengaluru and Coimbatore; and so on. The first five pages gained only this block; the rest of each page is byte-for-byte what is live (checked against production, ignoring build-file hashes).
- **Aliases:** `/locations/gurgaon`, `/calcutta`, `/mysore`, `/vizag`, `/kovai`, `/amdavad` and `/new-delhi` redirect (301) to their published page. An alias of a city without a page still answers 404.

## Indexing

Counts derived from this build:

| Sitemap | URLs | Change |
|---|---|---|
| `sitemap.xml` | 173 | The 163 live entries plus the ten new city pages, each with `<lastmod>2026-10-13</lastmod>` (the date its content was written) |
| `sitemap-garlands.xml` | 161 | Unchanged |
| `sitemap-occasions.xml` | 11 | Unchanged |
| All three, de-duplicated | 345 | No URL in more than one |

## Baseline for this release

Kept separate from the first national release (first live 13 Oct 2026, 15:45:27 IST).

- The ten new URLs did not exist before this release, so their impressions, clicks and indexed status start at zero by definition.
- The first five city pages and `/locations` went live a few hours earlier the same day; nothing can yet be measured for them either. No fresh Search Console export was requested for this work.
- Last known Search Console state (13 Oct 2026, about 15:55 IST): 28-day view still processing; all three sitemaps submitted on 12 Oct, status Success. The owner has since completed the initial indexing requests for the first release.

After deployment, read weekly (complete weeks, ending at least three days before the export):

1. Non-brand impressions.
2. Coverage per new city family: for each row of the table above, whether at least one query has impressions, and which URL earned them.
3. Impressions and indexed status for each of the fifteen `/locations/...` pages.

A city word in a query says where the flowers are going, not where the searcher is. WhatsApp clicks are a secondary signal, not orders. Unknown volume did not block this release, and publishing it will not by itself show that any page ranks.

## Verification, 13 Oct 2026 (local preview of the production build)

The preview read the production database; inquiry and admin routes were refused by the scratch preview server and aborted in the browser, and that guard is not in the repository or the build. WhatsApp was never opened.

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 34 of 34 (registry and hub tests extended for fifteen hubs) |
| Type check | 20 errors, all in three files this release does not touch (`SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1): the same errors as the base. No new error. |
| Browser and HTML checks at 375, 390, 768 and 1440 px | PASS, 346 of 346 |

Covered: metadata, one H1, self-canonical (with and without query parameters), breadcrumbs and server-rendered linked products on all fifteen pages; alias redirects and 404s; 59 cities, 15 hub links and 44 city-specific WhatsApp actions, with and without scripts; the first five pages unchanged apart from the nearby links; city to product to basket to captured draft, an explicit destination change, a refused silent change and an old basket; quote-only by product with pooja prices equal to the live site; 156 garlands, the hero and the footer; sitemap membership and counts; no broken images or horizontal overflow; no script errors.

## Handoff

When publication is approved: fast-forward `main` to this branch, push `main` alone, wait for the Production deployment, then push the branch. Check the ten new routes, `/locations` (15 links, 44 actions), `/locations/greater-noida` (404), `/sitemap.xml` (173) and one captured basket draft. Then request indexing for the ten new URLs if wanted; the sitemaps are already submitted and need no action.

Still open from the first release: whether every product is offered in all 59 cities, confirmed delivery zones for any city, and the Instagram account's name.
