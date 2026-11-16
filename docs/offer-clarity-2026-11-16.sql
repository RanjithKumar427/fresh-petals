-- Offer clarity, 16 Nov 2026 (branch content/offer-clarity-2026-11).
-- Aligns the admin product records with the storefront copy changed in
-- src/data/productCatalog.ts. On Cloudflare builds the dashboard's name, short
-- description and long description replace the catalogue entry's
-- (src/data/dashboardCatalogue.ts), so these copy changes appear only once the
-- records match. NOT APPLIED: run in one transaction against production only
-- with the owner's approval, then publish (a build). Each statement is guarded
-- by the current value, so a record edited in the admin since is left alone
-- (check the row counts). Rollback is at the end.

BEGIN;
UPDATE products SET short_description = 'Gerberas, roses and daisies in a bright mixed bouquet, kraft-wrapped.' WHERE slug = 'colourful-confession' AND short_description = 'A colourful garden bouquet filled with cheerful mixed blooms.';
UPDATE products SET short_description = 'Yellow chrysanthemums and white daisies arranged in a glass vase.' WHERE slug = 'daisy-morning' AND short_description = 'A fresh yellow and white bouquet with a soft morning feel.';
UPDATE products SET description = 'Yellow chrysanthemums, white daisy-style fillers and white stock with fern greenery, arranged in a glass vase — for morning wishes and happy gifting.' WHERE slug = 'daisy-morning' AND description = 'A fresh bouquet with yellow chrysanthemums, white daisy-style fillers and soft green foliage — perfect for morning wishes and happy gifting.';
UPDATE products SET short_description = 'Sunflowers with fresh greenery, arranged in a glass vase.' WHERE slug = 'dear-sunshine' AND short_description = 'A bold sunflower bouquet for bright and happy gifting.';
UPDATE products SET description = 'Fresh sunflowers with greenery in a glass vase — for birthdays, congratulations and cheerful surprises.' WHERE slug = 'dear-sunshine' AND description = 'A sunny bouquet made with fresh sunflowers — perfect for birthdays, congratulations and warm cheerful surprises.';
UPDATE products SET short_description = 'Purple asters with green fillers in a soft, garden-style wrapped bouquet.' WHERE slug = 'lilac-garden' AND short_description = 'A lilac purple bouquet with a soft garden-style look.';
UPDATE products SET short_description = 'White oriental lilies and lily buds in kraft wrapping.' WHERE slug = 'lily-calm' AND short_description = 'A clean white lily bouquet with a calm premium feel.';
UPDATE products SET short_description = 'Yellow chrysanthemums with white baby’s breath, arranged in a glass vase.' WHERE slug = 'sunshine-confession' AND short_description = 'A cheerful yellow bouquet with soft white baby’s breath.';
UPDATE products SET description = 'Yellow chrysanthemums paired with white gypsophila in a glass vase — for birthdays, thank-you gifts and cheerful surprises.' WHERE slug = 'sunshine-confession' AND description = 'A bright yellow bouquet paired with white gypsophila — perfect for birthdays, thank-you gifts and cheerful surprises.';
UPDATE products SET short_description = 'Red, pink and yellow gerberas with fillers in a bright arrangement.' WHERE slug = 'sweet-petal-hour' AND short_description = 'A bright mixed gerbera bouquet for joyful gifting.';
UPDATE products SET description = 'A colourful arrangement of red, pink and yellow gerberas with purple fillers and greenery — for birthdays, celebrations and happy surprises.' WHERE slug = 'sweet-petal-hour' AND description = 'A colourful bouquet filled with red, pink and yellow gerberas with soft filler flowers — perfect for birthdays, celebrations and happy surprises.';
UPDATE products SET short_description = 'Yellow daisies with purple statice in a hand-tied bouquet.' WHERE slug = 'wild-sunset-charm' AND short_description = 'A bright yellow and purple bouquet with a wild garden feel.';
UPDATE products SET short_description = 'White lilies and lily buds in premium wrapping.' WHERE slug = 'all-white-fragrance' AND short_description = 'A premium white lily arrangement with a soft fragrant feel.';
UPDATE products SET description = 'White lilies and lily buds with greenery in premium wrapping, for elegant gifting, thank-you moments and peaceful wishes. The scent depends on the lily variety supplied; ask on WhatsApp if it matters.' WHERE slug = 'all-white-fragrance' AND description = 'A graceful white lily arrangement made for elegant gifting, peaceful wishes and premium floral moments.';
UPDATE products SET short_description = 'Lilies and lily buds arranged in a gift box.' WHERE slug = 'fragrance-festive-giftbox' AND short_description = 'A festive lily giftbox with a premium fragrant look.';
UPDATE products SET description = 'Lilies and lily buds with seasonal fillers arranged in a gift box, for festive gifting, birthdays, housewarmings and elegant surprises. The scent depends on the lily variety supplied; ask on WhatsApp if it matters.' WHERE slug = 'fragrance-festive-giftbox' AND description = 'A premium lily giftbox designed for festive gifting, birthdays, housewarming and elegant surprises.';
UPDATE products SET short_description = 'Blush lilies and lily buds in premium wrapping.' WHERE slug = 'blush-lily-letter' AND short_description = 'A blush-toned lily arrangement for sweet gifting.';
UPDATE products SET short_description = 'Coral lilies and lily buds in premium wrapping.' WHERE slug = 'coral-lily-bloom' AND short_description = 'A coral lily arrangement with a fresh bright bloom.';
UPDATE products SET short_description = 'Ivory lilies and lily buds in premium wrapping.' WHERE slug = 'ivory-lily-grace' AND short_description = 'An ivory lily arrangement with a graceful premium feel.';
UPDATE products SET short_description = 'Flower gift options under ₹1499, suggested from the day''s flowers.' WHERE slug = 'flower-gifts-under-1499' AND short_description = 'Popular flower gifting options under ₹1499.';
UPDATE products SET short_description = 'Made-to-order dried flower arrangement, with a vase option.' WHERE slug = 'dried-flower-vase-set' AND short_description = 'Dried flower arrangement with vase for premium decor.';
UPDATE products SET name = 'Flowerbox for Homes with Pets' WHERE slug = 'pet-friendly-flowerbox' AND name = 'Pet Friendly Flowerbox';
-- Expect 22 rows updated in total.
COMMIT;

