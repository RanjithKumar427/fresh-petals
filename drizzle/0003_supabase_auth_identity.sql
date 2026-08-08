-- Phase 2B.3: retire the app's own credential/session storage in favor of
-- Supabase Auth. Schema structure only — no admin data is inserted here
-- (that's scripts/link-admin-identity.mjs, run separately, specifically
-- so a real admin email address never ends up hardcoded in a versioned
-- migration file).
--
-- sessions: dropped outright, not deprecated-in-place. Supabase Auth's own
-- JWT + refresh-token pair (held in an httpOnly cookie via @supabase/ssr)
-- replaces its exact function -- two session mechanisms coexisting was
-- never the goal.
DROP TABLE IF EXISTS sessions;
--> statement-breakpoint

-- media.uploaded_by: verified zero non-null values before writing this
-- migration (checked live against production data) -- safe to change type
-- without a data-preserving USING cast.
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_uploaded_by_admin_users_id_fk;
--> statement-breakpoint
ALTER TABLE media ALTER COLUMN uploaded_by TYPE uuid USING NULL;
--> statement-breakpoint

-- admin_users: rebuilt as a profile/role table keyed 1:1 by auth.users.id
-- (Supabase's standard "profiles" pattern) rather than an independent
-- identity with its own password hash. The single existing row (the real
-- admin) is preserved by scripts/link-admin-identity.mjs immediately after
-- this migration applies -- identity is preserved, not regenerated, same
-- "identity is sacred" principle this project has followed since Phase 2A,
-- just carried out as a separate, PII-free step here.
DROP TABLE IF EXISTS admin_users;
--> statement-breakpoint

CREATE TABLE admin_users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
--> statement-breakpoint

ALTER TABLE media ADD CONSTRAINT media_uploaded_by_admin_users_id_fk
  FOREIGN KEY (uploaded_by) REFERENCES admin_users(id) ON DELETE SET NULL;
