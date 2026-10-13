# Search expansion release, 13 October 2026

Three focused improvements chosen from the owner's keyword export and a look at what competing pages help customers decide. Goal: more relevant non-brand impressions, across more query families, on more useful landing pages. Clicks and enquiries are secondary. Nothing here claims a ranking or an uplift.

## Evidence used, and how far it goes

| Source | What it is | Limits |
|---|---|---|
| Keyword Planner export, Bengaluru, Sep 2025–Aug 2026 (owner-supplied, not in the repository) | 106 keywords; 92 with an average-monthly estimate (one of them zero), 14 with none | Estimates come only in bands of 50, 500, 5,000 and 50,000. All monthly columns are blank, so there is no seasonality. Close variants overlap; the bands must not be added up. "Competition" is advertiser competition, not ranking difficulty. |
| Research note with 26 expanded phrases | Vocabulary from competitor collections | Unmeasured. Used for wording only. |
| Public web searches and four competitor pages, 13 Oct 2026 | Searches worded with "Bangalore", run from a US-based tool | Not Bengaluru-localised results. No rank is claimed for any site. |
| Search Console | Verified property, still "processing" on 12 Oct 2026 | No impressions data yet. |
| Semrush | Returned `no_api_units` earlier; not retried | Not used. |

What the competing pages do (observed, not copied): the pooja pages of GetFlowersDaily and BigBasket are organised by product form (loose, strings, gajra, garlands) and show a unit for each. A Bangalore rose collection (Black Tulip) explains rose colours, names presentation styles and links to occasions. None of their delivery promises, prices, ratings or quantities are repeated here.

## What was chosen, and what the findings changed

The starting shortlist of three held. Findings adjusted how each was done:

1. **Pooja discovery.** Confirmed on the live site: no page linked to `/categories/pooja-flowers` from the homepage, the Shop Flowers menu or the footer, although the page is public, indexed and in the sitemap. It answers the "jasmine flowers" (5,000 band), "pooja flowers" and "loose flowers" (500 band) families. *Changed by the findings:* the menu left pooja out on purpose at launch (`src/data/navigation.ts`), so it is added as one link, not as a launch category. No homepage range or occasion page changes.
2. **Bouquet collection.** "flower bouquet" and "bouquet" sit in the 50,000 band, "rose bouquet" and "lily bouquet" in the 5,000 band. The page already had the three groups. *Changed by the findings:* every bouquet record lists its flowers and its wrapping, and exactly one (Colour Pop Love) is arranged in a glass vase, so the guidance and photograph descriptions are generated from the records instead of written by hand. Separate rose and lily pages were rejected: three and two designs would only repeat this page.
3. **Pooja collection by form.** Eleven offerings sat in one flat list. *Changed by the findings:* no pooja product records a pack size or unit, and four share one category photograph and four another. So the page groups by form, says what to tell us, and states that some photographs show the kind of flowers rather than the exact pack. No units were invented. The two "Pooja Flower Box" products are different records (one assorted and market-priced in Pooja Flowers, one a flowerbox with a starting price in Flowerbox); both stay, and the section says how they differ.

Not chosen now: new pages for flower jewellery, poola jada, veni and festival flowers (500 and 50 bands). The catalogue has no confirmed products for them (`launchCatalogue.ts` lists veni and torans as not ready).

## Baseline of the pages changed (live HTML, 13 Oct 2026)

| Page | Purpose | Title | H1 | Canonical / index | In HTML before | Links before |
|---|---|---|---|---|---|---|
| `/` | Local florist discovery | Flowers in Bengaluru \| Bouquets & Garlands \| Fresh Petals | Flowers that feel as special as the moment. | self / indexable | Hero, 4 bouquets, occasions, FAQ | No link to the pooja collection; third hero slide's second button went to garlands |
| `/categories/bouquets` | Bouquet choice | Flower Bouquets in Bengaluru \| Rose & Lily \| Fresh Petals | Flower Bouquets in Bengaluru | self / indexable | 8 bouquets in 3 groups, 2 answered questions | Photo alt was the product name only; no text on how designs differ |
| `/categories/pooja-flowers` | Pooja flowers and jasmine | Pooja Flowers & Jasmine in Bangalore \| Fresh Petals Bengaluru | Pooja Flowers in Bengaluru | self / indexable | 11 products in one list, 2 answered questions | Not linked from any menu, footer or the homepage |

Titles, H1s, canonicals and indexing are unchanged by this release.

## What changed

- **Menu, footer, homepage:** "Pooja flowers" in Shop Flowers (desktop and mobile) and the footer; a "Pooja flowers" shortcut on the homepage; the third hero slide keeps "Plan your flowers" and its second button is now "Browse pooja flowers". The hero's photographs, layout and other slides are untouched.
- **Bouquets:** under each group heading, one sentence on how the designs differ, a line per bouquet with its recorded flowers and wrapping, and links to the matching occasion pages. A short note on wrapped bouquets against the vase arrangement. Photograph descriptions now name the flowers and presentation. Two more answered questions (roses, lilies or mixed; getting a price for a date).
- **Pooja flowers:** five sections with jump links (loose and daily; boxes and baskets; strings, gajra and torans; regular deliveries; bulk and ceremony), a note per section, "What to send us on WhatsApp" with a ready draft, "Loose flowers or a string?", and the photograph note. Prices shown are the same as before.

Unchanged: quote-only pricing for bouquets, lilies and garlands; pooja prices; the basket; occasion assignments; garland pages; sitemaps; structured data.

## Query family to page

