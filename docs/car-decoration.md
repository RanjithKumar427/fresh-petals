# Car Decoration (28 November 2026)

`/categories/car-decoration` — vehicle flower decoration: car gajamala, new-vehicle garlands, vehicle pooja, wedding cars, two-wheeler garlands. 11 products, all quoted on WhatsApp.

## Where things live

| What | Where |
|---|---|
| Products (copy, flowers, included, care) | `src/data/productCatalog.ts`, category `Car Decoration` |
| Fulfilment per product, safety points, enquiry points, sections | `src/data/carDecoration.ts` |
| Category landing copy and FAQs | `src/data/seoLanding.ts` (`car-decoration`) |
| Category guide (enquiry, delivery vs on site, safety) | `src/components/car/CarDecorationGuide.astro` |
| Product-page panel | `src/components/car/CarDecorationDetails.astro` |
| Photographs (published, plates blanked) | `public/images/car-decoration/` (+ 240/480/720 px variants) |
| Photo reviews, descriptions, concept images | `src/data/productPhotos.ts` (`PHOTO_REVIEWS`, `PHOTO_DESCRIPTIONS`, `CONCEPT_IMAGES`) |
| Database records | `scripts/seed-car-decoration.mjs` |
| Tests | `scripts/audit/car-decoration.test.mjs` |

## Rules

- **Quoted only.** `Car Decoration` is in `QUOTE_ONLY_CATEGORIES`: no amount appears anywhere. No flower count, size, preparation time, availability or delivery speed is stated: none is recorded.
- **Delivered or on site.** Each product is either a garland delivered ready to tie (no fitting included) or decoration fitted on site by our team. On-site work is confirmed per enquiry, never promised for a city.
- **Safety.** Every category and product page shows `VEHICLE_SAFETY` (clear view, lights, plates; slow, short drives; no adhesive on paint; two-wheeler controls).
- **Enquiry.** The category's own enquiry button uses `data-product-enquiry`, so the recipient city is chosen first and written into the draft, and `whatsapp_enquiry_click` is reported as for any product.

## Photographs

Source: 49 images supplied on 28 Nov 2026. Published: 9 WhatsApp photographs of real jobs (treated as Fresh Petals' own, owner-confirmed) and 2 AI-generated concept images (owner-approved, labelled "Concept image" on cards, product pages and alt text, reviewed `illustrative`, kept out of the image sitemap). 18 Pinterest downloads were not used (third-party work, not authorised).

Every registration plate, including background vehicles, was blanked by localised editing: only the characters inside the plate are lifted to the plate's own colour; frame, IND strip and lighting stay. Bystanders' faces are blurred. Flowers are untouched; images are cropped to 4:5 and saved as WebP without metadata. Originals are unchanged in the owner's folder; the redaction script, coordinates and processed files are in the owner's local pack (`fresh-petals-processed/` beside the originals), not in this repository.

## Database

```
node scripts/seed-car-decoration.mjs [plan]     # report: status, seeded or not, admin-edited
node scripts/seed-car-decoration.mjs apply      # missing products as DRAFTS (+ category, flower types)
node scripts/seed-car-decoration.mjs publish    # publish seeded drafts no admin has saved since
node scripts/seed-car-decoration.mjs rollback   # see below
# --sql prints the transaction (Supabase SQL editor); --dry-run runs it and rolls back
```

A product is **seeded** only if it is in `car-decoration` and its primary photo is the seed's own media row (source `seed`, `/images/car-decoration/<slug>.webp`, created in the same transaction). A pre-existing product with one of the slugs, or one whose photo an admin replaced, is never published or removed — only reported. `publish` does not change `updated_at`, so a later admin save stays detectable. `rollback` deletes seeded products no admin has saved (with their details and seed media), moves admin-edited seeded products to draft keeping their edits, and removes the category only when it is empty and was created by the seed. Every action is one transaction and repeatable. `scripts/audit/car-seed-lifecycle.mjs` exercises all of this on a local or throwaway database.

## Release order

1. Merge PR #8 (code and photographs on `main`).
2. `apply`: drafts only. The database fingerprint changes, so the scheduled *Production publish* rebuilds `main` with the new code and photographs while nothing new is public.
3. Check `https://onlyfreshpetals.in/images/car-decoration/new-car-rose-gajamala.webp` is served.
4. `publish`. The next production publish lists the range.
5. Verify: `node scripts/audit/car-live-checks.mjs https://onlyfreshpetals.in --browser`.

Never publish records before step 3: a build from older code would list them with placeholder photos.

## Rollback

`rollback` (or unpublish in the admin), then the next production publish withdraws the pages. Code: revert the merge on `main`.
