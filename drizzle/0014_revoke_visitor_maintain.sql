-- Removes MAINTAIN from visitor roles on existing public tables
-- (staging schema verification, 4 November 2026).
--
-- PostgreSQL 17 added MAINTAIN (VACUUM, ANALYZE, REINDEX, CLUSTER, REFRESH
-- MATERIALIZED VIEW, LOCK TABLE). Supabase's default privileges include it, and
-- on staging saving "Automatically expose new tables" off still leaves it. 0012
-- lists the privileges it revokes by name and predates this check, so visitors
-- kept MAINTAIN on every table the earlier migrations created.
-- information_schema.role_table_grants does not list MAINTAIN, so a grant
-- inventory cannot show this: ask has_table_privilege(role, table, 'MAINTAIN').
--
-- It does not let visitors read or change rows, and the Data API offers no route
-- to these commands, but no visitor needs it.
--
-- Scope: existing public tables, anon and authenticated only. Future tables are
-- already covered, because 0013 revokes ALL in the default privileges.
-- service_role and postgres are unchanged. Idempotent. Requires PostgreSQL 17
-- or later.

REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
