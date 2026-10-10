# Local release manifest — 7 October 2026

Against production base a6ce916, with local HEAD 6ee4aba unchanged. This manifest extends the prior Claude 60-file handoff; it does not stage, commit, push or deploy anything.

## Included working-tree files (80)

- `astro.config.mjs`
- `docs/audit-regressions.md`
- `docs/garlands.md`
- `docs/handoff-audit-2026-10-07.md`
- `docs/occasion-journeys.md`
- `docs/release-manifest-2026-10-07.md`
- `scripts/audit/browser.mjs`
- `scripts/audit/business.mjs`
- `scripts/audit/local-fixture.mjs`
- `scripts/audit/regression.test.mjs`
- `scripts/audit/serve-build.mjs`
- `scripts/audit/source-loader.mjs`
- `scripts/audit/startup.mjs`
- `src/components/GarlandCard.astro`
- `src/components/GarlandProductMain.astro`
- `src/components/LiveGarlands.astro`
- `src/components/ProductCard.astro`
- `src/components/ProductOptions.astro`
- `src/components/atelier/BouquetEdit.astro`
- `src/components/atelier/FinalInvite.astro`
- `src/components/atelier/HeroAtelier.astro`
- `src/components/atelier/HomeFaq.astro`
- `src/components/atelier/InsideBouquet.astro`
- `src/components/atelier/OccasionDeck.astro`
- `src/components/atelier/OrderJourney.astro`
- `src/components/category/CategoryPage.astro`
- `src/components/occasion/JourneyNote.astro`
- `src/components/occasion/OccasionCard.astro`
- `src/components/occasion/OccasionHeader.astro`
- `src/components/occasion/OccasionPage.astro`
- `src/components/occasion/ShopFilters.astro`
- `src/content.config.ts`
- `src/data/atelierHome.ts`
- `src/data/occasionJourneys.ts`
- `src/data/occasionPages.ts`
- `src/data/seoLanding.ts`
- `src/data/shoppingTaxonomy.ts`
- `src/features/admin/mediaLibrary/MediaCard.tsx`
- `src/features/admin/mediaLibrary/MediaDetailPanel.tsx`
- `src/features/admin/mediaLibrary/MediaPickerModal.tsx`
- `src/features/admin/productEditor/OccasionWebsiteStatus.tsx`
- `src/features/admin/productEditor/ProductEditor.tsx`
- `src/features/admin/productEditor/sections/ClassificationSection.tsx`
- `src/features/admin/productEditor/sections/ImagesSection.tsx`
- `src/features/admin/productEditor/sections/PricingSection.tsx`
- `src/features/admin/productList/ProductListRow.tsx`
- `src/features/admin/shared/AdminImage.tsx`
- `src/layouts/BaseLayout.astro`
- `src/pages/admin/products/edit/[id].astro`
- `src/pages/api/admin/occasions/refresh.ts`
- `src/pages/api/admin/products/[id].ts`
- `src/pages/api/admin/products/[id]/occasion-pages.ts`
- `src/pages/cart.astro`
- `src/pages/categories/[slug].astro`
- `src/pages/categories/bouquets.astro`
- `src/pages/categories/garlands.astro`
- `src/pages/faqs.astro`
- `src/pages/garland-enquiry.ts`
- `src/pages/index.astro`
- `src/pages/occasions/[slug].astro`
- `src/pages/occasions/index.astro`
- `src/pages/products/[slug].astro`
- `src/pages/refunds.astro`
- `src/pages/robots.txt.ts`
- `src/pages/search.astro`
- `src/pages/shipping.astro`
- `src/pages/sitemap-occasions.xml.ts`
- `src/pages/sitemap.xml.ts`
- `src/pages/terms.astro`
- `src/server/services/GarlandWebsite.ts`
- `src/server/services/OccasionMembership.ts`
- `src/server/services/OccasionWebsite.ts`
- `src/server/services/ProductPricing.ts`
- `src/server/services/PublishedPrices.ts`
- `src/server/services/delivery/deliveryRules.ts`
- `src/styles/global.css`
- `src/utils/cart.ts`
- `src/utils/garlandEnquiry.ts`
- `src/utils/journey.ts`
- `src/utils/shopFilters.ts`

## Focused changes

Known zero-result URL filters and progressive server HTML; item-specific URL/basket enquiry context; database-authoritative occasion resolver and matching checker; existing public ceremony eligibility; server-rendered public ceremony cards with garland cache tags; consistent conditional business wording; build-only price snapshot startup; meaningful fixture/browser/startup regressions. See [audit report](handoff-audit-2026-10-07.md) and [commands](audit-regressions.md).

No migration, dependency, production setting or photograph is added. CSS 3D hero/arrival styles and deck/global motion remain preserved. Bouquet snapshot prices, live garland pricing, admin permission middleware, publishing/photo/sample safeguards and the removed bouquet builder remain intact.

## Explicit exclusions

- Existing untracked architecture proposal: docs/architecture/commerce-core-roadmap.md (preserved).
- .env files, private keys/data, node_modules, generated .astro/dist/.vercel output, review screenshots/logs, database/container state and both ignored audit copies under data/.
- All scripts/_tmp-* diagnostics, editing and bookkeeping scripts. Meaningful scripts/audit regressions are included and documented.
- Unapproved photographs, including supplier garland images; none added or uploaded.

## Local verification and later release checks

15 focused source regressions, 10 importer fixtures, 22 browser scenario groups at 360/390/1440px and isolated production-mode build pass. Startup/outage/recovery pass. Type check remains at exactly the existing 20 errors (zero new errors); no claim of a clean check. No production MFA/CDN/publishing verification was performed. Owner business decisions and later deployed checks remain in the audit report.

The exact path list and SHA-256 release snapshot are retained in the external focused-audit review evidence and ignored data/focused-audit-2026-10-07/. Existing historical review material remains intact.
