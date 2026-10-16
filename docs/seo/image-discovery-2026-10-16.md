# Image discovery and photograph accuracy (16 October 2026)

The release adds image entries to the existing sitemaps and makes what each product page shows and says about its photograph accurate. Branch `seo/image-discovery-2026-10-16`, based on `main` at `2755486` (the live search-evidence-growth release).

- **Status:** local commits and a write-blocked preview only. Nothing is pushed, merged or deployed.
- **Outcomes:** none claimed. An image sitemap adds discovery coverage; it does not show an indexing problem when absent, and predicts no ranking, image-search or AI-answer change.
- **Unchanged:** URLs, design codes, prices, quote-only behaviour, publication rules, admin, cities, canonicals, noindex rules, cache tags and analytics events. Two `lastmod` values changed truthfully (section 6). Product records are unchanged apart from the photograph of the 12 products in section 3. The page design is unchanged apart from three additions: a label on representative photographs, the placeholder on those 12 products, and a qualified "What's included" line on three lily designs.

## 1. Baseline (checked 16 October 2026)

| Lead from earlier notes | Current evidence | Verdict |
|---|---|---|
| robots.txt names three sitemaps, 393 page URLs, no images | Live: `sitemap.xml` 221, `sitemap-garlands.xml` 161, `sitemap-occasions.xml` 11. 393 distinct, no duplicates, no image entries. | Confirmed |
| Sitemap URLs are healthy | All 393 fetched: each answers 200, is self-canonical and is indexable (`max-image-preview:large`). | Confirmed; no broken destination |
| URLs Google already showed (11 Oct snapshot) | These answer 200 and are self-canonical: `/categories/wedding`, `/stationery`, `/sunflower`, `/baskets`, `/subscriptions`, `/dried-flowers`, `/bouquets-with-vases`, `/flowerbox`, `/reviews`. `/studio` redirects (301) to `/categories/bouquets`. Trailing-slash forms canonicalise. | No defect |
| Product images reachable | Catalogue files answer 200 `image/webp`; garland photographs on the public storage host answer 200 `image/jpeg`. That host has no robots.txt (404), so nothing blocks crawling. | Confirmed |
| Images use product names as alt text | Name-only alt text on several card types. 51 product pages showed a photograph that is not of the product, with alt text describing the product. | Confirmed defect (section 3) |
| Bouquet collection uses `bouquetPhotoAlt()` | Checked by eye against all 47 bouquet and lily photographs: 44 match their records. Three are photographed in a different presentation from their record (section 4). | Reused; three qualified |
| Interaction-only image loading | Only hero campaign slides 2 and 3 load on interaction, and they are campaign imagery, not products. Every product and garland photograph has its `src` in the HTML. | Left as is |
| Structured data | Garland pages carry an `ImageObject` captioned with the photograph's description. Catalogue product pages carry breadcrumbs only, by design (no fixed offer). | Accurate; unchanged |
| Search Console exports | Only the one-day 11 Oct snapshot (57 impressions, private). There are no 28-day exports, so `scripts/seo/report.mjs` cannot run. | Search-led copy changes **unresolved**; none made |

## 2. URL → evidence → fix

| URL(s) | Evidence | Kind | Fix |
|---|---|---|---|
| 12 product pages with an unrelated photograph (florist cutter, vases, dried flowers, hampers, gift box, premium basket, succulent, room mist, bridal accessories, lilies by stem) | The photograph shows something else, e.g. sunflower jars for a florist cutter, a mixed bouquet with no lilies for lilies by stem | **Defect** | The existing "no image yet" placeholder. The page, price, enquiry and basket are unchanged. |
| 25 product pages with a relevant illustrative photograph | Alt text described the product; the picture shows the kind of flower or item | **Defect** | Alt text and a label on the photograph say it is representative |
| 3 lily designs | The record says wrapping; the photograph shows a vase or a box | **Defect** | Shown qualified everywhere; record unchanged (section 4) |
| Category, occasion, homepage, related-product, city and guide cards | Name-only alt text | Enhancement | One helper, `productPhotoAlt()` |
| 46 catalogue pages whose photograph shows the product | Not in any image sitemap | Enhancement | `<image:image>` in `sitemap.xml` |
| 156 garland pages | Not in any image sitemap | Enhancement | Main photograph and confirmed gallery in the live `sitemap-garlands.xml` |
| Listing, occasion, city and guide pages | They show photographs whose landing page is the product | Not listed | Listed once, under the product |
| Query-to-page priorities | One-day snapshot only | **Unknown** | Unresolved until 28 days of exports exist |

