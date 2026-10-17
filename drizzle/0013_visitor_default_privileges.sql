-- Future public tables and sequences are not granted to visitor roles
-- (security review follow-up, 17 October 2026).
--
-- Supabase's default privileges gave anon and authenticated every table
-- privilege (including TRUNCATE) and USAGE/SELECT/UPDATE on sequences for
-- any object postgres creates in public, so a new table was writable from
-- the Data API until its migration revoked that. The website never reads or
-- writes tables through the Data API (it uses the trusted server connection
-- as postgres), so new objects get no visitor privileges by default; a
-- migration that wants visitors to read a table grants SELECT explicitly,
-- as 0012 does.
--
-- Scope: objects created by postgres in public only. Existing tables and
-- sequences, their grants, RLS and policies are unchanged; service_role and
-- postgres keep their defaults. supabase_admin's defaults and the
-- Supabase-managed schemas are left alone. Function EXECUTE also stays as it
-- is (PostgreSQL grants it to PUBLIC, so a role-level revoke would not
-- change it). Idempotent.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
