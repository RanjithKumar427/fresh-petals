# Garlands / Poola Mala

**156 draft garland designs, FP-G001–FP-G156,** sit in the shared product catalogue. None of them is public yet.

- **FP-G001–FP-G025** are the original shortlist. Their records were not changed by the full-catalogue expansion.
- **FP-G026–FP-G156** (131 designs) were added on 5 October 2026 from a review of every photo in the four supplier catalogues (197 photo entries, 183 distinct photos).

Every design is priced at **₹5,000 (INR)**:
- The first 25 got this price as a one-time edit on 4 October 2026.
- New designs get it once, when they are created; later edits are kept on re-import.

What the price covers (single garland or pair, length) is not recorded, so it is not stated anywhere. A price does not publish a design or enable checkout.

**Garlands are managed in the admin dashboard** (Products), with the same editor, photo storage and permissions as bouquets. **Saved changes reach the website by themselves — no deployment.** See "How admin changes reach the website", "Rollout" and "Rollback" below. Until the rollout steps run on production, production is unchanged.

## Where things live

| What | Where |
|---|---|
| **Where to edit garlands** | The admin dashboard → Products (search by name or design code). Database: `products` + `garland_details`, `product_garland_filters`, `product_options` (migration `drizzle/0011_garland_management.sql`) |
| Starting catalogue (before a design is in the database) | `src/data/garlandDrafts.json` (merged into, never overwritten, by `scripts/import-garlands.mjs`) |
| Add catalogue designs to the database (idempotent) | `scripts/seed-garlands.mjs` (`npm run db:seed-garlands`) |
| Move approved photos into image storage | `scripts/migrate-garland-images.mjs` (`npm run db:migrate-garland-images`) |
| Storefront reads admin edits (on every uncached request) | `src/server/services/GarlandCatalogue.ts`, merged in `src/data/garlands.ts` |
| Website refresh after a save, cache headers, the editor's website check | `src/server/services/GarlandWebsite.ts`; `POST /api/admin/garlands/refresh`, `GET /api/admin/products/<id>/website`; editor bar `src/features/admin/productEditor/WebsiteStatus.tsx` |
| Publication, selling and database-price rules | `src/data/garlandRules.ts` |
| Mapping to the product model, preview flag | `src/data/garlands.ts` |
| Full-catalogue import mode | `scripts/lib/import-garlands-full.mjs` (run through `scripts/import-garlands.mjs --full`) |
| Import tests (temporary fixtures only) | `node --test scripts/import-garlands.test.mjs scripts/import-garlands-full.test.mjs` |
| Listing with Rose, Tuberose, Lotus and Designer / Mixed filters (live) | `/categories/garlands` (`src/pages/categories/garlands.astro`, `src/components/GarlandListing.astro`, `src/components/GarlandCard.astro`) |
| Design page (live) | `/products/<slug>` (`src/pages/products/[...garland].astro`, `src/components/GarlandProductMain.astro`) — bouquets keep the prebuilt `src/pages/products/[slug].astro` |
| Live garland cards for the prebuilt search and wedding/engagement pages | `/fragments/garlands` (`src/pages/fragments/garlands.astro`, `src/components/LiveGarlands.astro`) |
| WhatsApp enquiry check (never cached) and message text | `/garland-enquiry` (`src/pages/garland-enquiry.ts`), `src/utils/garlandEnquiry.ts` |
| Garland sitemap (live) | `/sitemap-garlands.xml`, listed in `robots.txt` next to `sitemap.xml` |
| Photos (156 main photos plus 20 provisional alternate views), with 240/480/720 px WebP variants | `public/images/garlands/` (git-ignored) |
| Original shortlist pack | `garland-import/` (git-ignored, local only) |
| Full source pack: originals, contact sheets, source index | `full-garland-import/` (git-ignored, local only) |
| The visual review: which photo is which design, alternate view, collage, context or unresolved | `full-garland-import/review-decisions.json` (internal: contains source references) |
| Completed coverage audit for all 197 entries, with source/page references and resulting codes | `full-garland-import/coverage-audit.json` (written by the import) |
| Review key → public code map (keeps codes stable) | `full-garland-import/design-ids.json` |

