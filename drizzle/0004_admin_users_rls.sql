-- admin_users had RLS enabled (zero policies) as of Phase 2A's own RLS
-- migration -- fully locked to service-role/postgres, never readable via
-- PostgREST by anon/authenticated, since it (still) holds no password
-- anymore but does hold real admin identity/email data that has no
-- business being publicly queryable. Recreating the table in
-- 0003_supabase_auth_identity.sql (DROP + CREATE, not ALTER) reset RLS to
-- its Postgres default (disabled) -- a fresh CREATE TABLE never inherits
-- the RLS state of whatever it replaced. Restored here, deliberately
-- still with zero policies, matching the original posture exactly.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
