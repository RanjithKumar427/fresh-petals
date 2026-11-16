# Offer clarity, 16 November 2026

Content, data and template corrections so a customer can tell what a design is, what is supplied, how it is priced and which collection fits, before sending a WhatsApp enquiry. Branch `content/offer-clarity-2026-11`, on top of `30b2ccd`.

- **Status:** local commit only. Not pushed, deployed or applied to the database.
- **Remaining application step:** after approval, run `docs/offer-clarity-2026-11-16.sql` against production (22 guarded updates), then publish. Until it runs, Cloudflare builds keep the dashboard's names and short/long descriptions for those 16 products (`src/data/dashboardCatalogue.ts`); every other change here is code-only and appears with the next build.
- **Reference gap:** the caption audit, URL register and competitor research named in the brief were not attached; only the brief was. Findings were rechecked against this repository and the live site (16 Nov: sitemap 82 products, 55 categories, 58 city pages; Sweet Petal Hour, Violet Picnic, Florist Cutter and All Decor pages read live).
- **Not changed:** URLs, slugs, design codes, garland records, canonicals, migrations, dependencies, checkout, Supabase settings.

## What changed, by priority

1. **Contradictions and scope** (`src/data/productCatalog.ts`, `src/data/categoryPages.ts`, `src/components/MegaNav.astro`)
   - Red Flowers: white (Love at First Sight) and peach (Midnight Romance, Rose Promise) designs removed; Rose Promise moved to Pastel, Love at First Sight to White.
   - Yellow Flowers: orange and coral lilies removed (still under Lilies).
   - Fragrant Lilies: the Asiatic vase design removed; the intro explains scent varies by lily variety.
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
| `/categories/all-decor` | Explore flower decor, torans, lights, diyas … | Decor that lasts beyond fresh flowers … Torans, lights and diyas are not part of this range |
| `/categories/diy-kits` | DIY floral kits and creative gifting options available on request. | Not a kit with tools: the DIY flower box is loose fresh flowers … |
| WhatsApp draft, Roses by Stem | I want to order Roses by Stem (Market price today). Quantity: 1 | I want to order Roses by Stem (rose stems, sold by the stem). Price: Market price today. Quantity needed: |

## Checks (16 Nov 2026)

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
- **Q3** Dried Flower Vase Set: is a vase always included? The name says set; the record says "vase option".
- **Q4** Mini Succulent Gift: is the pot included in the price, or an option?
- **Q5** Lily variety (oriental or Asiatic) for designs recorded only as "lilies", "orange", "coral", "premium" or "blush" lilies: decides Fragrant Lilies membership.
- **Q6** Sunrise Asiatic Vase: which colour are "sunrise tones"? Decides Yellow Flowers.
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
| `lily-calm` | live | White oriental lily bouquet | short copy; included / on request split |  |
| `little-lilly-prayer` | live | Lily & stock bouquet | template only |  |
| `love-at-first-sight` | live | Lily & rose bouquet | tags −red-flowers +white-flowers |  |
| `midnight-romance` | live | Rose & carnation bouquet | tags −red-flowers |  |
| `peach-petal-promise` | live | Peach & white rose bouquet | template only |  |
| `pink-lily-wish` | live | Pink oriental lily bouquet | template only |  |
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
| `all-white-fragrance` | live | White lily bouquet | short copy; long copy; included / on request split | Q5 |
| `fragrance-festive-giftbox` | live | Lily flower box | short copy; long copy; included / on request split | Q5 |
| `mandarin-lily-glow` | live | Orange lily arrangement | tags −yellow-flowers; included / on request split | Q5, Q9 |
| `pink-serenity-flowerbox` | live | Pink lily flower box | included / on request split |  |
| `blush-lily-letter` | live | Blush lily bouquet | short copy; included / on request split |  |
| `coral-lily-bloom` | live | Coral lily bouquet | tags −yellow-flowers; short copy; included / on request split | Q5 |
| `ivory-lily-grace` | live | Ivory lily bouquet | short copy; included / on request split |  |
| `luxe-lily-bloom` | live | Premium lily arrangement | included / on request split | Q5, Q9 |
| `stargazer-affair` | live | Stargazer lily arrangement | included / on request split | Q9 |
| `sunrise-asiatic-vase` | live | Asiatic lily vase arrangement | tags −fragrant-lilies; included / on request split | Q6 |
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
| `jasmine-malli-subscription` | live | Plan: regular jasmine (malli) | included (process lines out) | Q7 |
| `custom-flower-subscription` | live | Plan: flowers on your schedule | included (process lines out) |  |
| `dried-flower-bunch` | live | Dried stems, no water needed | included (process lines out) |  |
| `dried-flower-vase-set` | live | Dried flower arrangement, made to order | tags +custom; short copy; included / on request split | Q3 |
| `mini-succulent-gift` | live | Live mini succulent | included (process lines out) | Q4 |
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

