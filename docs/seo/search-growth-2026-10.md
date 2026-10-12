# Search-growth release, 12 October 2026

What was found on the live site, what changed, and which page answers which search. Companion files: `owner-checklist.md` (account steps only the owner can do) and `measurement.md` (events and the 28-day review).

## Evidence and its limits

| Source | Status |
|---|---|
| Production HTML of 30 priority URLs, robots.txt and the three sitemaps (fetched 12 Oct 2026, no JavaScript) | Used. This is the baseline below. |
| Google Search Console, Bing Webmaster Tools | **No access and no verification tag in the code.** No impressions, clicks, positions or index coverage are known. |
| Analytics | **None installed** before this release. No visit or enquiry counts exist. |
| Search results | Four generic web searches on 12 Oct 2026 through a US-based search tool, no location or device set. They are *not* Bengaluru rankings and Fresh Petals' position was not measured. |

What the searches did show: results for "wedding garlands in Bangalore / poola mala" were dominated by artificial-garland shops, marketplaces (IndiaMART) and wedding directories (WedMeGood, WeddingWire), with no fresh-garland catalogue carrying photographs and design codes. Results for garland selection ("how to choose a varmala") were outfit-matching articles from fashion and wedding media, none tied to designs a reader can order. Directory listings name Ferns N Petals and Flowers & Fragrance in Basavanagudi. These are observations from a small sample, used only to choose where original content could be useful.

## Which page answers which search

One page per group. Bangalore and Bengaluru are both used on each.

| Search group | Page |
|---|---|
| flowers in Bengaluru / Bangalore, Fresh Petals | `/` |
| flower bouquets, rose bouquets, lily bouquets in Bengaluru | `/categories/bouquets` |
| birthday flowers in Bengaluru | `/occasions/birthday` |
| anniversary flowers in Bengaluru | `/occasions/anniversary` |
| wedding garlands, flower garlands, poola mala, varmala, jaimala in Bengaluru | `/categories/garlands` |
| rose wedding garland / rose varmala | `/categories/garlands/rose` |
| lotus wedding garland | `/categories/garlands/lotus` |
| tuberose (rajnigandha, sampangi) wedding garland | `/categories/garlands/tuberose` |
| a named design or design code (FP-G…) | its `/products/…` page |
| wedding flowers in Bengaluru (wider than garlands) | `/occasions/wedding` |
| pooja flowers, jasmine (malli, mallige) in Bengaluru | `/categories/pooja-flowers` |
| how to choose a wedding garland, garland design questions (any city) | `/guides/choosing-wedding-garlands` |
| flower subscriptions in Bengaluru | `/categories/subscriptions` |

Kept out of search on purpose: `/occasions/engagement` (lists the same garlands as wedding), `/occasions/pooja` (competes with the pooja category), `/categories/same-day` (an unconfirmed delivery promise), `/loyalty` and `/refer-a-friend` (restate `/rewards`), cart, search, saved, admin and API.

Canonical policy: every query-string variant (`?filter=`, `?budget=`, `?for=`, `?occasion=`…) is canonical to its own path without the query. `/categories/garlands?filter=rose` still filters the full listing in the browser and is canonical to `/categories/garlands`; the rose collection is the separate path `/categories/garlands/rose`.

## Before and after

