-- Least-privilege visitor roles (security review, 16 October 2026).
--
-- Already applied to production through Supabase on 16 October 2026 as
-- migration 20261016172741_security_least_privilege_2026_10_16; the
-- statements below are that migration's recorded text, unchanged. The
-- Drizzle ledger (drizzle.__drizzle_migrations) did not record it, so the
-- next `npm run db:migrate` runs this file once more: every statement is
-- idempotent (REVOKE/GRANT of the same privileges, ALTER FUNCTION SET), so
-- that run changes nothing and only adds the ledger entry. One caveat: the
-- column grant below lists the columns products/media have at run time, so
-- if either table has gained a column since 16 October, decide first
-- whether visitors may read it.
--
-- Never "fix" a permission problem by restoring visitor write grants: the
-- website writes through the trusted server connection, not the Data API.

-- Website writes use the server's trusted Postgres connection. Data API
-- visitors must never acquire write/DDL privileges, even if a later RLS
-- policy is accidentally permissive. RLS and the existing read policies stay.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
--> statement-breakpoint

-- These tables hold private admin/customer data and have no public policies.
REVOKE SELECT ON public.admin_users, public.inquiries FROM PUBLIC, anon, authenticated;
--> statement-breakpoint

-- Row filtering does not protect columns. Replace blanket SELECT with an
-- explicit list of the current public columns, leaving internal costs and
-- uploader identities unreadable. Existing RLS predicates can still read
-- products.id/status. Future columns get no implicit visitor SELECT grant.
REVOKE SELECT ON public.products, public.media FROM PUBLIC, anon, authenticated;
REVOKE SELECT (cost_price) ON public.products FROM PUBLIC, anon, authenticated;
REVOKE SELECT (uploaded_by) ON public.media FROM PUBLIC, anon, authenticated;
DO $security$
DECLARE
  table_name text;
  public_columns text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['products', 'media'] LOOP
    SELECT pg_catalog.string_agg(pg_catalog.quote_ident(a.attname), ', ' ORDER BY a.attnum)
      INTO public_columns
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = pg_catalog.to_regclass('public.' || table_name)
        AND a.attnum > 0 AND NOT a.attisdropped
        AND NOT (table_name = 'products' AND a.attname = 'cost_price')
        AND NOT (table_name = 'media' AND a.attname = 'uploaded_by');
    EXECUTE pg_catalog.format('GRANT SELECT (%s) ON TABLE public.%I TO anon, authenticated', public_columns, table_name);
  END LOOP;
END;
$security$;
--> statement-breakpoint

-- The trigger only examines NEW/OLD. An empty search path closes namespace
-- substitution without changing the design-code immutability rule.
ALTER FUNCTION public.garland_design_code_is_immutable() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.garland_design_code_is_immutable() FROM PUBLIC, anon, authenticated;