## 3. Photograph review: one verdict per product

`src/data/productPhotos.ts` (`PHOTO_REVIEWS`) records, for each catalogue product, the exact file reviewed, a sha256 prefix of that file's content, and a verdict decided by looking at the photograph.

- **Neither the file name nor sharing decides a verdict.** A new upload or a renamed file is "unreviewed" until someone adds or updates its entry.
- **What protects what (checked 16 October, section 11):**
  - **At runtime** the site matches a review by product and exact path only. It never downloads or hashes an image.
  - **A replaced file at the same path** is caught at build time. `astro build` now fails while any reviewed file's content differs from its recorded hash (`scripts/build/photo-review-check.mjs`, an integration in `astro.config.mjs`). Before this, only the regression test checked hashes, and the build does not run the tests.
  - Catalogue photographs are files in `public/` and change only through a deployment; admin edits do not change them. So no catalogue image can change without that build check.
  - Garland photographs are admin uploads stored under generated names that are never overwritten (`upsert: false`). Their URLs do not change content through the app.
- **Unreviewed photographs:** never listed, and their alt text is the product name only.
- **A shared photograph can still be the product.** Loose jasmine and the loose-jasmine subscription share `/images/jasmine.jpg`, which shows what they sell.

| Verdict | Products | On the page | Image sitemap |
|---|---|---|---|
| **product** | 44 bouquets and lilies (each its own file), Jasmine / Malli, Jasmine / Malli Subscription | Bouquets keep their description alt; jasmine: "white jasmine buds" | Listed (46) |
| **unconfirmed** | Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair | Flowers described, no presentation claimed (section 4) | Not listed until the owner confirms |
| **illustrative** | 25: daily pooja flowers, pooja flower box, temple bulk flowers, DIY flowerbox, loose flower box, pooja flowerbox, flower basket, gift basket, pooja basket, the four offer ranges, candles and diffusers, premium cards, table decor, the three other subscriptions, clear glass vase, fresh flower toran, jasmine gajra, housewarming hamper, event garlands, roses by stem | "<name>: representative photograph of <what it shows>"; label on the photograph: not this exact product | Not listed |
| **unrelated** | 12: gift flower box, premium basket, dried flower bunch, dried flower vase set, mini succulent, plant and flower hamper, premium decor vase, florist cutter, room mist, flower and chocolate hamper, bridal flower accessories, lilies by stem | Existing placeholder ("NO IMAGE YET"); alt "<name>: no photograph yet"; social preview falls back to the site image instead of the SVG | Not listed |
| **missing** (already) | Chocolates, Flower Food Sachets, Pet Friendly Flowerbox | Placeholder, as before; alt as above | Not listed |

Each unrelated product's catalogue entry carries a comment naming the rejected file and what it shows. Jasmine Gajra stays illustrative: loose jasmine buds are never described as gajra. The jasmine guide now labels cards by verdict: gajra and the pooja flowerbox are labelled, loose jasmine is not. It still states which products share a file.

## 4. Unconfirmed presentation: three lily designs

Inventory of every place these designs appear on the built site:
- **Product pages:** "What's included" listed "Premium wrapping" (Mandarin, Stargazer) or "Luxury wrapping" (Luxe), and the title said "Bouquet".
- **Record-derived lines:** `bouquetLine()` and `bouquetPresentation()`, used by city-page examples. City pages could pick one of these as a "wrapped" example.
- **No presentation claim:** WhatsApp drafts, meta description, Open Graph, JSON-LD, card descriptions, and All Flowers (lilies have their own group there).

Now (`presentationCheck()` in `src/data/collectionGuidance.ts`):
- **What's included** reads "Wrapping or vase to be confirmed: the photograph shows a glass vase. Please confirm on WhatsApp how this design will be presented before you order." Stargazer Affair reads "Wrapping or box to be confirmed: the photograph shows a round box, with red roses among the lilies. …". This wording was revised on 16 October: the first version said "Recorded as …", internal record terminology. Neither wording promises wrapping or the container.
- **Record-derived lines:** `bouquetPresentation()` returns nothing for the three. Lines, city examples and photo descriptions therefore claim no wrapping, vase or box.
- **Title:** "Arrangement" instead of "Bouquet". This matches each design's own description ("A bright lily arrangement…").
- **Records:** unchanged. The test asserts the wrapping entry is still there. Nothing is changed to vase or box without the owner.
- **Not changed:** the generic quote-only sentence on lily pages ("We send the price of this bouquet…") and the card link label "View bouquet". Both use bouquet as the category word, not a presentation.

