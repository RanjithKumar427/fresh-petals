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
node scripts/seed-car-decoration.mjs                    # dry run (rolled back)
node scripts/seed-car-decoration.mjs --apply [--publish]
node scripts/seed-car-decoration.mjs --sql [--publish]  # SQL for the Supabase SQL editor
node scripts/seed-car-decoration.mjs --rollback-sql     # removes exactly these rows
```

Additive and idempotent: adds the category, one seed media row per photograph (a `public/` path the build serves), the product (quote, WhatsApp confirmation), included items, care notes and flower types. Existing slugs are skipped. No occasion is assigned; assign occasions in the admin if wanted.

## Rollback

1. Unpublish (admin, or `--rollback-sql` to remove the rows). The next publish removes the pages.
2. Code: revert the release commit on `main` (rollback target recorded in the PR).
