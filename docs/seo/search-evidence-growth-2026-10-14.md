# Search evidence and growth release, 14 October 2026

The release makes three primary destinations more useful and more accurate for flower searches: `/locations/bengaluru`, `/categories/all-flowers` and `/categories/garlands`, with its wedding garland guide.

- **Status:** local commit and preview only. Nothing is pushed, merged or deployed.
- **Ranking:** no ranking or impression change is claimed.
- **Search data:** the only data so far is the one-day snapshot in `discovery-baseline-2026-10-14.md`. That file and the raw exports outside the repository are unchanged.
- **Base:** `origin/main` at `1df9792`, with the city-catalogue release live.
- **Branch:** `seo/search-evidence-growth`.

## 1. Gaps, evidence and changes

| Gap | Evidence | Change | Acceptance check |
|---|---|---|---|
| Bengaluru intro said "Bengaluru … is where this website began" | The origin is unconfirmed: `release-3-evidence-and-content-briefs.md` item 8 says About says Bengaluru while Instagram and `/reviews` say Hyderabad. Release 3 removed the same claim from About. | Replaced with neutral service wording. No other origin was substituted. | Rendered page has no "began", "founded" or origin wording (test and release check) |
| Bengaluru sections showed 1 example per group with no route to the complete range in Bengaluru, and no task-specific quote list | Live page: section links went to national collections; examples were unlabelled | Three tasks: sending a bouquet as a gift, choosing wedding garlands, pooja flowers (loose, strung or basket).<br>Each task has its examples labelled "Examples, not the full range", links to its **complete** collections in the Bengaluru shop view with live counts, and a "For a quote, send us" list.<br>Garland examples are the six pilot designs. The bouquet examples now include a vase arrangement. | 7 complete-collection links with counts equal to the shop view: featured bouquets 8, all flowers 51, garlands 156, rose 78, lotus 30, tuberose 24, pooja 11 |
| A 50-chip collection list came before the advice on authored city pages | Live layout | On the 15 authored hubs, the advice sections now come before the full catalogue. The 44 catalogue roots have no advice sections, so they are unchanged. All collections are still linked in server-rendered HTML. | Root checks 10/10; catalogue checks 59/59 |
| All Flowers grouped products but did not compare presentation | Live page | A comparison of wrapped bouquet, vase arrangement, and box or basket, computed from the records of each group.<br>Each card shows what the designs come in, care instructions recorded on at least half of them, what each presentation suits, and two linked examples.<br>Other presentations recorded on some designs are noted separately (for example, some wrapped designs record a wicker basket).<br>It also links the quote explanation, occasion pages, the bouquet guide and the city directory, and states that this is the national catalogue with Bengaluru as an example city page. | Same 51 products and identical price labels as the live page; no stem count, size, pet, fragrance or guarantee claim |
| Garland guide stated some looks as facts ("a white jasmine garland", "tuberose garlands are the dense white ones") | A browsing group and a photograph are not a recipe (`garlandCollections.ts` copy rules) | Sentences now say what the photographs show ("in the photographs…", "looks like jasmine"). Example captions are labelled "Photograph:". | Guide check passes; no recipe, size, stem, sample or preparation-time claim |
| The garland facts list showed seven "To be confirmed" rows with no structure | Live pages for FP-G001, G034, G106, G035, G086 and G085: every specification is empty | Shared `garlandEvidence()` builds the same blocks on every garland page and in the guide:<br>- "On record": code, browsing group labelled "sorted from the photograph, not a list of flowers", and any specification the admin has recorded<br>- "In the photograph"<br>- "Confirmed for your order on WhatsApp": each empty specification, plus price and delivery | Pilot and other garland pages carry both blocks and no amount |
| No fact-by-fact pilot | — | Guide section "Six designs, fact by fact" (`#six-designs`): FP-G001, FP-G034 (rose), FP-G106, FP-G035 (lotus), FP-G086, FP-G085 (tuberose). All six were already guide examples.<br>Links run both ways: guide ↔ pilot pages ↔ rose, lotus and tuberose collections ↔ garland hub ↔ Bengaluru. | 6 cards, a shared confirmation list, quote links and collection links |
| Garland draft asked "Options: none chosen — please advise", a blank "Occasion", "Date (optional)" and quantity without a unit | `garlandEnquiry.ts` | The draft now contains the design code and title, link, recipient city, "Quantity: 1 (one garland or a pair?)", chosen options only, ceremony date, colours, length or changes, delivery area, then "Please confirm the final flowers, length and delivery for this date" and the fixed price closing.<br>Still no pincode. With a recorded unit, the count states it ("2 pairs") and the question is dropped. | Bengaluru and Kochi drafts captured; no amount |
| Hub chip said "157 options" | 156 coded designs plus the Event Garlands catalogue product | "156 coded designs + Event Garlands", computed from both sources | Hub check |

