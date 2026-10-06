-- Garland management: garlands become ordinary `products` rows (same
-- editor, images, pricing, status and storefront price channel as every
-- bouquet) plus garland-only facts. Purely additive — no existing table or
-- row is altered, so bouquets are untouched.
--
--   garland_details          one row per garland: the stable public design
--                            code (FP-G…, immutable), sold unit, length,
--                            flowers, thickness, finish, preparation time,
--                            substitution policy, selling mode and the
--                            photo-permission / sample-verification approvals.
--                            Unknown facts stay NULL.
--   product_garland_filters  Rose / Tuberose / Lotus / Designer-Mixed browsing
--                            filters (junction table, no arrays).
--   product_options          generic option values with an optional extra
--                            charge (e.g. Finish: Gold tassels, +₹500).
--
-- Data is loaded separately and idempotently by scripts/seed-garlands.mjs.
CREATE TYPE "public"."garland_filter" AS ENUM('rose', 'tuberose', 'lotus', 'designer-mixed');--> statement-breakpoint
CREATE TYPE "public"."garland_unit" AS ENUM('single', 'pair', 'set');--> statement-breakpoint
CREATE TYPE "public"."garland_selling_mode" AS ENUM('enquiry', 'cart');--> statement-breakpoint
CREATE TYPE "public"."photo_permission" AS ENUM('unconfirmed', 'granted', 'refused');--> statement-breakpoint
CREATE TABLE "garland_details" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"design_code" text NOT NULL,
	"sold_unit" "garland_unit",
	"length" text,
	"flower_recipe" text,
	"thickness" text,
	"finish" text,
	"lead_time" text,
	"substitution_policy" text,
	"selling_mode" "garland_selling_mode" DEFAULT 'enquiry' NOT NULL,
	"ready_for_sale" boolean DEFAULT false NOT NULL,
	"photo_permission" "photo_permission" DEFAULT 'unconfirmed' NOT NULL,
	"sample_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garland_details_design_code_unique" UNIQUE("design_code"),
	CONSTRAINT "garland_details_design_code_format" CHECK ("design_code" ~ '^FP-G[0-9]{3,}$')
);
--> statement-breakpoint
CREATE TABLE "product_garland_filters" (
	"product_id" integer NOT NULL,
	"filter" "garland_filter" NOT NULL,
	CONSTRAINT "product_garland_filters_product_id_filter_pk" PRIMARY KEY("product_id","filter")
);
--> statement-breakpoint
CREATE TABLE "product_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"option_name" text NOT NULL,
	"value_label" text NOT NULL,
	"extra_charge" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_options_extra_charge_non_negative" CHECK ("extra_charge" IS NULL OR "extra_charge" >= 0)
);
--> statement-breakpoint
ALTER TABLE "garland_details" ADD CONSTRAINT "garland_details_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_garland_filters" ADD CONSTRAINT "product_garland_filters_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_options_product_id" ON "product_options" USING btree ("product_id");--> statement-breakpoint
-- A design code is the garland's permanent public identity: it can be set
-- once and never changed, whatever writes to the table.
CREATE FUNCTION "public"."garland_design_code_is_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.design_code IS DISTINCT FROM OLD.design_code THEN
    RAISE EXCEPTION 'garland design code % cannot be changed', OLD.design_code USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    RAISE EXCEPTION 'garland % cannot be moved to another product', OLD.design_code USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "garland_details_identity_guard" BEFORE UPDATE ON "garland_details"
  FOR EACH ROW EXECUTE FUNCTION "public"."garland_design_code_is_immutable"();--> statement-breakpoint
-- Row Level Security, same shape as drizzle/0001_enable_rls.sql: the app
-- connects as a BYPASSRLS role; anon/authenticated (PostgREST) may only read
-- rows belonging to a published product.
ALTER TABLE "garland_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_garland_filters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "public_read_garland_details_of_published_products" ON "garland_details"
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = garland_details.product_id AND p.status = 'published'));--> statement-breakpoint
CREATE POLICY "public_read_garland_filters_of_published_products" ON "product_garland_filters"
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_garland_filters.product_id AND p.status = 'published'));--> statement-breakpoint
CREATE POLICY "public_read_options_of_published_products" ON "product_options"
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_options.product_id AND p.status = 'published'));
