-- Row Level Security, Phase 2A.
--
-- Why this matters even though nothing reads Postgres yet: Supabase
-- auto-exposes every table in the `public` schema over its PostgREST REST
-- API the moment it exists, to anyone holding the project's publishable
-- (anon) key -- a key that is *meant* to be safe in browser code precisely
-- because RLS is supposed to restrict what it can see/do. Without RLS
-- enabled, that key currently grants full read/write on all 15 tables just
-- created. This closes that gap immediately, independent of whether the
-- application itself has started using Postgres.
--
-- What this migration does NOT do, on purpose: it does not add
-- "authenticated admin full CRUD" policies. There is no Supabase Auth
-- identity yet -- admin auth is still this app's own AdminUserRepository +
-- opaque session tokens (see src/server/services/AuthService.ts), and the
-- application's own Postgres access (Drizzle via client.ts, and every
-- script in this migration) connects as the `postgres` role through the
-- Transaction Pooler, which -- like `service_role` -- has BYPASSRLS and is
-- unaffected by every policy below regardless of what it says. Writing an
-- `authenticated`-role admin policy now would either be dead code (nobody
-- currently authenticates as a Supabase `authenticated` user) or a false
-- promise of a capability this codebase doesn't have. That's Phase 5's
-- job, when Supabase Auth actually becomes the identity provider -- see
-- docs/architecture/supabase-migration.md.
--
-- Policy shape, table by table:
--   admin_users, sessions        -- RLS enabled, zero policies. Credentials
--                                    (password hashes, session tokens) are
--                                    never readable through PostgREST by
--                                    anon/authenticated, full stop.
--   categories, occasions,
--   moods, flower_types, media   -- RLS enabled, unconditional public SELECT.
--                                    Pure taxonomy/asset metadata, nothing
--                                    a "draft" concept applies to.
--   products                     -- RLS enabled, public SELECT gated on
--                                    status = 'published'.
--   product_variants,
--   product_images,
--   product_occasions,
--   product_moods,
--   product_flower_types,
--   product_whats_included,
--   product_care_instructions    -- RLS enabled, public SELECT gated on the
--                                    parent product being published (an
--                                    EXISTS join back to products).
--
-- No INSERT/UPDATE/DELETE policies are added for anon/authenticated on any
-- table: with RLS enabled and no policy for a command, Postgres denies
-- that command outright for that role. That absence of a write policy IS
-- the "public read-only" guarantee -- there's nothing else to add.

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE flower_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_flower_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_whats_included ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_care_instructions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "public_read_categories" ON categories
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "public_read_occasions" ON occasions
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "public_read_moods" ON moods
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "public_read_flower_types" ON flower_types
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "public_read_media" ON media
  FOR SELECT TO anon, authenticated USING (true);
--> statement-breakpoint

CREATE POLICY "public_read_published_products" ON products
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
--> statement-breakpoint

CREATE POLICY "public_read_variants_of_published_products" ON product_variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_images_of_published_products" ON product_images
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_images.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_occasions_of_published_products" ON product_occasions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_occasions.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_moods_of_published_products" ON product_moods
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_moods.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_flower_types_of_published_products" ON product_flower_types
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_flower_types.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_whats_included_of_published_products" ON product_whats_included
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_whats_included.product_id AND p.status = 'published'
  ));
--> statement-breakpoint
CREATE POLICY "public_read_care_instructions_of_published_products" ON product_care_instructions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_care_instructions.product_id AND p.status = 'published'
  ));
