# Search-competitiveness release, 13 October 2026

Follows the "FreshPetals versus FNP: search visibility gap audit" (13 Oct 2026). It went live on 13 October 2026 (see "Release record"). No ranking is promised or claimed, and a passing check here is not evidence of search improvement.

Base: `origin/main` at `b55f3c0`.

## What the audit asked for, and where it stands

| Audit item | State |
|---|---|
| 1. Expose and strengthen All Flowers | **Done in this release.** |
| 2. Descriptive titles and product-type facts | **Done in this release** for bouquet and lily titles and for catalogue product facts. Garland specifications need owner evidence. |
| 3. Business identity | **Already live** (Release 3): one Organization with the FP logo, "FreshPetals" as the alternate name, the unconfirmed origin removed, 59 cities described as coverage and not branches. Operator name, response hours and a support email are owner inputs. |
| 4. Guides and directory | **Already live** (Release 3). The audit's four 404s were read before that release went out. |
| 5. Measurement | **Already live**: GA4 `G-V75FJQ06ZS` is set in Vercel Production only and loads once per page; the local build contains no tag. Nothing was added here. |
| 6. Independent references | Briefs and workflow already drafted in `release-3-evidence-and-content-briefs.md`. Nothing posted or contacted. |
| 7. Garland and pooja specifications, weak originals | Owner evidence. Not invented. |
| 8. Vercel host redirect, legacy pages | Not changed here; see "Not done". |

## Changes

**All Flowers (`/categories/all-flowers`).** The page already listed the whole public flower catalogue (51 products when checked; the number is computed, never typed). It is now:

- first in Shop Flowers on desktop and mobile, in the footer, in the links under the homepage hero, beside the homepage bouquet button ("These are our featured designs. Browse the full flower catalogue") and linked from the bouquet collection;
- titled "Flowers Online | Bouquets, Lilies & Arrangements | Fresh Petals" with the H1 "All Flowers", distinct from the homepage and the bouquet collection, and self-canonical;
- grouped by how a product is presented, read from each record: hand-wrapped bouquets (32), lily bouquets (9), arrangements in a vase (6), flowers in a box or a basket (2), more flowers (2). Each product is in exactly one group, empty groups are not shown, and the jump links carry the counts;
- introduced with the recipient city and WhatsApp confirmation, and followed by what a quote includes, how the page differs from the bouquet collection, and links to occasions, delivery cities and guides.

The same products are listed as on the live page, with identical price labels. The homepage button now reads "View our 8 featured bouquets", so the site no longer implies the range ends at eight. The page no longer shows a "prices start from" amount: that figure came from its two priced products and misdescribed a page of quoted designs.

**Product titles.** `src/data/productTitles.ts` builds a bouquet or lily title from the recorded flowers and presentation, keeping the model name and URL: "Red Affair – Red Rose Bouquet", "Blush Lily Letter – Blush Lily Bouquet", "First Love Pink & White Tulip Bouquet", "Colour Pop Love Gerbera & Daisy Vase Arrangement". Supporting foliage and fillers are not named; three or more different flowers become "Mixed Flower"; a product with no recorded flowers keeps its plain title (3 of 47). All 47 titles are unique and within 70 characters. Garland titles (name and FP-G code) and other products are unchanged.

**Product facts.** "Listed stems" is shown only on bouquets and lilies that record a range, and says it is a listed range, not a count of the bouquet as made. Loose flowers, strings, boxes and other products no longer show a stem line or "Not recorded"; they say the quantity is confirmed on WhatsApp. The care grade ("Occasional", "Premium care") is replaced by the product's own first care instructions, or left out when none is recorded.