| Finding on the live site (before) | Change |
|---|---|
| `/categories/garlands`: title "Garlands \| Fresh Petals Bengaluru", generic description, no supporting text | Title "Wedding Garlands in Bengaluru \| Poola Mala \| Fresh Petals", specific description and intro, three questions answered, links to collections and guide |
| No flower collections: `/categories/garlands/rose`, `/lotus`, `/tuberose` returned 404. Filters existed only as script-driven buttons | Three server-rendered collections with only their own designs, counts, guidance, points to confirm, breadcrumbs and an item list. Filter chips are now real links that scripts enhance |
| `/occasions/wedding` was `noindex` with the description "Our wedding range isn't online yet" while listing all 156 garlands, and was missing from the occasion sitemap | Indexable while it lists public garlands, with its own title and description; listed in `sitemap-occasions.xml` |
| Garland design pages: description "Classic Red Rose Garland — design FP-G001." | Description built from the photograph's own description plus design code; breadcrumb through the flower collection; photograph credited (ImageObject); links to collections and guide; "You may also like" now shows neighbouring designs instead of the same first six on every page |
| Garland photographs: full-size JPEGs (about 95–230 KB each, 156 on the listing) from the storage host with `Cache-Control: no-cache`, no responsive sizes | Resized WebP copies through the deployment's image optimiser at 240/480/720/1080 px, cached 31 days; originals remain the fallback `src` |
| No buying guide | `/guides/choosing-wedding-garlands`, built from live designs |
| Unknown addresses returned Astro's bare "404: Not found" page | A site 404 page with links, `noindex`, status 404 |
| Two tag pages listed exactly the same products as another page (`/categories/flower-strings-torans` = `/categories/floral-torans-and-strings`; `/categories/diy` = `/categories/diy-kits`) | Canonical to the twin, removed from the sitemap |
| `/rewards`, `/loyalty`, `/refer-a-friend` WhatsApp buttons opened `wa.me/?text=…` with no number | They open the shop's number. `/loyalty` and `/refer-a-friend` are `noindex` and out of the sitemap |
| Bouquet product and listing images had no `width`/`height`; product photo alt was the name only | Dimensions added; product photo alt is name plus description; meta description says how the price is given |
| `/categories/garlands` was in the prebuilt sitemap with no date | Listed in the live garland sitemap with the collections and guide; `lastmod` is the latest admin save among the designs shown. Prebuilt pages carry no `lastmod` (no reliable date) |
| No way to notify Bing of changes | `scripts/seo/indexnow.mjs` and the key file `public/811bb0d64c3644549f2fe0364bc86b52.txt` |
| No measurement | Event layer, off until the owner supplies a Google Analytics ID (`measurement.md`) |

Unchanged and verified working: HTTPS and host redirects (`http://` and `www.` reach `https://onlyfreshpetals.in` in one or two hops), slash-less canonicals, robots.txt, `Disallow` for `/admin` and `/api`, Organization and WebSite data, breadcrumbs, quote-only pricing, admin cache purging.

## Not changed, with reasons

- **No LocalBusiness or Florist data.** It needs a street address or a declared service-area business, opening hours and a logo. None is recorded. The Organization entry now names the two published delivery areas.
- **No Product, Offer, price or rating data.** Bouquets and garlands are quote-only; there are no verified review counts.
- **Reviews page untouched.** Its entries carry Hyderabad-area labels and stay that way. It has no review markup.
- **`fresh-petals-brown.vercel.app` still answers 200.** Its pages are canonical to the main domain, so it is not indexed as a duplicate; redirecting it is a Vercel domain setting (owner checklist).
- **About 45 thin tag pages** (for example `/categories/budget`, `/categories/market-price`, `/categories/rose` beside `/categories/roses`) list one to three products with a generic description. They have different product lists from each other, so they were not merged. Decide with Search Console data whether they earn impressions.
- **Instagram link** in the Organization data points to `freshpetals.hyderabad`, as recorded. Confirm it is still the right account.

## Weak source photographs

Flagged, not replaced: **FP-G083** (a phone screenshot), and designs photographed held up in a street or stall (FP-G064, FP-G065, FP-G069, FP-G099, FP-G100, FP-G112, FP-G115, FP-G122, FP-G130). Many originals are 575–725 px wide, which limits how large they can be shown. Re-photographing the most-enquired designs is the fix.

## Next review

First review 28 days after Search Console is verified. Until then there is no data to rank priorities by. Candidates to test against data, three at most per cycle:

1. Which garland collection or design pages get impressions without clicks (titles and descriptions).
2. Whether `/categories/garlands` and `/occasions/wedding` appear for the same queries, and which one searchers choose.
3. Whether the thin tag pages receive any impressions; if not, remove them from the sitemap.