Wedding and engagement pages show the garlands the admin tagged with that occasion, loaded live into the prebuilt page. They do not use copies. The Engagement page exists once it has launch products or garlands are promoted in the menu (`ready: true`, below).

Source references, review notes and the coverage audit stay in the git-ignored packs. The repository keeps only the public design codes, the titles, descriptive alt text and the publication flags.

The packs are the only place the review decisions live. Keep a copy: the owner keeps one in a local backup folder, outside the repository, with the other release material.

## Previewing the drafts locally

Drafts appear only in a local preview.

- **Development server:** run `npm run dev`, then open <http://localhost:4321/categories/garlands>. Drafts always show in dev.
- **Production-like build** (PowerShell):

  ```powershell
  $env:PUBLIC_FP_PREVIEW_DRAFTS = "1"; npm run build; npm run preview
  Remove-Item Env:PUBLIC_FP_PREVIEW_DRAFTS
  ```

Set the flag in the shell, not in an `.env` file. The build hook in `astro.config.mjs` reads the same flag to decide whether to keep the photos.

A normal build (`npm run build` without the flag) prebuilds no garland pages at all — garland pages are rendered on request, from the database — and:

- shows no drafts anywhere: only published, approved designs with a stored photo;
- `/categories/garlands` shows only the existing "Event Garlands" product until a design is public;
- removes every photo under `images/garlands/` from the output (public garland photos come from image storage).

Preview pages carry a "Draft preview — not public" banner and are `noindex`.

## Managing garlands in the admin dashboard

Garlands are ordinary products in the admin, edited with the bouquet editor:

- **Find:** Products → search by name or design code (e.g. `FP-G104`).
- **Edit:** name, short and full description, occasions, SEO, price or **Price on request**, photos (upload, choose from the library, set primary, reorder, alt text).
- **Garland Details** (garlands only):
  - flower filters (Rose, Tuberose, Lotus, Designer / Mixed);
  - sold as (single, pair or set), length, flowers, thickness, finish, preparation time, substitution policy;
  - how customers order (WhatsApp enquiry or cart) and "Ready for sale";
  - approvals: photo permission and sample verification.

  Leave anything unconfirmed blank: customers see "To be confirmed on WhatsApp".
- **Options & Charges:** choices such as Finish → Pearl tassels with an optional extra charge. The charge is shown next to the choice and quoted in the WhatsApp message; it is never added into a total.

**Protected identity.** The design code, the URL and the Garlands category can't be changed, and garlands can't be duplicated or deleted (archive instead). The database refuses a design-code change too.

**Publishing.** A garland publishes only with a name, a photo, a price or "Price on request", photo permission **granted** and the sample **verified**. While a garland is published, its permission and verification can't be withdrawn (unpublish first).

**Selling.** Garlands stay in WhatsApp enquiry mode. Cart mode needs a fixed price **and** "Ready for sale". Once "Sold as" is set, WhatsApp messages state quantities in that unit (e.g. "Quantity: 2 pairs", "Listed price: ₹6,500 per pair"). No totals are calculated.

**When changes appear.** Straight away — see the next section. A design appears publicly only when it's published, approved (photo permission granted, sample verified) and its main photo is in image storage. **Unpublish** (or Archive) takes it off the website.

## How admin changes reach the website

No deployment is needed for garland changes: prices, details, options, photos, filters, occasions and publication.

- **Rendered on request.** Every garland surface reads the database when it is rendered: the design pages, `/categories/garlands`, the garland cards on the search and wedding/engagement pages (fetched by the browser from `/fragments/garlands`), and `/sitemap-garlands.xml`.
- **Briefly cached.** Vercel's CDN keeps each rendered garland response for up to **2 minutes**, then may serve it for **1 more minute** while it re-renders in the background (`Cache-Control: s-maxage=120, stale-while-revalidate=60`). Every one carries the cache tag `garlands`. So most visits don't touch the database.
- **Refreshed on save.** When a save, publish, unpublish or archive affects a garland that is (or was) public, the server deletes everything tagged `garlands` from the CDN (`dangerouslyDeleteByTag` from `@vercel/functions`). The next visitor gets the saved version — normally within seconds.
- **If the refresh fails,** nothing is lost: the change is saved, and the old version is served for **at most 3 minutes** (2 + 1) before it expires on its own. The editor says so and offers **Refresh website** to retry.
- **Enquiries are checked live.** Every "Enquire / Ask for a quote on WhatsApp" button goes through `/garland-enquiry`, which is never cached. It reads the database at that moment, so an unpublished design can't be enquired about even from a page a cache is still holding. It also builds the WhatsApp message from the saved title, price and unit, keeping only option choices that exist for the design.
- **Validation unchanged.** Saves still go through the same checks: price validation, publish blockers (photo permission granted, sample verified, a photo, a price or "Price on request"), approvals that can't be withdrawn while published.