## 5. Before and after

| Where | Before (live) | After |
|---|---|---|
| `/products/florist-cutter` photograph | Sunflower jars; alt "Florist Cutter: Florist cutter add-on for flowerbox and subscription customers" | Placeholder; alt "Florist Cutter: no photograph yet" |
| `/products/jasmine-gajra` | Loose jasmine; alt "Jasmine Gajra: Fresh jasmine gajra based on daily flower availability" | Same photograph; alt "Jasmine Gajra: representative photograph of white jasmine buds", with the label on the photograph |
| `/products/jasmine-malli` | Labelled "shared photograph" in the guide | Not labelled; alt "Jasmine / Malli: white jasmine buds"; listed in the image sitemap |
| `/products/mandarin-lily-glow` | Title "… Bouquet"; "Premium wrapping" | Title "… Arrangement"; qualified line (section 4) |
| All Flowers card, Mandarin Lily Glow | alt "Mandarin Lily Glow" | "Mandarin Lily Glow: orange lilies, lily buds and fresh greenery" |
| `/occasions/birthday` card, Red Affair | alt "Red Affair" | "Red Affair: red roses and fresh rose foliage, in premium white wrapping" |
| `sitemap.xml`, Red Affair | `<url><loc>…/products/red-affair</loc></url>` | adds `<image:image><image:loc>https://onlyfreshpetals.in/images/bouquets/bouquet-red-affair-01.webp</image:loc></image:image>` |
| `sitemap-garlands.xml`, FP-G106 | `<loc>` and `<lastmod>2026-10-12</lastmod>` | adds its stored main photograph (`…/media/products/5706cb4c-….jpg`) |

## 6. Sitemaps (live versus preview, same data)

- **Page URLs:** identical, 393 = 221 + 161 + 11. No URL added, removed or moved between sitemaps.
- **`lastmod`:** two changed, both through the existing `updated` field in `src/data/guides.ts` and fixed in source (not the build time):
  - `/guides/jasmine-pooja-flowers-and-gajra` 2026-10-13 → 2026-10-16. Its card labels and photograph note were rewritten.
  - `/guides` 2026-10-14 → 2026-10-16, the directory's existing rule (latest guide).
- **Pages kept on their dates:** city pages changed only in image alt text. The three lilies are not among the city examples, and the bouquet guide uses the same groups, so their visible content is unchanged. Catalogue product and category pages carry no `lastmod` by design. Garland `lastmod` remains the admin's last save; no database timestamp was written.
- **Images:** 46 in `sitemap.xml` and 156 in `sitemap-garlands.xml`, at most one per product page, none on listing pages. No public design has a gallery photograph today. One file (`/images/jasmine.jpg`) serves two pages. All are absolute and answer 200 as images.
- **Each image matches its page:** comparing all 245 product entries, every listed image is the main photograph its page displays. Every product page without an image is a placeholder, a labelled representative photograph or an unconfirmed lily.
- **XML:** all three files parse in a browser's strict XML parser, with image elements only under `<url>`. The largest file is 48 KB.
- **Garland sitemap:** still rendered on request with the `garlands` cache headers, from the same records as the pages, with no extra query. `sitemap.xml` stays prerendered.
- **Counts are not fixed:** they follow the catalogue, the reviews and garland publication.

## 7. Verification

The preview is a production-style isolated build on `127.0.0.1:4399`. Inquiry and admin routes are refused before the handler, and there is no analytics ID locally. WhatsApp and analytics requests are aborted; drafts are captured, not sent.

| Check | Result |
|---|---|
| Production build | PASS |
| Regression suite | PASS, 43 of 43 (fixture coverage below) |
| Image-discovery browser checks | PASS, 44 of 44 |
| `sg-check` 32, `jr-check` 6, `rt-check` 10 | PASS |
| `cc-check` | 58 of 59 on the 57d3385 build: "photographs load" at 390 px failed, with 1–4 remote garland photographs not loaded within the 6-second wait. That result stands. The follow-up is in section 11: not a regression; an intermittent limitation of the local preview. |
| Sitemap comparison, image-to-page mapping, XML parse | PASS (section 6) |
| Type check | 20 errors, all pre-existing and unchanged: `SubscriptionConfigurator.astro` 15, `DiscoveryPostCard.astro` 4, `MobileBottomBar.astro` 1 |