| Query family (examples from the export, with band) | Page |
|---|---|
| Local florist: florist bangalore, flower shop bangalore, flowers in bangalore, flower delivery bangalore (5,000) | `/` |
| Bouquets: flower bouquet, bouquet (50,000); rose bouquet, lily bouquet, bouquet delivery (5,000); bouquet delivery bangalore (500) | `/categories/bouquets` (`#roses`, `#mixed`, `#lilies`) |
| Occasion bouquets: birthday bouquet, birthday flowers, anniversary bouquet (500) | `/occasions/birthday`, `/occasions/anniversary` |
| Pooja and jasmine: jasmine flowers, mallige (5,000); pooja flowers, puja flowers, loose flowers, flower toran, mallige hoovu (500); daily pooja flowers, pooja flowers online bangalore (50) | `/categories/pooja-flowers` (`#loose`, `#boxes`, `#strings`, `#regular`, `#bulk`) |
| Subscriptions: flower subscription, flower subscription bangalore (500) | `/categories/subscriptions` |
| Wedding garlands: marriage garlands (5,000); wedding garlands, varmala, jaimala, wedding mala (500); poola mala (50) | `/categories/garlands` |
| Garlands by flower: rose garland, lotus garland (500); tuberose garland, rajnigandha garland (50) | the three garland collections |
| Garland selection: how to choose wedding garlands, lotus vs rose garland (no estimate) | `/guides/choosing-wedding-garlands` |
| No page yet: flower jewellery, poola jada, veni, festival flowers, flower care questions | none; needs confirmed products or a decision first |

Broad single words in the export (flowers, rose flower, lotus flower, flower names, pink flowers) are mostly information or image searches. No page is aimed at them.

## How this will be measured

No tracking was added. The existing event layer now also marks the bouquet, pooja and subscription collections as lists (`view_item_list`), which records nothing until a Google Analytics ID is set.

From Search Console, once it holds data, export Web performance for 28 days and for the previous 28 (see `measurement.md`) and run `node scripts/seo/report.mjs <folder>`. Read three things, in this order:

1. **Non-brand impressions**, in the report's totals.
2. **Query-family coverage:** how many of the families above have at least one query with impressions. Filter the Queries export by the family's words (bouquet, rose, lily; pooja, puja, jasmine, malli, mallige, gajra, toran; garland, mala, varmala, jaimala; florist, flower shop, flower delivery).
3. **Landing pages earning impressions:** the count of pages in the Pages export with impressions, and whether `/categories/pooja-flowers` and `/categories/bouquets` are among them.

Record the release date (13 October 2026) beside the first export. Search Console has no city dimension, so "Bangalore" in a query is the only local signal it gives. Rows under 30 impressions are not evidence of change.

## Still needed from the owner

- Pack sizes or units for the pooja products (grams, length, pieces). Until recorded, the page says they are confirmed on WhatsApp.
- Own photographs for the pooja products that share a category picture: Daily Pooja Flowers, Temple Bulk Flowers, Pooja Basket and Event Garlands share one; Jasmine / Malli, Pooja Flower Box (flowerbox), Jasmine / Malli Subscription and Jasmine Gajra share another.
- Whether subscriptions, torans and gajra are offered now. They are listed and priced in the catalogue, but the launch notes mark torans and veni as not yet ready. If they are not offered, they should be unpublished rather than hidden from this page.

## Release record

| | |
|---|---|
| Release commit | `297aa03` on `main` (fast-forward from `d5349f1`, no force-push) |
| Pushed | 13 Oct 2026, 12:06:48 IST (06:36:48 UTC) |
| Vercel deployment | `fresh-petals-1po1qlabm`, target production, status Ready, created 12:06:52 IST (06:36:52 UTC). GitHub deployment 7031836126 records commit `297aa03`. |
| First seen serving the release | 13 Oct 2026, 12:08:21 IST (06:38:21 UTC), on `https://onlyfreshpetals.in/categories/pooja-flowers` |
| Affected URLs | `/`, `/categories/bouquets`, `/categories/pooja-flowers`; the menu and footer on every page |

Live verification, 13 Oct 2026 (after go-live):

| Check | Result |
|---|---|
| HTTP 200, titles, H1s, canonicals and robots on the three pages equal to the baseline table above | PASS |
| `sitemap.xml` identical to the verified build (157 URLs) | PASS |
| Pooja flowers link in the desktop menu, mobile menu, footer and shortcut strip; slide three's "Browse pooja flowers" opens the collection; links work without JavaScript | PASS |
| Bouquets: 8 designs, three groups with guidance and occasion links, photograph descriptions, no amounts in the HTML | PASS |
| Pooja: 11 products, prices equal to the pre-release list, five sections, jump links, WhatsApp draft to the shop's number with no amount | PASS |
| No horizontal overflow at 360, 390, 768 and 1440 px on the three pages; all 11 pooja photographs load | PASS |
| Hero: three slides and headline; Garlands menu link; 156 garland codes on the listing | PASS |
| Quote-only suite | 75 of 76. The one flag is the long-standing one: priced pooja suggestions under "You may also like" on the Event Garlands page. |
| Basket and draft suite (drafts captured, nothing sent or recorded) | 7 of 7 |
| Previous search-release suite | 50 of 50 |
| Comparison against the previous production deployment's own URL | BLOCKED: that URL requires a Vercel login. The baseline table and the pre-release price list were used instead. |

Search Console baseline, 13 Oct 2026: **unavailable**. The verified Domain property still shows "Processing data, please check again in a day or so" with no queries, pages or impressions. No sitemap had been submitted when last checked (12 Oct). There is therefore no pre-release figure for non-brand impressions, query coverage or landing-page coverage.

For the first comparison, use two equal and complete periods that both end at least three days before the export, with 13 October 2026 marked as the release date. If Search Console's data begins after the release, the first period is a starting point, not a before-and-after. Measure non-brand impressions, the number of query families with impressions, and the number of landing pages with impressions, as described above. No search improvement is claimed from this release.