## Verification (local preview of the production build)

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 39 of 39 (2 new) |
| Release checks at 375, 390, 768 and 1440 px | PASS, 28 of 28 |
| Type check | 20 errors, all in three files this release does not touch (`SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1): the same errors as the base. No new error. |

The release checks cover: the same 51 products and price labels as the live page; groups adding up with no duplicate; titles, H1s and canonicals; menu, footer and homepage links; stem and care facts on a bouquet, loose jasmine and gajra; quote-only and priced labels; the garland title; no Google tag in a local build; an unchanged sitemap; 156 garlands; no overflow or broken photographs; and an All Flowers to product draft naming the product, its link and the recipient city with no amount. The pooja collection keeps its five sections and enquiry guidance.

Screenshots read by eye: the top of All Flowers on desktop and the First Love product facts on mobile. The rest of All Flowers, its mobile view and the homepage link were checked by script only.

Not rerun for this release: the full city, basket and garland suite (345 checks), last run on the Release 3 build.

## Not done in this release

- **`fresh-petals-brown.vercel.app` redirect.** It needs a hosting change. In Vercel, open the project's Settings, then Domains, edit `fresh-petals-brown.vercel.app` and set it to redirect to `onlyfreshpetals.in` as a permanent (308) redirect; paths are preserved. Do not add a wildcard for `*.vercel.app`: preview deployments keep their own protected addresses.
- **Legacy pages** (`/categories/rose`, `/roses`, `/budget`, `/floral-tools`): not reviewed or changed. No noindex, redirect or merge was made.
- **Garland confirmation checklist and enquiry-draft questions:** unchanged from what is live.
- **Reviews page classification and a completed-order data structure:** unchanged; the workflow is in the Release 3 briefs.
- **Search Console, Bing, crawler logs, Semrush and the assistant benchmark:** not read or run. Positions are UNKNOWN; the benchmark is NOT RUN.

## Query to page

| Query family | Page |
|---|---|
| flowers online, online flower delivery, buy flowers online | `/categories/all-flowers` |
| flower delivery india, send flowers (brand and service entry) | `/` |
| flower bouquet, rose, lily or mixed bouquet | `/categories/bouquets` |
| flowers in Bengaluru or Bangalore, and other city queries | `/locations/<city>` |
| wedding garlands, varmala, poola mala | `/categories/garlands` and its collections |
| a named design, such as red rose bouquet or pink tulip bouquet | the product page, by its new title |

No page was redirected and no cannibalisation is asserted; that needs query-by-page data.

## Owner inputs

1. Operator or founder name, response hours and a support email, if they should be public.
2. Where the business began, if it should be stated.
3. Confirmed specifications for a first set of garlands (single or pair, length, flowers used) and units for pooja products.
4. Flowers on record for the three bouquets whose titles stayed plain.
5. Separate photographs for loose jasmine, gajra and the pooja packs; better originals for small garland photographs.
6. Genuine completed-order feedback, with consent.

## Release record

| | |
|---|---|
| Release commit | `6fd99e1` on `main`, fast-forward from `b55f3c0` (the rollback reference); no force-push |
| Pushed | 13 Oct 2026, 21:22:54 IST (15:52:54 UTC) |
| Vercel deployment | `https://fresh-petals-84mpbc7hr-ranjiths-projects-1491695d.vercel.app`, production, serving `https://onlyfreshpetals.in`. GitHub deployment 7043273842 records commit `6fd99e1`, state success. |
| First seen serving the release | 13 Oct 2026, 21:24:10 IST (15:54:10 UTC), on the homepage |

Live verification, 13 Oct 2026 (drafts captured, nothing sent; inquiry requests aborted in the browser; no database or admin write):

| Check | Result |
|---|---|
| Release checks against production at 375, 390, 768 and 1440 px | PASS, 28 of 28 |
| All Flowers first in Shop Flowers on desktop and mobile, in the footer, and linked from the homepage and the bouquet collection | PASS |
| All Flowers: 51 products in five groups (32, 9, 6, 2, 2), each once, with jump links | PASS |
| "View our 8 featured bouquets" on the homepage; hero unchanged | PASS |
| Titles on Red Affair, Blush Lily Letter, First Love and Jasmine / Malli; garland title keeps its FP-G code | PASS |
| Stem range only on bouquets and qualified; no stem line on loose jasmine or gajra; care notes in place of a grade | PASS |
| Quote-only labels with no amount; priced products keep their labels; All Flowers to product draft names the product, its link and the recipient city | PASS |
| GA4: one tag per page on five pages; page views and WhatsApp clicks accepted (204); page URLs without queries; only the referring site's origin sent | PASS |
| No broken photographs or horizontal overflow | PASS |
| 156 garlands, fifteen city links, `sitemap.xml` unchanged, `/admin` redirects to sign-in | PASS |

A first attempt at the live run failed because of a brief network drop on the checking machine; the site answered normally a minute later and the run above is the repeat.

## Deployment handoff

Fast-forward `main` to this branch, push `main` alone, wait for Production, then push the branch. Rollback reference: `b55f3c0`. GA4 needs no action: the Production environment already has `PUBLIC_GA_MEASUREMENT_ID`. After deploying, check `/categories/all-flowers`, the menu, three product titles and one captured draft; then make the host redirect above.