**What the editor shows.** For garlands the editor has two separate indicators:

- the top bar says whether the change is **saved** (in the database);
- the **Website** bar under it says whether visitors can **see** it:

| Website bar | Meaning |
|---|---|
| Updating the website… | Saved; checking the live page every 5 seconds (usually seconds, at most 3 minutes). |
| Visible on the website with the saved details. | The live page (fetched through the same CDN visitors use) shows this exact saved version. |
| Not on the website — draft / photo permission not granted / sample not verified / no photo | The garland isn't public, so saves don't affect the website. |
| Not on the website — its page and enquiry link are closed. | After unpublishing: the page returns "not available" (404) and enquiries are refused. |
| The website refresh failed (…). The change is saved and appears on its own within 3 minutes, or retry now. **Refresh website** | The cache purge failed. Retry, or wait. |
| The website is still showing the previous version… / A cached copy of the page is still visible (enquiries are already closed)… **Refresh website** | The check timed out with an old copy still cached. |

The product list's Publish / Unpublish / Archive actions also report a failed refresh (open the garland to retry). The check fetches the page from the address the admin is using; set `SITE_CHECK_ORIGIN` if that isn't the public site.

## What migration 0011 does

Verified on local copies of the schema (not on production): applied after 0000–0010 by the project's own migrator (`npm run db:migrate`), on a database holding the bouquet catalogue.

- **Adds only:** 4 enum types (`garland_filter`, `garland_unit`, `garland_selling_mode`, `photo_permission`); 3 tables (`garland_details` with a unique, format-checked `design_code`; `product_garland_filters`; `product_options` with a non-negative `extra_charge` check), each linked to `products(id)` with `ON DELETE CASCADE`; 1 index; the `garland_design_code_is_immutable()` function and its trigger; row-level security on the 3 new tables with read policies for published products only.
- **Changes nothing that exists:** a schema-only dump before and after differs only by those additions, and every existing table's contents were byte-identical before and after (row-by-row checksums of all 16 tables). It inserts no rows — the 3 new tables are empty until the seed runs.
- The migrator applies **every** migration newer than the last one recorded in `drizzle.__drizzle_migrations`. Production should already have 11 (0000–0010); check that first (step 2 below), or it will apply the missing ones too.

## Rollout (production)

Nothing below has been run against production. Run the steps in this order, with the production environment's `DATABASE_URL` (and, for photos, the Supabase keys):

1. **Back up the database** (Supabase dashboard → Database → Backups, or `pg_dump`).
2. **Check the migration history:** `select count(*), max(created_at) from drizzle.__drizzle_migrations;` should return 11. If it doesn't, stop and review which migrations `npm run db:migrate` would apply.
3. **Dry-run the seed — before the migration.** `npm run db:seed-garlands`. It runs in a read-only transaction and works without migration 0011, saying "migration 0011 is NOT applied". Expect:
   - `catalogue designs: 156 | already in the database (kept as is): 0 | to add: 156` — or fewer to add, if some designs are already there; never assume 156;
   - the other-product count matching the bouquet catalogue in the admin;
   - whether the `garlands` category and the Wedding / Engagement occasions exist or would be added;
   - **no** "Nothing was written" list. A slug already used by another product stops the run; resolve it first.
4. **Apply the migration:** `npm run db:migrate` (additive only, see above).
5. **Seed:** `npm run db:seed-garlands -- --apply`, then run the dry run again: it should say `to add: 0`. Re-running never changes an existing row.
6. **Photos:** choose one.
   - **Recommended:** upload your own photographs in the admin editor (same storage as bouquets).
   - Or, for designs whose photo permission you have recorded as granted in the admin: dry run `npm run db:migrate-garland-images`, then `npm run db:migrate-garland-images -- --apply`.
   - `--include-unapproved` would upload supplier photos without permission to the public bucket. Don't use it unless that permission exists.
