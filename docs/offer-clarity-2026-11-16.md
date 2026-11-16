# Offer clarity, 16 November 2026

Content, data and template corrections so a customer can tell what a design is, what is supplied, how it is priced and which collection fits, before sending a WhatsApp enquiry. Three commits on top of `30b2ccd`: `f0f4b7c` (offer clarity), `fbe9786` (correction) and the release commit (see "Release, 16 Nov 2026"); released from branch `release/offer-clarity-live-2026-11-16`.

- **Status:** see "Release, 16 Nov 2026" for what is in production. The dashboard copy (24 fields across 17 products) is applied only by `scripts/content/apply-copy-changes.mjs`, run through the `Content copy` workflow; until it has run, Cloudflare builds keep the dashboard's names and short/long descriptions for those products (`src/data/dashboardCatalogue.ts`), and every other change is code-only.
- **Reference gap:** the caption audit, URL register and competitor research named in the brief were not attached; only the brief was. Findings were rechecked against this repository and the live site (16 Nov: sitemap 82 products, 55 categories, 58 city pages; Sweet Petal Hour, Violet Picnic, Florist Cutter and All Decor pages read live).
- **Not changed:** URLs, slugs, design codes, garland records, canonicals, migrations, dependencies, checkout, Supabase settings.

## What changed, by priority

