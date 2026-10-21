# Catalogue accuracy, discovery and measurement, 21 October 2026

Corrections on top of the released catalogue expansion (`710601e`, live as `dpl_GigzyBpU6uKkZBNeiRCKgoAcNRLM`). The rules are in `docs/catalogue-publication.md` ("Presentation and recorded collections") and `docs/seo/measurement.md` ("Application context", "The periodic review"); owner inputs are in `docs/seo/owner-checklist.md`.

- **Status:** a local commit on branch `catalogue/discovery-2026-10-19`, on top of `710601e`. Not pushed or deployed; publishing needs separate approval. The uncommitted Production results in `docs/catalogue-discovery-2026-10-19.md` are not part of this commit.
- **Not changed:** database records, migrations, Supabase and GA4 settings, dependencies, sitemap URL and image sets.

## What changed

- **Presentation:** one record-based resolver (`recordedPresentation`) for wrapping, vase, box and basket, used by collections, the bouquet note, All Flowers, titles, guides and city examples. Photograph descriptions are unchanged.
  - It reads "Giftbox arrangement", "Pink flower box", "Flowerbox packing" and "Wicker basket".
  - Optional or paired equipment is not an included container.
  - Conflicting or qualified evidence stays neutral, and the three lily owner checks come first.
- **Recorded collections:** each collection counts only its own products; related choices are shown in labelled sections that are not counted. City views use the same counts.
- **Bouquet note:** names the box and basket designs and the designs whose presentation is still to be confirmed, instead of "the other bouquets are wrapped".
- **All Flowers:** each product is placed once, by presentation. The old `#lilies` address lands on a titled "Looking for lilies?" signpost with:
  - a link to `/categories/lilies`;
  - the sections on the page that hold lily designs, linked, with counts (9, 1, 2, 1 and 3, the 16 designs on the Lilies page).

  No product card is repeated.
- **Sweet Petal Hour:** its record says only "Vase-style arrangement", so it stays unconfirmed. It is not counted as a vase arrangement or as wrapped, and Bouquets With Vases stays at five until the owner confirms a vase.
- **Inline-script CSP and line endings:** `InlineScript.astro` normalises CRLF and lone CR to LF before both hashing and rendering. The build check reads each script as a browser does (CRLF and CR become LF) before comparing hashes; both use `src/server/http/inlineScriptHash.mjs`. A Windows (CRLF) checkout and an LF checkout now give identical policies. The policy is unchanged:
  - inline scripts are allowed only by their SHA-256 hashes; `script-src` otherwise keeps its existing `'self'` and Google tag host;
  - no `unsafe-inline` or `unsafe-eval` for scripts;
  - no new exemptions;
  - the build assertion still fails on any unhashed inline script.
- **Contextual links:** Bouquets and All Flowers now link to Rose, Lilies and Bouquets With Vases; Bouquets also links to wrapped and hand-tied bouquets.
- **Social previews:** Bouquets, All Flowers, Rose and Lilies use a reviewed product photograph from the full collection.
- **Occasion directory:** lists every other indexable occasion once, using the occasion sitemap's rule (`occasionIndexable`, now shared). It reads membership for the whole public catalogue and adds the garland cache tag.
- **Metadata:** these no longer claim formats or a plan that aren't listed:
  - Subscriptions;
  - Housewarming and Mom-to-be;
  - the bouquet and All Flowers descriptions;
  - the about page;
  - the footer and business summary.

  The FP-G106 search snippet now reads as a description of the photograph, and its unit is confirmed on WhatsApp.
- **Feedback page:** neutral labels, four entries marked "Enquiry", and no "WhatsApp Confirmed" or verified-order badges; quotations, dates and areas are unchanged.
- **Product pages:** the review block now says it links to general feedback.
- **Bestselling:** the collection is named "Selected Bouquets" and described as a selection; the URL and its members are unchanged.
- **Analytics:** a timestamped application context with a 30-minute idle expiry, checked again when an event fires. Old session keys are migrated or dropped.
- **Report script (`scripts/seo/report.mjs`):**
  - assistant sources must match an exact hostname;
  - reporting periods are stated or shown as unknown;
  - required columns are validated;
  - average position is weighted by impressions over rows that have a position;
  - city figures come from the shared city registry, with each query counted once;
  - wording is neutral throughout.

## Before and after (local builds of `710601e` and the working tree, 21 Oct 2026, same database read)

