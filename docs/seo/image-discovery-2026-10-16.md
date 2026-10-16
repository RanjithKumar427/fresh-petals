# Image discovery and photograph descriptions (16 October 2026)

The release adds image entries to the existing sitemaps and makes the descriptions of product photographs accurate. Branch `seo/image-discovery-2026-10-16`, based on `main` at `2755486` (the live search-evidence-growth release).

- **Status:** local commit and write-blocked preview only. Nothing is pushed, merged or deployed.
- **Outcomes:** none claimed. An image sitemap adds discovery coverage; it does not show an indexing problem when absent, and predicts no ranking, image-search or AI-answer change.
- **Unchanged:** URLs, design codes, prices, quote-only behaviour, publication rules, admin, cities, canonicals, noindex rules, `lastmod` values, cache tags, analytics events, page design apart from one label on representative photographs.

## 1. Baseline (checked 16 October 2026)

| Lead from earlier notes | Current evidence | Verdict |
|---|---|---|
| robots.txt names three sitemaps, 393 page URLs, no images | Live: `sitemap.xml` 221, `sitemap-garlands.xml` 161, `sitemap-occasions.xml` 11; 393 distinct, no duplicates; no image entries | Confirmed |
| Sitemap URLs are healthy | All 393 fetched: every one answers 200, is self-canonical and indexable (`max-image-preview:large`) | Confirmed; no broken destination |
| URLs Google already showed (11 Oct snapshot) | `/categories/wedding`, `/stationery`, `/sunflower`, `/baskets`, `/subscriptions`, `/dried-flowers`, `/bouquets-with-vases`, `/flowerbox`, `/reviews` answer 200 self-canonical; `/studio` 301 → `/categories/bouquets`; trailing-slash forms canonicalise | No defect |
| Product images reachable | Catalogue files 200 `image/webp`; garland photographs on the public storage host 200 `image/jpeg`; that host has no robots.txt (404), so nothing blocks crawling | Confirmed |
| Images use product names as alt text | Name-only alt on All Flowers and other category cards, occasion cards, homepage featured bouquets, related products and non-bouquet city cards. Worse: 39 product pages show a **representative** photograph (shared, or of something else) with alt text describing the product, e.g. Florist Cutter's page described a cutter over a photograph of sunflower jars, and Jasmine Gajra's described gajra over loose jasmine buds | Confirmed defect |
| Bouquet collection uses `bouquetPhotoAlt()` | True. Checked against all 47 bouquet and lily photographs by eye: 44 match; Mandarin Lily Glow and Luxe Lily Bloom are photographed in a glass vase and Stargazer Affair in a round box with red roses, while each record says wrapping | Helper reused, narrowed for the three |
| Interaction-only image loading | Only hero campaign slides 2 and 3 load on interaction (campaign imagery, not products); every product and garland photograph has its `src` in the HTML | Left as is |
| Structured data | Garland pages carry `ImageObject` whose caption is the photograph's description; catalogue product pages carry breadcrumbs only, by design (no fixed offer) | Accurate; unchanged |
| Search Console exports | Only the one-day 11 Oct snapshot (57 impressions, private). No 28-day exports, so `scripts/seo/report.mjs` cannot run | Search-led copy changes **unresolved**; none made |

## 2. URL → evidence → fix

| URL(s) | Evidence | Kind | Fix |
|---|---|---|---|
| 39 product pages with representative photographs (pooja, baskets, boxes, add-ons, vases, offers, subscriptions, hampers, by-stem, toran, event garlands) | Alt described the product, the picture shows something else | **Defect** | Alt names the product, then says what the representative photograph shows; a label on the photograph says it is not this exact product |
| `/products/mandarin-lily-glow`, `luxe-lily-bloom`, `stargazer-affair` and their cards | Record says wrapping; photograph shows vase or box | **Defect** (description) | Photo descriptions omit the presentation; record conflict sent to the owner queue |
| All Flowers, other category pages, occasion pages, homepage, related products, city pages, pooja guide | Name-only alt where the photograph has a verified description | Enhancement | One helper, `productPhotoAlt()`, used by every card |
| 47 catalogue product pages with their own photograph | Not in any image sitemap | Enhancement | `<image:image>` in `sitemap.xml` |
| 156 garland pages | Not in any image sitemap | Enhancement | Main photograph and confirmed gallery in the live `sitemap-garlands.xml` |
| Listing, occasion, city and guide pages | They show the same photographs whose landing page is the product | Not listed | Each photograph is listed once, under its own product page |
| Query-to-page priorities | One-day snapshot only | **Unknown** | Unresolved until 28 days of exports exist |

## 3. What changed

**Image sitemaps** (`src/data/imageSitemap.ts`, `src/pages/sitemap.xml.ts`, `src/pages/sitemap-garlands.xml.ts`)
- Both sitemaps declare `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`.
- A catalogue product lists its own photograph: a file named for that product and used by no other (`hasOwnPhotograph`). Representative pictures and the placeholder are never listed.
- A garland lists its main photograph and confirmed gallery, read through the same `loadGarlands()` and `isListedGarland` as its page. Related-view candidates, drafts, unpublished, archived and unphotographed designs are excluded by those same rules.
- URLs are absolute and XML-escaped, original files only (no resized copies), deduplicated within each entry.
- `sitemap.xml` stays prerendered. `sitemap-garlands.xml` stays rendered on request with the `garlands` cache tag, so an admin save that changes a photograph or unpublishes a design updates it with the pages. No extra query: the image data arrives with the records already loaded.