**What the regression test covers.** It uses controlled fixtures in-process, with no database, network or CDN.

- **Review register:**
  - every reviewed file's hash matches its content;
  - every catalogue photograph in use has a verdict, and none in use is unrelated;
  - the sitemap lists exactly the photographs judged to show the product;
  - an upload named for its product but not reviewed is not listed and claims nothing; a reviewed product moved to another file becomes unreviewed;
  - each unrelated product uses the placeholder.
- **Descriptions:** illustrative and jasmine descriptions are present, and the gajra wording is correct.
- **The three lilies:** the record is unchanged, and the qualified note, line, title and alt text are checked.
- **Live garland sitemap:** rendered through the real loader and publication rules from mocked records:
  - hidden designs and related views are excluded;
  - a changed photograph and then an unpublished design show up when the route renders again;
  - the XML is well-formed;
  - the response carries the same cache headers as the pages.

The test does not exercise the admin-save purge (`refreshGarlandPages`), the CDN or production data, so it does not demonstrate production cache invalidation end to end.

**The 44 browser checks, at 390 and 1440 px:**
- **Without JavaScript:**
  - bouquet, representative, placeholder (florist cutter) and loose-jasmine pages, with images, alt text, labels and links;
  - FP-G106: record alt equals its `ImageObject` caption, and no amount is shown;
  - the birthday occasion, with at most two eager images;
  - Bengaluru, the pooja guide (gajra labelled, loose jasmine not), All Flowers and the homepage;
  - the three lilies: "Arrangement" in the title and the qualified line, with no bare wrapping line.
- **In the browser:**
  - the first described image loads, with no broken image and no horizontal overflow, on eight pages;
  - the representative label is visible on both widths;
  - bouquet, florist cutter and Mandarin enquiries each fire one `whatsapp_enquiry_click` for that product, with no customer fields. Their drafts name the product and link, with no amount and no presentation claim;
  - add to basket keeps the item;
  - the FP-G106 enquiry with Bengaluru chosen carries the code, the city and the canonical link;
  - no analytics tag and no write.

Screenshots were read by eye: `C:\Users\ranji\Downloads\fresh-petals-preview-2026-10-13\image-discovery`. Earlier in this release, the representative label sat below the sticky desktop photograph and was hidden at 1440×900; it was moved onto the photograph.

The local preview server crashed once when the database pooler closed an idle connection. *Correction (section 11):* the unhandled error came from the site's own pool (`pg-pool`'s idle listener in the built function), not from the preview server. It is fixed in the shared connection code.

## 8. Owner inputs (in `owner-checklist.md`)

1. **Photographs of the 12 products now on the placeholder, and of the 25 shown with an illustrative picture.** Each new file needs a review entry in `productPhotos.ts` before it is described as the product or listed. The finished-gajra photograph is already item 1 in `search-evidence-growth-2026-10-14.md` section 5.
2. **Mandarin Lily Glow, Luxe Lily Bloom, Stargazer Affair:** wrapped, as recorded, or in a vase or box, as photographed? Once confirmed, update the record (or the photograph) and remove the design from `PRESENTATION_UNCONFIRMED`; its verdict then becomes "product".
3. **Chocolates, Flower Food Sachets, Pet Friendly Flowerbox:** still no photograph.

## 9. After release (owner, in the accounts; nothing here was done)

See `measurement.md`, "Account checks outstanding". In short:
- check that both changed sitemaps are read again after deployment;
- inspect one bouquet, one representative product and FP-G106;
- look at Performance with Search type: Image, separately from Web.

Resubmitting a sitemap is optional: Google re-reads listed sitemaps.

## 11. Release checks, continued (16 October, evening)

Evidence folder: `C:\Users\ranji\Downloads\fresh-petals-preview-2026-10-13\image-discovery\release-checks-2026-10-16`.

`57d3385` was deployed to production by a separate release step the same evening, which is recorded outside this section. A read-only check at 22:17 IST confirmed the live pages serve it. The changes in this section are local commits after `57d3385`; they are not deployed.

### Photo-review guarantee