Not changed:
- metadata, canonicals, robots, breadcrumbs or structured data;
- the sitemap (only lastmod for Bengaluru and the guide moved to 14 Oct);
- the hero, palette and occasion carousel;
- garland publication rules;
- quote-only behaviour and prices;
- cart and destination confirmation;
- GA4 and cache tags. The Bengaluru page still sends `garlands,occasion-index`; it uses no occasion source.

## 2. Market observations

The search tool queries a US-based index and returns summaries, not ranked SERPs. These observations inform intent and page structure only and cannot establish Bengaluru rankings. No keyword-tool units were bought and no volumes are stated. Engine: the session's WebSearch tool (US results), run 14 Oct 2026 at about 14:00 IST.

| Query | What came back | Use here |
|---|---|---|
| flower bouquets delivery Bengaluru | Gift-site category pages and FAQs with price ranges, same-day claims and cake add-ons ([giftstoindia24x7](https://www.giftstoindia24x7.com/a/flowers-to-bangalore-category-matter)); marketplace listings | Competitors lead with speed and price. We do neither, so the page leads with how to choose and what a quote needs. |
| flowers online Bangalore | An LBB roundup of eight online florists, none offering garlands or pooja flowers ([LBB](https://lbb.in/bangalore/online-flower-delivery-services)) | Garlands and pooja flowers are a distinct offer in this set, so the Bengaluru page covers all three tasks. |
| wedding garlands Bangalore varmala poola mala | Varmala explainers, directory profiles, artificial and bulk garlands; no Bengaluru fresh-garland seller page with designs | Supports design-code pages that explain what is confirmed |
| lotus wedding garland varmala | Explainers on lotus symbolism and trend roundups (closed and upside-down lotus buds) ([Tamarind Tree](https://www.thetamarindtree.in/blog/varmala-ceremony/), [WeddingBazaar](https://www.weddingbazaar.com/blog/trending-jaimalas-for-couples?pgl=cappv)) | Closed versus opened lotus is the distinction people search for, so it leads the lotus comparison |
| pooja flowers jasmine mallige delivery Bengaluru | Marketplace jasmine strings, jasmine price news, little service content | Explains the loose versus strung choice; no price or variety claimed |

No competitor text was copied.

## 3. Three promotion pieces (ready to review; nothing posted)

These reuse briefs 3, 4 and 5 from `release-3-evidence-and-content-briefs.md`. Copy carries no price, delivery time or recipe.

**1. Rose, lotus or tuberose: a visual comparison**
- **Format:** three-frame carousel.
- **Photographs:** the main photograph on each design page: FP-G001 (`/products/classic-red-rose-garland`), FP-G106 (`/products/closed-pink-lotus-garland-with-bud-stem-tassels`) and FP-G086 (`/products/tuberose-garland-with-gold-accents`).
- **Frames:**
  1. "Rose: the most colour. FP-G001."
  2. "Lotus: closed pink buds in a slim line. FP-G106."
  3. "Tuberose: white, with the colour in the bands. FP-G086."
- **Caption:** "Three wedding garlands, three different looks. Start with the main flower in the photograph, then decide one garland or a pair. The flowers, length and price are confirmed for your date before anything is made. Our guide compares six designs fact by fact."
- **Destination:** `https://onlyfreshpetals.in/guides/choosing-wedding-garlands?utm_source=instagram&utm_medium=social&utm_campaign=garland_compare_2026_10&utm_content=rose_lotus_tuberose#six-designs`
- **Audience:** couples and families planning a wedding in Bengaluru and South India.
- **Do not say:** which flowers are inside a garland, or a length.

**2. One design code, explained (FP-G106)**
- **Format:** two-frame post or short reel.
- **Photograph:** FP-G106's main photograph.
- **Frames:**
  1. The photograph with "FP-G106" in the corner.
  2. A text card: "What we know: the code and the photograph. What we confirm with you: the flowers, the length, one or a pair, the price and delivery."
- **Caption:** "Every garland has a code. Send us FP-G106, your ceremony date and whether you need one garland or a pair, and we reply with what we can make for that day."
- **Destination:** `https://onlyfreshpetals.in/products/closed-pink-lotus-garland-with-bud-stem-tassels?utm_source=instagram&utm_medium=social&utm_campaign=design_code_2026_10&utm_content=fp_g106`
- **Audience:** couples who have shortlisted a lotus look.

**3. Loose jasmine or gajra**
- **Format:** two frames. Frame 2 is text only, because gajra and loose jasmine still share `/images/jasmine.jpg` (owner evidence item 1). Do not show a gajra frame using that photograph.
- **Frames:**
  1. `/images/jasmine.jpg`: "Loose jasmine (mallige): to offer, or to string yourself."
  2. Brand-colour text card: "Gajra: already strung, ready to wear or offer."
- **Caption:** "The same flower in two forms. Tell us which you need, and roughly how much, for your date; jasmine is priced on the day's market."
- **Destination:** `https://onlyfreshpetals.in/categories/pooja-flowers?utm_source=instagram&utm_medium=social&utm_campaign=jasmine_gajra_2026_10&utm_content=loose_vs_strung#strings`
- **Audience:** households in Bengaluru buying for daily pooja and festivals.
- **Do not say:** a variety, origin, weight or length.

## 4. Six Bengaluru prospects (not partners; nothing sent)

Each was checked on its own public page on 14 Oct 2026. No private contacts were collected and no link was bought or promised. Two prospects are excluded:
- Four Seasons Bengaluru: its weddings page returned 403.
- WeddingSutra: its pages timed out.

| Prospect | Verified page | Relevance | Collaboration idea | Draft (owner to send, if at all) |
|---|---|---|---|---|
| The Tamarind Tree (venue and wedding blog) | https://www.thetamarindtree.in/blog/varmala-ceremony/ | A Kanakapura Road venue that publishes couple guides, including one on the varmala | Offer garland photographs with design codes, and the confirm-before-ordering checklist, as a resource for their varmala guide, credited | "Hello, we make fresh wedding garlands to order and read your varmala guide. If useful, we can share photographs of rose, lotus and tuberose designs with their codes, and a short list of what couples should confirm with any florist (one or a pair, length, flowers for the date). Happy to send them for you to use with a credit." |
| The Tales of Tradition (planners at The Tamarind Tree) | https://www.thetamarindtree.in/blog/south-indian-wedding-planners-bengaluru/ | Bengaluru planner for South Indian weddings, listed by the venue | When one of their couples chooses fresh garlands, quote by design code and supply photographs for their mood boards | "Hello, we take orders for fresh wedding garlands in Bengaluru, each with a design code and photograph. If your couples are choosing a varmala, we can quote by code for their date. Would a short design sheet be useful to you?" |
| ISKCON Bangalore Kalyana Mantapa | https://www.iskconbangalore.org/kalyana-mantapa/ | Rajajinagar wedding halls hosting marriages and samskaras. The page mentions no decoration or flowers. | Ask whether they keep a list of garland suppliers for families; offer ceremony and pooja flower details | "Namaste, families booking your halls sometimes need fresh garlands and pooja flowers. We take orders in Bengaluru and confirm flowers and price for the date on WhatsApp. If you share supplier details with families, could we be considered?" |
| Vivek Krishnan Photography | https://www.vivekkrishnan.com/ | Wedding photographers covering Bangalore, Chennai and Hyderabad, with a blog | If a featured wedding used our garlands, a credit to the design page; we credit their photograph in return | "Hello, if any of your couples wear our garlands, we would be glad to credit your photographs on the design's page, with your permission, and to ask for a credit naming the garland. No obligation." |
| House On The Clouds | https://www.houseontheclouds.com/ | Wedding photography and films, Mumbai and Bangalore, with couple stories | The same credit exchange, only for a wedding that actually used Fresh Petals garlands | "Hello, we make fresh wedding garlands to order. If a wedding you shoot uses one of ours, we would love to credit your work on the design page with permission, and ask that the garland be credited in your story." |
| LBB Bangalore | https://lbb.in/bangalore/online-flower-delivery-services | A local publication; its online-florist roundup lists no garland or pooja-flower service | Suggest a factual addition: fresh wedding garlands by design code and pooja flowers | "Hello, your roundup of online florists in Bangalore has no service for wedding garlands or pooja flowers. We take orders for both: garlands chosen by design code, and loose jasmine, gajra and pooja baskets, with price confirmed for the date. Sharing in case it is useful for an update." |

## 5. Owner evidence checklist (five)

1. **A separate photograph of a finished gajra.** Pages: `/products/jasmine-gajra`, `/categories/pooja-flowers#strings` and promotion piece 3.
2. **For the six pilot designs:** one garland or a pair as sold, length, and flowers used, recorded in the admin. Pages: the six product pages and `/guides/choosing-wedding-garlands#six-designs`. Each entry replaces a "Confirmed for your order" line automatically.
3. **One genuine completed-order photograph or quote**, with consent and the order's product and city. Page: `/locations/bengaluru` (nothing is shown until it exists).
4. **Where the business began**, if it should be stated. Pages: `/about` and `/locations/bengaluru` (currently neutral).
5. **Stem count or size name for the eight featured bouquets.** Pages: `/categories/bouquets`, `/categories/all-flowers` and the Bengaluru bouquet task.

## 6. Measurement plan

The source is Google Search Console, Web, India: disclosed non-brand queries, the landing pages shown without the country filter (see the discovery follow-up), and URL Inspection. Withheld queries stay unclassified. Impressions do not show that we outrank FNP or appear in AI answers.

| Query family | Destination | Change | Expected mechanism | Later verification |
|---|---|---|---|---|
| flowers in Bengaluru / Bangalore, flower delivery Bangalore | `/locations/bengaluru` | Task sections, complete-collection links, no origin claim | Clearer relevance for the city plus task terms, and internal links into complete collections | Indexed with a self-canonical; disclosed queries matching `bengaluru\|bangalore` landing on this page, from 7 complete days after indexing |
| flower bouquets Bengaluru, bouquet delivery | `/locations/bengaluru#bouquets`, `/categories/all-flowers` | Gift task; presentation comparison | More answerable content for "which bouquet, wrapped or vase" | Impressions for `bouquet` queries by page; All Flowers indexed (it was "Discovered" on 14 Oct) |
| wedding garlands, varmala, poola mala, jaimala | `/categories/garlands`, the guide | Pilot section; evidence blocks; corrected totals | Distinct, factual pages per design and a guide that answers selection questions | Hub and guide indexed; impressions for `garland\|mala\|varmala\|jaimala` by page |
| lotus / rose / tuberose garland | `/categories/garlands/<flower>`, pilot products | Pilot links both ways | Collection and product pages are discovered through the guide and the hub | Lotus collection indexed (requested 14 Oct); impressions on the pilot product URLs |
| pooja flowers, jasmine / mallige, gajra (Bengaluru) | `/categories/pooja-flowers`, `/locations/bengaluru#pooja` | Loose, strung or basket task; complete pooja link | The homepage currently takes these searches (11 Oct snapshot); a dedicated task may shift them | Landing page for `pooja\|puja\|jasmine\|malli\|gajra` queries moves off `/` |

## 7. Verification (local preview of the production build, write-blocked)

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 42 of 42 (1 new) |
| Release checks (`sg-check`, 32) | PASS, 32 of 32 |
| City roots (`rt-check`) | PASS, 10 of 10 |
| City catalogue (`cc-check`) | PASS, 59 of 59 |
| Type check | 20 errors, all pre-existing, none new |

The 20 pre-existing type errors are in files this release does not touch:
- `SubscriptionConfigurator.astro`: 15 (TS2339 `dataset`/`value` on `Element` at lines 362–507; TS7006 `selector` at 355 and 360);
- `DiscoveryPostCard.astro`: 4 (TS7006 `tag`/`index` at 158, 194, 276 ×2);
- `MobileBottomBar.astro`: 1 (TS2339 `offsetWidth` at 160).

The 32 release checks cover:
- **Metadata:** one H1, self-canonical and indexable on Bengaluru, All Flowers, the garland hub and the guide.
- **Bengaluru:** task order, complete-collection counts, quote lists and labels, pilot examples, a vase example, no neighbourhood/store/testimonial/delivery-time claim, and every collection still linked.
- **All Flowers:** the same products and price labels as live, plus the comparison content and links.
- **Garlands:** hub total and 156 cards; guide pilot and captions; rose, lotus and tuberose collection pilot links; pilot and other product pages.
- **Drafts:** a captured garland draft from the enquiry check's redirect for Bengaluru and for Kochi; a Bengaluru bouquet draft.
- **Prices and hero:** pooja prices; hero with three slides; no Google tag in the local build.
- **Browser:** the city is kept from Bengaluru to a pilot design.
- **Layout:** no broken images or overflow at 390, 768 and 1440 px.

Screenshots read by eye (in `C:\Users\ranji\Downloads\fresh-petals-preview-2026-10-13\search-evidence-growth`):
- Bengaluru: top, bouquet task, garland task and pooja task, at desktop and mobile;
- All Flowers comparison, desktop and mobile;
- garland hub top, mobile;
- guide top (mobile) and pilot section (desktop and mobile);
- FP-G001 (desktop) and FP-G106 (mobile) evidence blocks.

They led to three fixes before the final build:
- "All all flowers" link text;
- a five-column table that scrolled sideways on mobile, now cards;
- the design name repeated in the pilot record.

Not rerun: the earlier basket, search-competitiveness and national-coverage suites. No Search Console, GA4 or indexing action was taken.

## Handoff

Fast-forward `main` to this branch, push `main` alone, wait for Production, then push the branch. Rollback reference: `1df9792`. After deploying, check:
- `/locations/bengaluru`;
- `/categories/all-flowers#presentation-title`;
- `/guides/choosing-wedding-garlands#six-designs`;
- one pilot design page;
- one captured garland draft.
