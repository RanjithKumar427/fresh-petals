#!/usr/bin/env bash
# Restore rehearsal of a backup's application data into a THROWAWAY local
# Postgres (never the production project), then compare exact row counts with
# the inventory taken right after the dump (inventory-after.tsv).
#
#   REHEARSAL_DB_URL=postgresql://postgres:pw@127.0.0.1:55440/rehearsal scripts/backup/restore-rehearsal.sh <backupDir>
#
# Covers the public schema (catalogue, enquiries, admin links, media records):
# "restore tested" when every count matches. Auth and Storage schemas depend
# on Supabase-managed roles, extensions and services; they are checked only
# for presence in the dump ("export verified", not "restore tested").
set -euo pipefail
DIR="${1:?backup directory}"
: "${REHEARSAL_DB_URL:?set REHEARSAL_DB_URL to a local throwaway database}"
case "$REHEARSAL_DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Refusing: rehearsal database must be local" >&2; exit 1;; esac
case "$REHEARSAL_DB_URL" in *hjhmetomcaskrrwkgrbp*|*supabase*) echo "Refusing: rehearsal database looks like Supabase" >&2; exit 1;; esac
(cd "$DIR" && sha256sum -c --quiet SHA256SUMS) || { echo "Checksum verification FAILED: the backup is altered or incomplete" >&2; exit 1; }
echo "Checksums OK"
psql "$REHEARSAL_DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
-- Stand-ins for Supabase's auth helpers that row-level-security policies may call.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT NULL::text';
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT NULL::jsonb';
SQL
set +e
pg_restore --no-owner --no-privileges --schema=public --dbname="$REHEARSAL_DB_URL" "$DIR/database.dump" 2> "$DIR.restore-errors.log"
restore=$?
set -e
errors=$(grep -c '^pg_restore: error' "$DIR.restore-errors.log" || true)
echo "pg_restore exit $restore, $errors error(s) (details: $DIR.restore-errors.log)"
inventory="$DIR/inventory-after.tsv"; [ -f "$inventory" ] || inventory="$DIR/inventory.tsv"
fail=0; checked=0
while IFS=$'\t' read -r kind name count; do
  [ "$kind" = exact_count ] || continue
  checked=$((checked + 1))
  got=$(psql "$REHEARSAL_DB_URL" -X -At -c "select count(*) from $name" 2>/dev/null || echo missing)
  if [ "$got" = "$count" ]; then echo "OK   $name $got"; else echo "DIFF $name backup=$count restored=$got"; fail=1; fi
done < "$inventory"
[ "$checked" -gt 0 ] || { echo "No exact counts in $inventory" >&2; fail=1; }
echo "auth table-data entries in dump: $(grep -c 'TABLE DATA auth ' "$DIR/database.toc" || true)"
echo "storage table-data entries in dump: $(grep -c 'TABLE DATA storage ' "$DIR/database.toc" || true)"
if [ "$fail" = 0 ]; then echo "RESULT: public schema restore tested ($checked tables match)"; else echo "RESULT: restore rehearsal FAILED"; fi
exit $fail