| Case | Runtime (path match) | Build | Tested |
|---|---|---|---|
| Product moved to another file | Unreviewed: no verdict, description or sitemap entry | - | Regression test |
| New upload with a product-like name | Unreviewed | - | Regression test |
| Same path, new content | Old verdict kept (no per-request hashing) | **Build fails** naming the file | Fixture test; a real `astro build` with one file swapped failed, and the file was restored (`build-gate-same-path-replacement.log`) |
| Accurate photograph shared by products | Verdict per product: jasmine is "product" for loose jasmine and its subscription, "illustrative" for gajra | Hash checked once per file | Regression test |

**Remaining limitation.** A file replaced on the server after deployment would not be noticed, but catalogue files are immutable per deployment. A garland photograph replaced directly in the storage console, outside the app, would also not be noticed; the app never overwrites one.

### Customer wording for the three lilies

The qualification is rewritten in customer terms (section 4). Records, verdicts, titles and enquiry drafts are unchanged; the drafts still make no presentation claim (browser check).

### City-catalogue photograph check (the 6-second failure)

- **Bounded comparison:** baseline `2755486` and the current code were built and served the same way (isolated builds, same server, same database, same image stand-in). They were checked with the check's exact procedure at 390 px, two runs each, alternating.
- **Pages requested:** `/locations/bengaluru/shop?collection=garlands-lotus`, `/locations/hyderabad/shop`, `/locations/kochi/shop?collection=pooja-flowers`.
- **Results:**
  - Both builds request identical images: 24, 24 and 11.
  - The only remote images are the 24 lotus-garland photographs: 3.1 MB in total, median 135 KB.
  - Nothing failed at 6 seconds on either build (`cc-photo-diag-base-vs-current.jsonl`).
  - A single `cc-check` run on the final build passed 59 of 59.
- **Cause:** these are remote photographs that the local preview serves as originals through its image stand-in, where production serves resized copies. The check scrolls through the page in about a second, so all 24 load requests start together under a fixed 6-second budget. The same check failed the same way once at 375 px for the earlier city release (13 October), and passed against production (14 October).
- **Verdict:** not a regression. It is an intermittent limitation of the local preview, with the original failure kept on record. The timeout was not raised.

### Idle database connection crash

- **Error (sanitized):** `Error: Connection terminated unexpectedly`, emitted through `pg-pool`'s `Client.idleListener` as an unhandled `'error'` event (`serve-nat.log`).
- **Cause:** `src/server/db/postgres/client.ts` created the pool without an `error` listener. node-postgres removes an idle client whose connection closed and emits `error` on the pool; with no listener, the process exits.
- **Scope:** the same code runs in production serverless functions. A production crash was not observed and is not claimed.
- **Reproduced** on a disposable local PostgreSQL by terminating an idle pooled backend (`idle-connection-repro.txt`): without a listener the process exits with code 1; with one it continues, and the next query opens a new connection.
- **Fix:** a pool `error` listener that logs a sanitized line. Query errors still reject to their callers, so pages still fail rather than showing an empty catalogue, and nothing is retried.
- **Regression test:** emits the event on the real pool without connecting. It fails without the listener.

### Verification on the final code

| Check | Result |
|---|---|
| Regression suite | PASS, 45 of 45 (adds the review-build fixture test and the pool test) |
| Production build (isolated copy, `.env.local`) | PASS; the review check ran in it |
| Image-discovery browser checks (`ig-check2`) | PASS, 48 of 48: the original 44 updated for the new lily wording, plus two more lily enquiries at both widths |
| `cc-check` | PASS, 59 of 59 (one run). The original 58 of 59 stands, as above |
| Sitemaps (baseline versus final) | PASS. 393 URLs unchanged; 202 image entries (46 + 156), every one fetched and matched to its page's main photograph; strict XML parse; two `lastmod` changes (section 6). Images crawlable: robots excludes only /admin and /api, and the storage host has no robots.txt |
| Type check | 20 errors, 0 warnings, 11 hints; the same diagnostics as `2755486`, ignoring line numbers (`typecheck-diff.txt`). An unused variable added by 57d3385 was removed |
| `sg-check`, `jr-check`, `rt-check` | Not rerun: earlier passing evidence reused (unaffected) |
| Production admin save, CDN purge, production writes | Not tested, not done |

Separately, three older regexes in `regression.test.mjs` contain a literal backspace where `\b` was meant (lines 402, 695 and 702, already in `2755486`). They were left as they are and noted here.

## 10. Rollback

Revert this branch's commits on `main`, or promote the deployment for `2755486` in Vercel. No data, setting or account was changed.