7. **Deploy this code — once.** No new settings are needed on Vercel. (The code is also safe to deploy before step 4: without the garland tables the garland pages show no designs, `/categories/garlands` shows the event-garland order, and the admin skips the garland sections.) After this deployment, garland changes never need another one.
8. **Verify on production** (first time only):
   - `/categories/garlands` loads; repeat the request and its `x-vercel-cache` response header goes from `MISS` to `HIT` (the CDN is caching).
   - In the admin, publish one approved garland. The Website bar should reach "Visible on the website" within seconds. If it says the refresh failed (for example "the Vercel cache-purge API isn't available"), the purge isn't working on this account: changes still appear within 3 minutes, but report it.
   - Open the design page and press Enquire: WhatsApp opens with the design code and price.
   - Unpublish it: the Website bar says "Not on the website"; the page shows "This page isn't available" and the Enquire link returns to the garlands page.
   - `/sitemap-garlands.xml` lists the published design; `robots.txt` names both sitemaps.
9. **Promote in the menus (optional, one code change):** set `ready: true` on the garlands entry in `src/data/launchCatalogue.ts` and deploy. This adds Garlands to the Shop menu and builds the Engagement occasion page. Designs are public without it — reachable at `/categories/garlands`, from search, the wedding page and the sitemap.

### Configuration

| Setting | Needed? | What it does |
|---|---|---|
| `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` | Already set | Unchanged. |
| `SITE_CACHE_PURGE_URL` | No (Vercel) | Only if the site is moved behind a different CDN: receives `POST {"tags":["garlands"]}` on each refresh. |
| `SITE_CHECK_ORIGIN` | No | Where the editor's website check fetches pages from, when the admin is opened on a different address from the public site (e.g. `https://onlyfreshpetals.in`). |

The cache purge needs no token inside a Vercel Function. On a protected Preview deployment the website check is refused (HTTP 401); the bar says so.

### Recurring costs

No new service or subscription. What changes is usage on the existing Vercel and Supabase plans:

- **Vercel Functions.** Garland pages, the garland list, the two live sections, the garland sitemap and each enquiry click run a function instead of being served as static files — but the CDN answers repeat visits for 2–3 minutes, so a page costs at most about one render per 2 minutes per CDN region, plus one per admin save. Each render is short (a few database queries). Vercel's published pricing (checked October 2026): Hobby includes 1M function invocations and 4 hours of active CPU a month; on Pro, usage beyond the included amounts costs from $0.60 per 1M invocations and $0.128 per active-CPU hour. At this shop's traffic that should stay within the included amounts; check Vercel → Usage after launch.
- **Edge requests.** The search and wedding/engagement pages make one extra request each (to `/fragments/garlands`). Hobby includes 1M edge requests a month; Pro includes 10M, then from $2 per 1M.
- **Cache purges** are not billed.
- **Supabase:** a few extra reads per render; no new tables beyond migration 0011, no new storage unless photos are uploaded.
- **Deployments:** one for this rollout (and one if you promote garlands in the menu); none afterwards for garland edits.

Also note Vercel's Hobby plan is for non-commercial use; a shop normally needs Pro. Which plan this project is on could not be checked from here.

### Rollback

Use the smallest step that fixes the problem.

1. **One design:** Unpublish or Archive it in the admin. It leaves the website within seconds (at most 3 minutes if the refresh fails) and enquiries close immediately.
2. **All garlands, keep the code:** unpublish or archive the published designs. `/categories/garlands` returns to the event-garland order only.
3. **The code:** Vercel → Deployments → the deployment before this one → **Instant Rollback** (or Promote). The previous code never reads the garland tables, so it works with migration 0011 applied. Bouquets are unaffected either way.
4. **The data (rarely needed; only after step 3):** the garland rows and tables can simply stay. To remove them, restore the step-1 backup, or — after testing on a copy — in one transaction:
   ```sql
   BEGIN;
   DELETE FROM products WHERE id IN (SELECT product_id FROM garland_details); -- the seeded garlands; options/filters/details cascade
   DROP TABLE product_options, product_garland_filters, garland_details;
   DROP FUNCTION garland_design_code_is_immutable();
   DROP TYPE garland_filter, garland_unit, garland_selling_mode, photo_permission;
   DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1786800000003; -- 0011's record (drizzle/meta/_journal.json), so it can be re-applied later
   COMMIT;
   ```
   Tested on a local copy: afterwards every other table is identical to before the migration, and the migration can be applied again. What stays: the seed's `Garlands` category and `Engagement` occasion, and any photos uploaded for garlands (media library and storage).

