# Homepage flow — 10 October 2026

Based on release `6091131`. The homepage now puts a small, comparable bouquet
selection before the occasion carousel; the bouquet category keeps the full range.

1. Factual delivery strip and compact homepage header. On phones: menu, centred
   wordmark and basket; the menu retains every existing destination.
2. Full-width campaign hero (12 October 2026, `HeroAtelier.astro`): three
   campaign photographs — bouquets, wedding garlands, pooja flowers — with HTML
   copy over the open left side, two small photo prints linking to the other
   campaigns, hand-drawn SVG accents, light pointer/scroll parallax, and an ivory
   shortcut strip across the hero's lower edge. Slides and destinations are
   `getHeroCampaigns` in `src/data/atelierHome.ts`; the photographs are campaign
   imagery, so none carries a product name or price. Originals are in
   `src/assets/hero/`; `node scripts/hero-campaign-images.mjs` writes the
   AVIF/WebP sizes to `public/images/hero/`. The garland slide and every garland
   button appear only while garlands are public. Strip shortcuts still follow
   admin assignments; the budget shortcut uses the existing published-price filter.
3. Four featured bouquets: Red Affair, Timeless Hug, Colourful Confession and
   Blush Lily Letter. Equal portrait cards, two columns on phones/tablets and
   four on desktop, with the existing basket action. The view-all count comes
   from the complete launch range, currently eight.
4. Existing cinematic occasion carousel.
5. Existing bouquet photographs, close-ups and recorded inclusions.
6. Existing four-step WhatsApp ordering explanation.
7. Five homepage questions: areas, dates, delivery charges, substitutions and payment.
   Full FAQs and policies remain linked.
8. Existing personal invitation and footer.

The old reviews component contains Hyderabad testimonials without supporting
records in this checkout. It is not added to the Bengaluru homepage. Genuine
customer reviews can sit between bouquet details and the ordering explanation
when supplied.

## Verification

- Production-mode build passed using the isolated local fixture. No production
  database credentials or writes were used.
- Source regressions: 18 passed, including selection eligibility, fewer than
  four available designs, price preservation and the existing occasion rules.
- Browser checks: 212 passed at 375, 390, 768, 1024 and 1440px, plus reduced
  motion and JavaScript disabled. Covered section order, images, overflow,
  portrait geometry, navigation, carousel controls, product/category links,
  displayed prices, basket additions/merging and the header basket count.
- `astro check`: the same 20 existing errors in DiscoveryPostCard,
  MobileBottomBar and SubscriptionConfigurator; those files are unchanged.
- Desktop/mobile screenshots were inspected. Safari and physical devices
  were not tested.

Pricing, admin assignments, cache invalidation, occasion pages and order APIs
are unchanged. There are no schema, dependency or production configuration changes.
