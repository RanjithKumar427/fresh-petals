#!/usr/bin/env bash
# Restore rehearsal of a backup's application data into a THROWAWAY local
# Postgres (never the production project), then compare row counts with the
# inventory taken at backup time.
#
#   REHEARSAL_DB_URL=postgresql://postgres:pw@127.0.0.1:55440/rehearsal scripts/backup/restore-rehearsal.sh <backupDir>
#
# Covers the public schema (catalogue, enquiries, admin links, media records).
# Auth and Storage schemas depend on Supabase-managed roles and extensions and
# are verified by pg_restore --list only ("export verified", not "restore tested").
set -euo pipefail
DIR="${1:?backup directory}"
: "${REHEARSAL_DB_URL:?set REHEARSAL_DB_URL to a local throwaway database}"
case "$REHEARSAL_DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Refusing: rehearsal database must be local" >&2; exit 1;; esac
(cd "$DIR" && sha256sum -c --quiet SHA256SUMS)
psql "$REHEARSAL_DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
SQL
pg_restore --no-owner --no-privileges --schema=public --dbname="$REHEARSAL_DB_URL" "$DIR/database.dump"
fail=0
while IFS=$'\t' read -r kind name count; do
  [ "$kind" = exact_count ] || continue
  got=$(psql "$REHEARSAL_DB_URL" -X -At -c "select count(*) from $name")
  if [ "$got" = "$count" ]; then echo "OK   $name $got"; else echo "DIFF $name backup=$count restored=$got"; fail=1; fi
done < "$DIR/inventory.tsv"
grep -c "TABLE DATA auth " "$DIR/database.toc" | xargs -I{} echo "auth table-data entries in dump: {}"
grep -c "TABLE DATA storage " "$DIR/database.toc" | xargs -I{} echo "storage table-data entries in dump: {}"
exit $fail