## Bouquets: known limitation (unchanged)

Bouquet pages are still prebuilt. Only their **price** comes from the database, and only at build time; their names, descriptions, photos and other details come from `src/data/productCatalog.ts`. So for bouquets:

- a price change in the admin appears at the next deployment;
- other admin edits (name, copy, photos, publication) **do not reach the website at all** — the admin preview shows them, the storefront doesn't.

This pass did not change that; the live mechanism above applies to garlands only.

## Ordering behaviour

- **Confirmed price, enquiry mode** (all 156 designs now): cards and the design page show **₹5,000** with an **Enquire on WhatsApp** button. The button goes through the live enquiry check (`/garland-enquiry`), which opens WhatsApp only while the design is public. The message includes:
  - the public design code and title, for example `Design: FP-G001 — Classic Red Rose Garland`;
  - `Listed price: ₹5,000`;
  - the quantity and the options chosen (only confirmed options are offered);
  - the page link;
  - blank "Occasion and date" and "Delivery area" lines for the customer to fill in.

  It never multiplies the price into a total, and asks for no pincode or delivery slot.
- **No confirmed price:** the design shows "Price on request" and **Ask for a quote on WhatsApp**. The message is the same, without the price line.
- **Cart:** a design uses the existing options, cart and WhatsApp flow only when `sellingMode` is `"cart"`, `readyForSale` is `true` and the price is confirmed. A price alone never enables checkout.
- **Unknown facts:** sold unit, length, flowers, thickness, preparation time and substitutions stay `null` and read "To be confirmed on WhatsApp".

### Database price check

Live garland pages read each design's price from its own `products` row — the garland *is* that product — so the price shown is always the price saved in the admin. Only garlands in the database can be public (a public design needs a photo in image storage, which only the database records), so no public price comes from the bundled catalogue.