**Photograph descriptions** (`src/data/productPhotos.ts`, `src/data/collectionGuidance.ts`, eight templates)
- `REPRESENTATIVE_PHOTOS`: what each of the 22 representative photographs shows, from looking at each one. Visible content only: no count, size, or claim that it is the product.
- `productPhotoAlt(product)`: own bouquet photographs use `bouquetPhotoAlt()`; representative ones read "<name>: representative photograph of <what it shows>", so a linked image still names its product.
- `bouquetPhotoAlt()` leaves out the presentation for the three bouquets photographed differently from their records.
- Used by category, occasion, homepage, related-product, city, city-catalogue and guide cards, and on product pages with a representative photograph. Product pages with their own photograph keep their existing alt.
- Product pages with a representative photograph show, on the photograph: "Representative photograph: … It is not this exact product; what you receive is confirmed on WhatsApp."

## 4. Before and after

| Where | Before (live) | After |
|---|---|---|
| `/products/jasmine-gajra` main image alt | "Jasmine Gajra: Fresh jasmine gajra based on daily flower availability" | "Jasmine Gajra: representative photograph of white jasmine buds", plus the label on the photograph |
| `/products/florist-cutter` main image alt | "Florist Cutter: Florist cutter add-on for flowerbox and subscription customers" | "Florist Cutter: representative photograph of sunflowers, white daisies and small purple flowers in glass jars along a dining table" |
| All Flowers card, Mandarin Lily Glow | "Mandarin Lily Glow" | "Mandarin Lily Glow: orange lilies, lily buds and fresh greenery" |
| `/occasions/birthday` card, Red Affair | "Red Affair" | "Red Affair: red roses and fresh rose foliage, in premium white wrapping" |
| `sitemap.xml`, Red Affair | `<url><loc>…/products/red-affair</loc></url>` | adds `<image:image><image:loc>https://onlyfreshpetals.in/images/bouquets/bouquet-red-affair-01.webp</image:loc></image:image>` |
| `sitemap.xml`, Jasmine Gajra | no image | no image (representative photograph) |
| `sitemap-garlands.xml`, FP-G106 | `<loc>` and `<lastmod>2026-10-12</lastmod>` | adds its stored main photograph (`…/media/products/5706cb4c-….jpg`) |

## 5. Sitemap comparison (same data, live versus preview)

- Page URLs: identical, 393 = 221 + 161 + 11; no URL added, removed or moved between sitemaps; no `lastmod` changed.
- Images: 47 in `sitemap.xml` and 156 in `sitemap-garlands.xml` (no public design has a gallery photograph today), one per product page, none on listing pages, none repeated across pages. All 203 are absolute and answer 200 as images.
- Each listed image is the main photograph its page displays: 245 product entries compared, 0 mismatches.
- All three files parse as XML in a browser's strict parser; image elements only under `<url>`; largest file 48 KB.
- Counts are not fixed: they follow the catalogue and garland publication.

## 6. Verification

Production-style isolated build served on `127.0.0.1:4399`, with inquiry and admin routes refused before the handler. No analytics ID locally, so no tag loaded. WhatsApp and analytics requests aborted, drafts captured without sending.

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 43 of 43. The new test covers own-photograph rules, descriptions, XML escaping and deduplication. It also runs the live garland sitemap through the real loader from controlled records: hidden designs and related views excluded, a changed photograph and an unpublished design followed on the next request, and the same cache headers as the pages. |
| Image-discovery browser checks (new, 34) | PASS, 34 of 34 |
| Earlier release checks (`sg-check` 32, `jr-check` 6, `rt-check` 10, `cc-check` 59) | PASS, all on the final build |
| Sitemap audit and image-to-page mapping | PASS (section 5) |
| Type check | 20 errors, all pre-existing and unchanged: `SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1 |

The 34 browser checks, at 390 and 1440 px:

- **Without JavaScript**, these carry their facts, images and links in the HTML: the bouquet page (`red-affair`), the representative page (`jasmine-gajra`, price kept), FP-G106 (record alt equals its `ImageObject` caption, no amount), the birthday occasion (at most two eager images), Bengaluru, the pooja guide, All Flowers and the homepage.
- **In the browser:** first described image loaded, no broken image and no horizontal overflow on all eight pages, and the representative label visible on both widths.
- **Bouquet enquiry:** one `whatsapp_enquiry_click` with `item_id` `red-affair` and no customer field. The captured draft names the product and link, with no amount.
- **Add to basket** keeps the item.
- **FP-G106 with Bengaluru chosen:** one enquiry event for FP-G106. The draft has the code, Bengaluru and the canonical link, with no amount.
- **Nothing sent:** no analytics tag was requested and no write was attempted.

Screenshots, read by eye: `C:\Users\ranji\Downloads\fresh-petals-preview-2026-10-13\image-discovery`. The first desktop pass showed the representative label below the sticky photograph and out of view at 1440×900, so it was moved onto the photograph and rechecked.

## 7. Owner inputs (added to `owner-checklist.md`)

1. **Own photographs for the 39 products shown with a representative picture.** Until then they stay out of the image sitemap and keep the label. The finished-gajra photograph is already item 1 in `search-evidence-growth-2026-10-14.md` section 5.
2. **Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair:** is the design wrapped, as recorded, or in a vase or box, as photographed? This also decides which All Flowers group they belong to.
3. **Three products with no photograph** (Chocolates, Flower Food Sachets, Pet Friendly Flowerbox): none is listed until one exists.

## 8. After release (owner, in the accounts; nothing here was done)

See `measurement.md`, "Account checks outstanding". In short:
- check that both changed sitemaps are read again after deployment;
- inspect one bouquet, one representative product and FP-G106;
- look at Performance with Search type: Image, separately from Web.

Resubmitting a sitemap is optional: Google re-reads listed sitemaps.

## 9. Rollback

Revert this branch's commit on `main`, or promote the deployment for `2755486` in Vercel. No data, setting or account was changed.