1. **Contradictions and scope** (`src/data/productCatalog.ts`, `src/data/categoryPages.ts`, `src/components/MegaNav.astro`)
   - Red Flowers: white (Love at First Sight) and peach (Midnight Romance, Rose Promise) designs removed; Rose Promise moved to Pastel, Love at First Sight to White.
   - Yellow Flowers: orange and coral lilies removed (still under Lilies).
   - Fragrant Lilies (superseded by the correction): now lists lilies recorded as oriental or stargazer, shown as "Oriental & Stargazer Lilies".
   - Violet Picnic: caption "Stylish bouquet" → "Statice in a wicker basket". Sweet Petal Hour: "Pastel soft" → "Bright mixed gerberas"; removed from Pastel and Mini; gerbera colours recorded from its own description; vase stays an owner question.
   - Pink gains Timeless Hug (pink roses); Blue gains Winter Whisper (blue baby's breath).
   - Hampers lists hampers only (4 add-ons were counted as hampers). Gift Basket and the chocolate hamper are no longer counted as add-ons. The pet flower box left All Decor; the housewarming hamper left Room Mist and Plants (its extras are optional).
   - Custom now lists the five made-to-brief products, not only a subscription. All Decor, All Gifts, Stationery, DIY Kits and Premium Flowers intros say what is (and is not) sold.
   - Claims: "Pet Friendly" shown as "Homes with Pets"; the product is "Flowerbox for Homes with Pets". Fragrance claims removed from two lily designs. Menu: "Bestselling" → "Selected", "Saturday Subscriptions" → "Weekly Flowerbox Plan", All Flowers and Hand-Tied links go to their own pages.
2. **Identity** (`src/data/productSupply.ts`, `src/data/productTitles.ts`)
   - A plain line under every product name, on product cards (in place of the category) and in WhatsApp drafts: Cloud Nine Blue → "Blue gypsophila bouquet"; Florist Cutter → "Stem cutter for home arranging".
   - Gypsophila-only designs are named by it in titles (Cloud Nine Blue, Pink Secret, Cotton Candy). 13 vague bouquet and lily short descriptions now name the flowers and presentation (three also said "bouquet" for a vase design).
3. **What is supplied**
   - "What's included" lists items only; ordering steps are dropped; a new "On request" list holds the message note and optional extras (`onRequest`).
   - Quantity basis per product (by the stem, one toran made to length, one box, per delivery); drafts ask "Quantity needed" instead of "Quantity: 1" for these.
   - Kind-aware boilerplate: tools, vases, add-ons, dried flowers and plants no longer show "Fresh Flowers · Hand-Arranged", "Types of flowers", "Made to order" or flower substitution text; "Ideal for" shows occasion names, not slugs.
4. **Collection introductions** (`src/data/categoryPages.ts`, moved out of `src/pages/categories/[slug].astro`): every one of the 70 category addresses has a written intro. 21 used the generic "Explore …" fallback (17 of them indexable, matching the audit's count; 4 canonicalised, noindexed or empty), and All Decor and All Gifts had their own "Explore" lines. Tag pages get readable names. Empty pages say what is not listed and where to go.
5. **Pricing**: quote wording names the actual drivers per product kind (design, flowers, quantity, date; option and size for items; frequency for plans); bouquets name date and delivery address. No price, discount, minimum or fee was added.
6. **City, occasion, guides**: an "Ordering for <city>" checklist on all 58 city pages; three unverified demand claims (Hyderabad, Kolkata, Vizag) and "nothing is held back" removed; an extra FAQ on city root pages. "Choosing for …" points on all 15 occasion pages. Bouquet guide: colour, scent, box and basket section. Jasmine guide: recurring plan set apart from one-off jasmine.

## Before → after (representative)

| Where | Before | After |
|---|---|---|
| `/products/cloud-nine-blue` title | Cloud Nine Blue – Bouquets | Cloud Nine Blue – Blue Gypsophila Bouquet |
| `/products/violet-picnic` caption | Stylish bouquet | Mixed statice flower basket (identity line) |
| `/products/sweet-petal-hour` caption | Pastel soft | Mixed gerbera arrangement |
| `/products/florist-cutter` | Types of flowers: "Florist cutter option, …, Final price on WhatsApp"; Fresh Flowers · Hand-Arranged; Ideal for: housewarming, just-because | What it is: Stem cutter for home arranging; Delivery Confirmed on WhatsApp · WhatsApp Ordering; Ideal for: Housewarming, Just because |
| `/categories/all-decor` | Explore flower decor, torans, lights, diyas … | Dried flowers — a wrapped dried bunch and a dried arrangement made to order — a decor vase quoted by type, a live mini succulent … (exclusions last; as corrected) |
| `/categories/diy-kits` | DIY Kits: "DIY floral kits and creative gifting options available on request." | DIY Flower Arranging Boxes: "The DIY flower box: loose fresh flowers packed in a box …" (as corrected) |
| WhatsApp draft, Roses by Stem | I want to order Roses by Stem (Market price today). Quantity: 1 | I want to order Roses by Stem (rose stems, sold by the stem). Price: Market price today. Quantity needed: |

## Checks (16 Nov 2026, first commit; historical, superseded by the later checks below)

| Check | Before | After |
|---|---|---|
| Node tests (`scripts/audit/*.test.mjs`, `scripts/*.test.mjs`) | 173/173 | 178/178 (5 new in `content-offer.test.mjs`; 5 existing assertions repointed to the moved module or the intended new title/date) |
| `astro check` | — | 0 errors in repository sources (1 error only in the ignored fixture copy `data/focused-audit-…/`, from the fixture's own TLS patch) |
| Cloudflare build, local fixture (PostgreSQL 16, live publication mirrored: 82 of 89) | pass, 313 pages, CSP check pass | pass, 313 pages, CSP check pass |
| Vercel-target build | fails CSP check (pre-existing) | unchanged |
| Built HTML set / canonicals | — | identical set; no canonical changes; robots change only on `/categories/mini-bouquets` (now empty → noindex, the existing empty-page rule) |
| sitemap.xml | 213 URLs | 212 (`/categories/mini-bouquets` drops out, as above) |
| Internal links in built pages | — | none unresolved |
| Rendered pages, Chrome desktop 1366 and mobile 390 | — | 24 sampled pages (9 product, 9 category, 2 city, 2 occasion, 2 guide): 200, no horizontal overflow, no script errors; enquiry drafts captured without opening WhatsApp. Sampled, not exhaustive. |

## Owner questions (fact-blocked; neutral copy published meanwhile)

- **Q1** Sweet Petal Hour: is it delivered in a vase? The record says only "Vase-style arrangement".
- **Q2** Mini bouquets: which designs, if any, are made as mini bouquets? None is listed until confirmed.
- **Q3** Dried Flower Vase Set: is a vase always included? The name says "vase set"; the record says only "vase option". Shown meanwhile as "agreed in your quote".
- **Q4** Mini Succulent Gift: is a pot or planter included in the price, and how is the plant presented? Shown meanwhile as "agreed in your quote".
- **Q5** Lily variety (oriental or Asiatic) for designs recorded only as "lilies", "white", "orange", "coral", "ivory", "premium", "pink" or "blush" lilies: a design recorded as oriental joins the Oriental & Stargazer page automatically.
- **Q6** Sunrise Asiatic Vase: which colours are "sunrise tones"? It is out of Yellow Flowers until a colour is recorded.
- **Q7** Jasmine and gajra: the selling unit (length, weight or count).
- **Q8** Message note: free or charged, and how it differs from the greeting card add-on.
- **Q9** (open since 21 Oct) Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair presentation.
- **Q10** Weekly flowerbox: the delivery day (the menu said Saturday; nothing records it).

## Consolidation to consider (not done)

Single-product or duplicate pages kept with their indexing unchanged: `plants-succulents` = `plants-and-succulents`; `premium-flowers` = Lily stems; `red-flowers`, `jasmine`, `stationery`, `home-decor`, `desk-decor`, `market-price`, `bride` (one product each); menu links to 12 empty pages (Eid, Tuberose, Hydrangeas, Orchid, Mini Bouquets, Handcrafted Torans, Urli Boxes, Fairy Lights, Diyas, Flowers & Jewellery, Planners, Skincare, Tea).

## Inventory register

All 89 catalogue records (82 live, 7 unpublished) get the template changes (identity line, included / on request, kind-aware facts). Garland designs (153 at the baseline) are unchanged: their names, FP-G codes and photograph captions are kept, and their enquiry drafts are untouched. Categories: 70 addresses, all with written intros (above). Occasions: 15, all with choosing points. City pages: 58 (15 authored hubs, 43 catalogue roots), all with the ordering checklist; hubs edited: Hyderabad, Kolkata, Visakhapatnam. Guides: 4; edited: bouquet, jasmine.

| Record | Status | Identity line | Record changes | Blocked |
|---|---|---|---|---|
| `blue-mountain-grace` | live | White rose bouquet | template only |  |
| `blush-garden-kiss` | live | Gerbera & carnation bouquet | included / on request split |  |
| `cloud-nine-blue` | live | Blue gypsophila bouquet | included / on request split |  |
| `cloud-white` | live | White rose bouquet | template only |  |
| `colour-pop-love` | live | Gerbera & daisy vase arrangement | included / on request split |  |
| `colourful-confession` | live | Mixed flower bouquet | short copy; included / on request split |  |
| `cotton-candy` | live | Pastel gypsophila flower box | included / on request split |  |
| `cotton-candy-poetry` | live | Pink & white chrysanthemum bouquet | template only |  |
| `country-love-note` | live | Mixed flower bouquet | included / on request split |  |
| `daisy-morning` | live | Mixed flower vase arrangement | short copy; long copy |  |
| `dear-sunshine` | live | Sunflower vase arrangement | short copy; long copy; included / on request split |  |
| `first-love` | live | Pink & white tulip bouquet | template only |  |
| `lavender-whisper` | live | Rose & statice bouquet | template only |  |
| `lilac-garden` | live | Purple aster bouquet | short copy |  |
| `lily-calm` | live | White oriental lily bouquet | tags −fragrant-lilies; short copy; included / on request split |  |
| `little-lilly-prayer` | live | Lily & stock bouquet | tags −fragrant-lilies |  |
| `love-at-first-sight` | live | Lily & rose bouquet | tags −red-flowers +white-flowers |  |
| `midnight-romance` | live | Rose & carnation bouquet | tags −red-flowers |  |
| `peach-petal-promise` | live | Peach & white rose bouquet | template only |  |
| `pink-lily-wish` | live | Pink oriental lily bouquet | tags −fragrant-lilies |  |
| `pink-secret` | live | Pink gypsophila bouquet | included / on request split |  |
| `pink-tulip-promise` | live | Pink tulip bouquet | template only |  |
| `purple-crush` | live | Purple chrysanthemum bouquet | template only |  |
| `purple-promise` | live | Mixed flower bouquet | template only |  |
| `purple-whisper` | live | Mixed statice bouquet | included / on request split |  |
| `rainbow-hug` | live | Mixed flower bouquet | included / on request split |  |
| `red-affair` | live | Red rose bouquet | included / on request split |  |
| `rose-promise` | live | Peach & white rose bouquet | tags −red-flowers +pastel-flowers |  |
| `snow-white-saga` | live | White rose bouquet | template only |  |
| `sunshine-confession` | live | Yellow chrysanthemum vase arrangement | short copy; long copy |  |
| `sunshine-story` | live | Mixed flower bouquet | template only |  |
| `sweet-petal-hour` | live | Mixed gerbera arrangement | tags −pastel-flowers −mini-bouquets; short copy; long copy; ratingLabel; flowers | Q1, Q2 |
| `timeless-hug` | live | Pink rose bouquet | tags +pink-flowers; included / on request split |  |
| `violet-picnic` | live | Mixed statice flower basket | ratingLabel; included / on request split |  |
| `white-silence` | live | White oriental lily bouquet | included / on request split |  |
| `wild-sunset-charm` | live | Daisy & statice bouquet | short copy; included / on request split |  |
| `winter-whisper` | live | White chrysanthemum bouquet | tags +blue-flowers |  |
| `all-white-fragrance` | live | White lily bouquet | tags −fragrant-lilies; short copy; long copy; badge; included / on request split | Q5 |
| `fragrance-festive-giftbox` | live | Lily flower box | tags −fragrant-lilies; short copy; long copy; included / on request split | Q5 |
| `mandarin-lily-glow` | live | Orange lily arrangement | tags −fragrant-lilies −yellow-flowers; included / on request split | Q5, Q9 |
| `pink-serenity-flowerbox` | live | Pink lily flower box | tags −fragrant-lilies; included / on request split |  |
| `blush-lily-letter` | live | Blush lily bouquet | tags −fragrant-lilies; short copy; included / on request split |  |
| `coral-lily-bloom` | live | Coral lily bouquet | tags −fragrant-lilies −yellow-flowers; short copy; included / on request split | Q5 |
| `ivory-lily-grace` | live | Ivory lily bouquet | tags −fragrant-lilies; short copy; included / on request split |  |
| `luxe-lily-bloom` | live | Premium lily arrangement | tags −fragrant-lilies; included / on request split | Q5, Q9 |
| `stargazer-affair` | live | Stargazer lily arrangement | tags −fragrant-lilies; included / on request split | Q9 |
| `sunrise-asiatic-vase` | live | Asiatic lily vase arrangement | tags −fragrant-lilies −yellow-flowers; included / on request split | Q6 |
| `daily-pooja-flowers` | live | Loose pooja flowers | included (process lines out) |  |
| `jasmine-malli` | unpublished | Loose jasmine (malli) | included (process lines out) | Q7 |
| `pooja-flower-box` | unpublished | Assorted pooja flowers in a box | included (process lines out) |  |
| `temple-bulk-flowers` | unpublished | Bulk flowers for temples and events | included (process lines out) |  |
| `diy-flowerbox` | live | Loose flowers to arrange yourself | included (process lines out) |  |
| `loose-flower-box` | live | Loose seasonal flowers in a box | included (process lines out) |  |
| `gift-flower-box` | live | Arranged flowers in a gift box | included / on request split |  |
| `pooja-flowerbox` | unpublished | Pooja flowers in a box | included (process lines out) |  |
| `flower-basket` | live | Arranged flowers in a basket | included (process lines out) |  |
| `gift-basket` | live | Flower basket, add-ons optional | tags −add-ons +gifting; included / on request split |  |
| `pooja-basket` | unpublished | Pooja flowers in a basket | included (process lines out) |  |
| `premium-flower-basket` | live | Custom flower basket | tags +custom; included / on request split |  |
| `flowers-under-499` | live | Budget band: flowers under ₹499 | included (process lines out) |  |
| `bouquets-under-999` | live | Budget band: bouquets under ₹999 | included (process lines out) |  |
| `flower-gifts-under-1499` | live | Budget band: gifts under ₹1499 | short copy; badge; included / on request split |  |
| `todays-flower-offers` | live | Offers from today's flowers | included (process lines out) |  |
| `chocolates-addon` | live | Add-on: chocolates | tags −hampers; included (process lines out) |  |
| `candle-diffuser-addon` | live | Add-on: candle or diffuser | tags −hampers +gifting; included (process lines out) |  |
| `premium-card-addon` | live | Add-on: greeting card | tags −hampers; included (process lines out) |  |
| `table-decor-addon` | live | Add-on: event table decor | tags +custom; included (process lines out) |  |
| `daily-pooja-flower-subscription` | unpublished | Plan: regular pooja flowers | included (process lines out) |  |
| `weekly-flowerbox-subscription` | live | Plan: a flower box every week | included (process lines out) | Q10 |
| `jasmine-malli-subscription` | live | Plan: regular jasmine / malli | included (process lines out) | Q7 |
| `custom-flower-subscription` | live | Plan: flowers on your schedule | included (process lines out) |  |
| `dried-flower-bunch` | live | Dried stems, no water needed | included (process lines out) |  |
| `dried-flower-vase-set` | live | Dried flower arrangement, made to order | tags +custom; short copy; long copy; included / agreed in quote | Q3 |
| `mini-succulent-gift` | live | Live mini succulent | long copy; included / agreed in quote | Q4 |
| `plant-and-flower-hamper` | live | Flowers with a small plant | included / on request split |  |
| `clear-glass-vase` | live | Clear glass vase | included (process lines out) |  |
| `premium-decor-vase` | live | Decor vase, quoted by type | included / on request split |  |
| `florist-cutter` | live | Stem cutter for home arranging | included (process lines out) |  |
| `flower-food-sachets` | live | Flower food for vase water | included (process lines out) |  |
| `pet-friendly-flowerbox` | live | Flower box for a home with pets | tags −home-decor; name; included / on request split |  |
| `fresh-flower-toran` | live | Fresh toran, made to length | included (process lines out) |  |
| `jasmine-gajra` | unpublished | Jasmine gajra for hair | included (process lines out) | Q7 |
| `room-mist-flower-gift-addon` | live | Add-on: room mist or diffuser | tags −hampers +gifting; included (process lines out) |  |
| `flower-chocolate-hamper` | live | Flowers with chocolates | tags −add-ons −bouquets +gifting; ratingLabel; included / on request split |  |
| `housewarming-flower-hamper` | live | Flowers, with optional extras | tags −room-mist-diffuser −plants-succulents +housewarming; included / on request split |  |
| `bridal-flower-accessories` | live | Gajra, poola jada and hair florals | tags +custom; included (process lines out) |  |
| `event-garlands` | live | Event garlands, priced on the day | included / on request split |  |
| `roses-by-stem` | live | Rose stems, sold by the stem | included (process lines out) |  |
| `lilies-by-stem` | live | Lily stems, sold by the stem | included (process lines out) |  |

## Correction, 16 Nov 2026 (second commit)

Second pass on the same branch, on top of `f0f4b7c`. Labels: **source** (read in code or data), **rendered** (read from built HTML or in Chrome), **database** (run against a disposable PostgreSQL 16 database). Every result below was produced in this pass; none is carried over.

| Target | Before (`f0f4b7c`) | After | Verified |
|---|---|---|---|
| `mini-succulent-gift` | Included: "Basic pot or planter (style depends on availability)" | Included: the plant and gift packing. A separate "Agreed in your quote" list: "Whether a pot or planter is included, and how the plant is presented". The long copy and every WhatsApp draft say the same | rendered, desktop + mobile; drafts decoded |
| `dried-flower-vase-set` | On request: "Vase, depending on availability"; short copy "…with a vase option"; price note "…any vase you choose" | Neither list holds the vase. "Agreed in your quote: Whether a vase is included"; the short and long copy say the vase is agreed in the quote; the drafts ask about it | rendered (code parts both builds; copy after apply, see below) |
| `/categories/tuberose-rajnigandha` | "Tuberose (rajnigandha) is not listed online" | "Loose tuberose (rajnigandha) flowers are not listed online…", then a link to `/categories/garlands/tuberose` whenever that collection is built (the same condition the garland route uses) | rendered: link and built target with listed tuberose garlands (build B); no link and no target without (build A) |
| Fragrant Lilies (`/categories/fragrant-lilies`, URL kept) | "Fragrant Lilies", 12 designs by tag, intro about scent | "Oriental & Stargazer Lilies": the 4 public designs whose flowers are recorded as oriental or stargazer lilies (Lily Calm, White Silence, Pink Lily Wish, Stargazer Affair). The intro says scent varies and is not promised; the tag is removed from every record; the menu label matches | source + rendered |
| `all-white-fragrance` | Badge "Fragrant lilies" | Badge "White lilies"; the name is kept | source + rendered |
| `sunrise-asiatic-vase` | In Yellow Flowers | Removed; the Yellow intro no longer mentions "sunrise tones" (Yellow lists 5) | source + rendered |
| Stationery / DIY Kits / Jasmine | Title and H1 "Stationery", "DIY Kits", "Jasmine (Malli)" | "Greeting Card Add-ons & Stationery", "DIY Flower Arranging Boxes" (also `/categories/diy`; canonical unchanged), "Recurring Jasmine (Malli / Mallige) Delivery"; menu labels "Greeting Cards", "DIY Flower Boxes" | rendered |
| All Decor intro | "Decor that lasts beyond fresh flowers: …" | Opens with the products and how to choose; exclusions last; no longevity claim | rendered |
| DIY intro | "Not a kit with tools: …" | Opens with the DIY flower box and who it suits; "Tools are not included" last | rendered |
| Bouquet guide | "…oriental lilies… usually strongly scented… see fragrant lilies" | Scent varies; link text "oriental and stargazer lilies" | source |

**Title, H1 and intro precedence** (source + rendered): `CATEGORY_LANDING` (bouquets, all-flowers, pooja-flowers, subscriptions) → `CATEGORY_META` (flowerbox, sunflower, bride; titles and descriptions only) → `CATEGORY_NAMES` / `CATEGORY_INTROS` (`src/data/categoryPages.ts`). None of the corrected pages has a landing or meta entry, so the names and intros above are what render. All Flowers, Pooja Flowers and Subscriptions had intros that were never rendered (their landing copy wins); these unused drafts are removed, and a test now rejects an intro beside landing copy.

**Open containers:** the record's new `toConfirm` field is kept out of both "What's included" and "On request". So is any admin record phrased "vase/pot/box/basket … depending on availability". Both are shown as "Agreed in your quote" and asked about in every WhatsApp draft (product page, product card, enquiry form). A vase that is the product itself ("Clear glass vase (size depends on availability)") stays included.

**Kept on purpose:** the names "All White Fragrance" and "Fragrance Festive Giftbox" (creative names). The name "Dried Flower Vase Set" is also kept, since the product name is the owner's to change. It still suggests a vase, so it stays tied to Q3; the page copy says the vase is agreed in the quote.

**Empty categories:** no new empty page. Oriental & Stargazer Lilies goes from 12 to 4 designs and Yellow from 6 to 5; All Decor 5 and Custom 5 are unchanged; Tuberose stays empty and noindexed, as before.

### Applying the dashboard copy

`docs/offer-clarity-2026-11-16.sql` is removed. Its statements were guarded one at a time, so a batch could partly apply around a newer admin edit, and it kept no record of what it changed. It is replaced by `scripts/content/apply-copy-changes.mjs` (no migration framework; uses the existing `pg` dependency) and the reviewed manifest `docs/offer-clarity-2026-11-16.changes.json`.

**Recount:** the old `.sql` had 22 statements across 16 products. The manifest has 24 fields across 17 products: the same 22, plus the long descriptions of the dried vase set and the succulent changed in this pass. An independent diff of `30b2ccd` against the current catalogue gives exactly these 24 fields. A test now fails if the manifest and the catalogue drift apart.

1. `node scripts/content/apply-copy-changes.mjs plan --manifest docs/offer-clarity-2026-11-16.changes.json --database-url <url>`: read-only. Classifies each field as expected-old, already-new, conflicting or missing, with field and product counts, and exits 2 on any conflicting or missing field.
2. `… apply --manifest … --database-url <url> --receipt <new file>`: one transaction.
   - Locks the rows (`FOR UPDATE`, 10 s lock timeout) and classifies them again.
   - Aborts the whole batch on any conflicting or missing field.
   - Writes only the expected-old fields, each guarded by its old value, and reads every field back.
   - Writes the receipt (`<file>.pending`) before COMMIT and renames it after. The receipt lists only the fields this run changed, with their actual before-values; already-new fields are no-ops and are left out.
3. `… rollback --receipt <file> --database-url <url>`: the same locking and checks, restoring only the receipt's fields, and only while each still holds the value this run wrote.
4. Publish (a build).

Admin editing is unchanged: nothing was added to `DELIBERATE_CATALOGUE_COPY`, and the URL is never read from the environment.

**Until step 2 runs on production,** Cloudflare builds show the dashboard's pre-release copy for these 17 products. Build A showed what that means: the dried vase set's description still says "Dried flower arrangement with vase for premium decor", while its "Agreed in your quote" list already says the vase is to be agreed. Apply the copy in the same release as this code.

### Checks for this correction (16 Nov 2026, this pass)

| Check | Result | Label |
|---|---|---|
| Node tests, `scripts/audit/*.test.mjs` + `scripts/*.test.mjs` | 186 tests: 185 pass, 0 fail, 1 skipped (the database case, which needs `FP_COPY_TEST_DATABASE_URL`) | source |
| `copy-changes.test.mjs` + `content-offer.test.mjs` with a disposable database | 13/13 pass. The database case covers: clean apply (24 fields), rerun (24 already-new, nothing written, empty receipt), rollback blocked by a newer edit, clean rollback, an already-new field never rolled back, conflict abort, missing-record abort | database |
| Lock | While apply held its locks, a concurrent admin-style save on `daisy-morning` waited and hit its 1.5 s statement timeout. The data was left unchanged (apply deliberately stopped before COMMIT) | database |
| CLI on a production-like fixture (dashboard copy at `30b2ccd` values) | plan: 24 expected-old / 17 products. apply: 24 changed, receipt with 24 entries. plan again: 24 already-new. apply again: 0 changed. rollback after an admin edit to `lily-calm`: exit 2, conflicting 1 field / 1 product, nothing restored, the edit kept | database |
| `astro check`, fixture copy moved outside the project | 390 files: 0 errors, 0 warnings | source |
| Build A: Cloudflare target, dashboard records written by the build's own step (`scripts/build/dashboard-catalogue.mjs`), pre-release copy | pass, 313 prerendered pages, security-header check pass. Dashboard copy wins on daisy-morning, all-white-fragrance, dried vase set and pet flower box | rendered |
| Build B: after apply, with 3 tuberose garlands listed in the fixture | pass, 317 pages, security-header check pass. New copy on those products. Code-controlled lists, names, H1s and intros identical to A; `/categories/garlands/tuberose` built and linked | rendered |
| Built HTML B vs `f0f4b7c` build | sitemap 212 = 212; no canonical changes; no unresolved internal links; title changes are only the 5 intended ones (plus the garlands page, from the fixture's listed garlands) | rendered |
| Chrome 1366 and 390 (build B) | 17 pages (7 product, 9 category, 1 guide): 200, no horizontal overflow, no script errors. Drafts decoded without opening WhatsApp: the dried set and succulent drafts carry the quote question, the product card for the dried set too, Asiatic keeps its capital, the jasmine plan asks for quantity | rendered (sampled, not exhaustive) |
| Production | not run: no production data, preview or deploy was touched | unavailable |

## Release, 16 Nov 2026

### Release commit: safety fixes (on top of `fbe9786`)

| Area | Defect found in `fbe9786` | Now |
|---|---|---|
| Receipts (`scripts/content/apply-copy-changes.mjs`) | Only the final receipt was checked; `.pending` was written non-exclusively, so a rerun after "committed, not renamed" could replace the before-values with an empty receipt | apply refuses to start if `<receipt>` or `<receipt>.pending` exists (exit 65); `.pending` is created exclusively (`wx`) before COMMIT; a failed rename after COMMIT exits 3 and keeps `.pending`. New `reconcile` reads the records: every field holds the written copy → committed, `.pending` becomes the receipt; every field holds its before-value → not committed, kept as `.uncommitted`; anything else → left in place, exit 2 |
| Rollback | Matched rows by slug only: a replacement record with the same slug passed | Matched by the receipt's product id and slug; a missing id, a different slug on that id (replacement) or any newer edit aborts the whole rollback; only the receipt's changed fields are touched |
| Production connection | `rejectUnauthorized: true` without the Supabase CA | The application's pinned Supabase CA with full verification (`src/server/db/postgres/ssl.mjs`) |
| Supply (`src/data/productSupply.ts`) | Any vase/pot/box/basket item phrased "… depending on availability" was moved out of "included" or "on request", overriding the record's explicit status | A record's explicit included / on-request status is kept; only its `toConfirm` field puts an item with the quote. The succulent pot and the dried-arrangement vase stay in `toConfirm` (no verified fact resolves them) |
| Manifest check (`scripts/audit/copy-changes.test.mjs`) | Checked "new" against the catalogue in one direction only, with a fixed count; needed git history for the base | `docs/offer-clarity-2026-11-16.baseline.json` (dashboard-controlled copy of all 89 products at `30b2ccd`) is diffed against the current catalogue in both directions: omitted and extra fields, and every old and new value. The baseline itself is checked against `30b2ccd` whenever that commit is in the checkout, and the check is skipped with a reason in a shallow one |
| Production database access | None in the repository: the production `DATABASE_URL` exists only as an Actions secret | `.github/workflows/content-copy.yml`: dispatch-only; plan / apply / reconcile / rollback of a reviewed manifest; writes need a typed confirmation; receipts kept as artifacts (90 days) and printed in the log |

No customer-visible change in this commit: memberships, identities, the oriental/stargazer lily grouping, Sunrise's removal from Yellow, headings and intros are as in `fbe9786`.

### Local checks (this pass; disposable PostgreSQL 16)

| Check | Result |
|---|---|
| Node tests, all suites, without a database | 187 tests: 186 pass, 0 fail, 1 skipped (database case) |
| Same, with `FP_COPY_TEST_DATABASE_URL` | 187/187 pass |
| Database case | clean apply (24), rerun (24 already-new, empty receipt), rollback blocked by a newer edit, clean rollback, already-new field never rolled back, conflict abort, missing-record abort, replacement record refused by rollback, interrupted receipt through the CLI (committed → rerun refused with the pending file untouched → reconcile finalises it → rollback restores), not-committed pending → `.uncommitted`, clean CLI apply |
| Manifest check, mutated | omitted field, wrong "old" value, extra field: each fails; shallow checkout (no base commit): manifest check passes from the baseline file, authenticity check skipped with its reason |
| `astro check` (fixture copy outside the project) | 390 files: 0 errors, 0 warnings |
| Cloudflare builds with the build's own dashboard-records step, one fixture state for both revisions (82 of 89 public; dashboard copy at `30b2ccd` values; garlands public, none tuberose-listed) | `30b2ccd`: pass, 313 pages. Release: pass, 313 pages. Dashboard-controlled descriptions identical in both (the dashboard wins); code-controlled lists, names, H1s and intros differ as intended |
| Same release after applying the manifest to the fixture with the CLI | plan 24 expected-old / 17 → apply 24 changed → plan 24 already-new. Build pass, 313 pages; only the dashboard-controlled descriptions change |
| Release vs `30b2ccd` built HTML | same 314 files; no canonical change; robots change only on `/categories/mini-bouquets` (empty → noindex, existing rule); sitemap 213 → 212 (that URL); no unresolved internal link |
| Populated tuberose garlands (separate fixture state: 3 tuberose designs listed) | pass, 317 pages; `/categories/garlands/tuberose` built and linked from `/categories/tuberose-rajnigandha`; without them, neither |
| Chrome 1366 and 390, release with copy applied | 18 pages (8 product, 9 category, 1 guide): 200, no horizontal overflow, no script errors. Drafts decoded without sending: dried set and succulent ask the quote question (product page and card); Cloud Nine Blue names "blue gypsophila bouquet"; Roses by Stem asks "Quantity needed" |