| Surface | Before | After |
|---|---|---|
| Subscriptions | 5 options (3 plans, cutter, flower food) | 3 plans; cutter and flower food related |
| Flowerbox | 9, including a vase, flower food and the weekly plan; no Cotton Candy | 7 boxes (Cotton Candy added); weekly plan, vase and flower food related |
| Baskets | 3 | 4 (Violet Picnic) |
| Hand-tied bouquets | 37, including vase, box and basket designs, no lilies | 34 "Wrapped & Hand-Tied Bouquets", including 4 wrapped lilies |
| Vases | 6 (vessels, a vase arrangement, two flower boxes, a dried set) | 2 vases; 5 vase arrangements and 3 "for your own vase" related |
| Bouquets With Vases | 6 | 5 (Sweet Petal Hour's "vase-style" is an owner question) |
| By Stems | 3 | 2; Loose Flower Box related |
| Bouquets / All Flowers / Rose / Lilies | 47 / 58 / 14 / 16 | Unchanged |
| All Flowers groups | wrapped 32, lilies 9, vase 6, boxes and baskets 6, stems 2, more 3 | wrapped 34, vase 5, boxes and baskets 10, stems 2, to confirm 4, more 3 |
| `/occasions` sitemap pages not linked | 7 | 0 |
| Social preview (4 collections) | `hero-main-banner.jpg` | A reviewed product photograph |
| Search, city shops | 82; 238 (10 pages) | Unchanged |
| Sitemaps | 213 / 161 / 13 URLs; 45 / 156 / 0 images | Identical sets |

Titles that changed:

- "Cotton Candy – Flower Box";
- "Violet Picnic Mixed Statice Flower Basket";
- "Pink Serenity Flowerbox – Pink Lily Box";
- "Fragrance Festive Giftbox Lily Box";
- "Sweet Petal Hour Gerbera Arrangement".

## Checks

| Check | Start (`710601e`) | Now |
|---|---|---|
| Regression | 45 of 45 | 45 of 45 |
| Catalogue | 18 of 18 | 25 of 25 |
| Measurement (new) | — | 10 of 10 |
| Security | 28 of 28 | 30 of 30 (LF, CRLF and lone-CR fixtures added) |
| Garland imports | 6 of 6, 4 of 4 | 6 of 6, 4 of 4 |
| Type check | 20 errors, 0 warnings, 11 hints | The same 31 diagnostics, identical by file, line and code |
| Build | Passes; 82 of 89 published | Passes; same snapshot, reads only |

- **Repaired assertions:** three regression assertions held literal backspace characters where `\b` was meant, so they could never fail. They now check what they describe.
- **Line-ending fixtures (security suite):** the same script with LF, CRLF and lone-CR endings normalises to one text and one hash; any other edit changes the hash. The build check:
  - accepts CRLF and CR pages under the LF hash;
  - rejects the old raw-byte hash;
  - rejects a modified or extra script, and `unsafe-inline`.

  The old check, run against the same fixtures, flagged the CRLF and CR pages that a browser accepts.
- **Two source trees, both built locally with read-only database access (82 of 89 published; 87 reads, 0 refused) and both served read-only:**
  - **Windows checkout:** the working tree in `C:\Users\ranji\Downloads\fp-catalogue` as it is on disk: `710601e` plus these uncommitted changes, with `core.autocrlf=true`, so 316 files under `src/` and `scripts/` are CRLF. Built in place.
  - **Clean LF candidate:** a scratch copy of the same 811 files, each byte-equal to the blob `git add` would store (checked with `git hash-object`, which writes nothing). The 784 built files, excluding `docs/`, have the same fingerprint in both trees (`d615fbc78022628b`).

  The two outputs give identical CSP headers on all 171 prerendered pages. Their HTML is identical apart from one random element ID per build (`DestinationCity.astro`). The only other differences are CR bytes in two SVGs copied unchanged from `public/`. No delivered inline script contains a CR (516 in the prerendered HTML, 55 on the pages checked in the browser).
- **Browser checks:** Chromium, at 390 and 1440 px, with and without scripts. Each result below is the same on both trees:

  | Check | Each tree |
  |---|---|
  | Line endings and CSP | 52 of 52 |
  | Affected pages | 39 of 39 |
  | Basket | 6 of 6 |
  | General journeys | 14 of 14 |
  | Measurement | 5 of 5 |
  | Tampering | 2 of 2 |

  - **Line endings and CSP:**
    - in Chromium, LF, CRLF and lone-CR scripts rendered as the component now renders them run, and modified scripts are blocked; the old raw-byte hash of a CRLF or CR script is blocked, which reproduces the earlier local failure;
    - 17 real pages run their reviewed scripts (page flags, reveal, analytics) with no violation, and no `unsafe-` source in `script-src`;
    - `#lilies` is checked with and without scripts.
  - **Affected pages:** one step from the first run is corrected; it had reused a session that had already landed on another page.
  - **Tampering:** changing one character of the page-flags script on a served `/about`, under that page's real policy, gets it blocked.

  No write, enquiry or analytics request was sent.

## Limits

- **Search Console:** no export was available, so there are no query, page, indexing or ranking figures. The 13–18 October GA4 figures in `measurement.md` are historical.
- **Cache purges:** cache-tag wiring is tested in the source; no production purge was exercised.
- **Browsers:** not tested in Safari, Firefox or on physical devices.