Bouquet prices are still checked against `products` at build time (`src/server/services/ProductPricing.ts`). Garlands no longer pass through that check (they aren't in the static catalogue), so its garland exemption (`isExemptFromDatabasePrice`) is now unused there.

## Publishing a design

After the rollout, publish in the admin dashboard (see above) — no deployment. Photos come from image storage, so nothing under the git-ignored `public/images/garlands/` folder needs committing.

Before the rollout (catalogue-only), the old route still works: fill the record in `src/data/garlandDrafts.json` and set `published`, `photoPermission: "granted"` and `sampleVerified`. A design is only listed publicly when its main photo is in image storage, so this route alone no longer publishes it.

Provisional related views (`relatedViews`) never appear publicly. To use one, upload it as a gallery photo in the admin.

## Re-importing

Re-importing never touches admin edits. The importer only updates `src/data/garlandDrafts.json`, and the database is authoritative for every design it holds. After an import that adds new designs, run `npm run db:seed-garlands -- --apply` again to add them (and only them) to the dashboard.

The catalogue has been expanded from the full source pack, so re-import with:

```
node scripts/import-garlands.mjs --full full-garland-import --dry-run   # report only
node scripts/import-garlands.mjs --full full-garland-import
```

The path is relative to the project root; any folder can be given. The original shortlist import (`node scripts/import-garlands.mjs` without `--full`) now refuses to run, so the range cannot revert to 25 designs.

The full import:

- checks that every photo is present and matches its checksum;
- requires a disposition for every source entry;
- gives new designs the next free code after the highest one in use.

Codes are never renumbered or reused. Both modes merge by design code:

- **Kept:** every field already in a record, including deliberate `false`, `null`, `0` and `[]` values. That covers prices, titles, slugs, specifications, options, selling mode, publication, photo permission, sample verification, alt text and `gallery`.
- **Refreshed:** the main photo file and its size, and the provisional `relatedViews` (including their generated alt text).
- **New designs** arrive as drafts in enquiry mode at ₹5,000, with unknown facts left blank and photo permission unconfirmed.
- **Designs missing from the pack** are kept and reported, never deleted.
- **Duplicate or conflicting** IDs, codes, slugs or photo paths stop the run before anything is written. So does a reference used twice, an exact-repeat photo listed as a design, or a slug that clashes with another product.

### How the full review was done

- **Exact byte repeats** (14 entries) are duplicates of their first appearance, never products.
- **Alternate views:** a photo is one only when it shows the same garland from the same shoot, or every visible detail matches (flowers, colour pattern, construction, hangers, tassels) with nothing contradicting.
  - There are 20 alternate views. They stay provisional in `relatedViews` and enter `gallery` only when the owner confirms them.
- **Separate designs:** any visible difference in flowers, colour pattern, construction, hangers or tassel finish makes a separate design. Uncertain matches stay separate and carry a review note in the audit.
- **Collages:** each garland in a collage is mapped to a design. 25 designs that appear only inside a collage use an unaltered rectangular crop of the original photo. Nothing is retouched or added.
- **The seven earlier related-view proposals:**
  - Upheld as provisional views: the views for FP-G009, FP-G010 and FP-G016. Each is the same garland from the same shoot. A second same-shoot view was added to FP-G016.
  - The other four (proposed for FP-G014, FP-G015 and FP-G020) differ in hangers, tassels or pattern. They are now separate designs.
- **Context only** (11 entries): wedding and lifestyle photos where the garland cannot be told apart from a listed design, and a making-of photo. Wedding portraits are not used as testimonials.
- **Unresolved** (6 photos): a garland is visible but packed, behind promotional text, mid-assembly or not identifiable. They are listed with source and page in `coverage-audit.json` under `unresolved`.

## Information needed before publication

- **Photos:** permission to publish the supplier-catalogue photos, or your own photos of the samples. The supplier photos carry another business's branding in the source catalogue.
- **Photos to replace in any case** (the audit lists the reason per design):
  - People or hands in the photo: FP-G007, G009, G012, G013, G017, G023, G024, and 44 of the new designs.
  - Lifestyle photos of couples, which can never be product or testimonial photos: FP-G120 and FP-G156.
  - Crops from multi-design photos: FP-G073–G081, G104, G105, G118, G119, G138 and G145–G155. Separate photos of each garland are needed.
  - Screenshots, overlays, watermarks or markings: FP-G047, G050, G071, G082, G083, G101, G107, G129, G131 and G139.
  - Black margins: FP-G018, G082, G101 and G142.
  - Unusual backgrounds: FP-G020 (swirl) and G106 (stylised).
  - Close-up, partial, coiled or distant views that need a full hanging photo:
    - close-up or coiled: FP-G026 and G027;
    - distant: FP-G031, G060, G065 and G127;
    - partial: FP-G066, G070, G072, G097, G117, G119, G121, G125, G126, G128 and G145.
  - Flat lays and busy backgrounds are usable for a preview but should be reshot for publication.
  - Several originals are only about 500–750 px wide. Request higher-resolution files for zoom or banners.
- **Per design:**
  - single garland or pair (most photos show pairs; this is not assumed);
  - length;
  - exact flowers and finish/tassels;
  - thickness or weight, if useful;
  - price or quotation-only;
  - preparation time;
  - substitution policy.
- **Filters:** which flowers each design really uses. The filters come from the photographs and are unverified.
- **Alternate views:** whether each of the 20 provisional alternate views shows the same design. They are on FP-G009, G010, G016 (two), G025, G028 (two), G032 (two), G034, G036, G038, G040, G055 (two), G063, G072, G097, G113 and G146.
- **Possible duplicates kept separate:** for example FP-G044 may be the same design as FP-G001, and FP-G058 as FP-G048. The audit's review notes list each case.
- **Unresolved photos:** six photos need a clean photo before they can be identified. See `unresolved` in the audit.
- **Use and delivery:**
  - which designs suit groom, wedding and engagement use;
  - the delivery area and lead time for garlands.
- **Trial set:** the first eight trial samples are FP-G001, G002, G003, G004, G008, G009, G014 and G021.