-- Rollback (restores the values live before this release):
-- BEGIN;
-- UPDATE products SET short_description = 'A colourful garden bouquet filled with cheerful mixed blooms.' WHERE slug = 'colourful-confession' AND short_description = 'Gerberas, roses and daisies in a bright mixed bouquet, kraft-wrapped.';
-- UPDATE products SET short_description = 'A fresh yellow and white bouquet with a soft morning feel.' WHERE slug = 'daisy-morning' AND short_description = 'Yellow chrysanthemums and white daisies arranged in a glass vase.';
-- UPDATE products SET description = 'A fresh bouquet with yellow chrysanthemums, white daisy-style fillers and soft green foliage — perfect for morning wishes and happy gifting.' WHERE slug = 'daisy-morning' AND description = 'Yellow chrysanthemums, white daisy-style fillers and white stock with fern greenery, arranged in a glass vase — for morning wishes and happy gifting.';
-- UPDATE products SET short_description = 'A bold sunflower bouquet for bright and happy gifting.' WHERE slug = 'dear-sunshine' AND short_description = 'Sunflowers with fresh greenery, arranged in a glass vase.';
-- UPDATE products SET description = 'A sunny bouquet made with fresh sunflowers — perfect for birthdays, congratulations and warm cheerful surprises.' WHERE slug = 'dear-sunshine' AND description = 'Fresh sunflowers with greenery in a glass vase — for birthdays, congratulations and cheerful surprises.';
-- UPDATE products SET short_description = 'A lilac purple bouquet with a soft garden-style look.' WHERE slug = 'lilac-garden' AND short_description = 'Purple asters with green fillers in a soft, garden-style wrapped bouquet.';
-- UPDATE products SET short_description = 'A clean white lily bouquet with a calm premium feel.' WHERE slug = 'lily-calm' AND short_description = 'White oriental lilies and lily buds in kraft wrapping.';
-- UPDATE products SET short_description = 'A cheerful yellow bouquet with soft white baby’s breath.' WHERE slug = 'sunshine-confession' AND short_description = 'Yellow chrysanthemums with white baby’s breath, arranged in a glass vase.';
-- UPDATE products SET description = 'A bright yellow bouquet paired with white gypsophila — perfect for birthdays, thank-you gifts and cheerful surprises.' WHERE slug = 'sunshine-confession' AND description = 'Yellow chrysanthemums paired with white gypsophila in a glass vase — for birthdays, thank-you gifts and cheerful surprises.';
-- UPDATE products SET short_description = 'A bright mixed gerbera bouquet for joyful gifting.' WHERE slug = 'sweet-petal-hour' AND short_description = 'Red, pink and yellow gerberas with fillers in a bright arrangement.';
-- UPDATE products SET description = 'A colourful bouquet filled with red, pink and yellow gerberas with soft filler flowers — perfect for birthdays, celebrations and happy surprises.' WHERE slug = 'sweet-petal-hour' AND description = 'A colourful arrangement of red, pink and yellow gerberas with purple fillers and greenery — for birthdays, celebrations and happy surprises.';
-- UPDATE products SET short_description = 'A bright yellow and purple bouquet with a wild garden feel.' WHERE slug = 'wild-sunset-charm' AND short_description = 'Yellow daisies with purple statice in a hand-tied bouquet.';
-- UPDATE products SET short_description = 'A premium white lily arrangement with a soft fragrant feel.' WHERE slug = 'all-white-fragrance' AND short_description = 'White lilies and lily buds in premium wrapping.';
-- UPDATE products SET description = 'A graceful white lily arrangement made for elegant gifting, peaceful wishes and premium floral moments.' WHERE slug = 'all-white-fragrance' AND description = 'White lilies and lily buds with greenery in premium wrapping, for elegant gifting, thank-you moments and peaceful wishes. The scent depends on the lily variety supplied; ask on WhatsApp if it matters.';
-- UPDATE products SET short_description = 'A festive lily giftbox with a premium fragrant look.' WHERE slug = 'fragrance-festive-giftbox' AND short_description = 'Lilies and lily buds arranged in a gift box.';
-- UPDATE products SET description = 'A premium lily giftbox designed for festive gifting, birthdays, housewarming and elegant surprises.' WHERE slug = 'fragrance-festive-giftbox' AND description = 'Lilies and lily buds with seasonal fillers arranged in a gift box, for festive gifting, birthdays, housewarmings and elegant surprises. The scent depends on the lily variety supplied; ask on WhatsApp if it matters.';
-- UPDATE products SET short_description = 'A blush-toned lily arrangement for sweet gifting.' WHERE slug = 'blush-lily-letter' AND short_description = 'Blush lilies and lily buds in premium wrapping.';
-- UPDATE products SET short_description = 'A coral lily arrangement with a fresh bright bloom.' WHERE slug = 'coral-lily-bloom' AND short_description = 'Coral lilies and lily buds in premium wrapping.';
-- UPDATE products SET short_description = 'An ivory lily arrangement with a graceful premium feel.' WHERE slug = 'ivory-lily-grace' AND short_description = 'Ivory lilies and lily buds in premium wrapping.';
-- UPDATE products SET short_description = 'Popular flower gifting options under ₹1499.' WHERE slug = 'flower-gifts-under-1499' AND short_description = 'Flower gift options under ₹1499, suggested from the day''s flowers.';
-- UPDATE products SET short_description = 'Dried flower arrangement with vase for premium decor.' WHERE slug = 'dried-flower-vase-set' AND short_description = 'Made-to-order dried flower arrangement, with a vase option.';
-- UPDATE products SET name = 'Pet Friendly Flowerbox' WHERE slug = 'pet-friendly-flowerbox' AND name = 'Flowerbox for Homes with Pets';
-- COMMIT;
