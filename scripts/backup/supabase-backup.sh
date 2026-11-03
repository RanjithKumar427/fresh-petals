#!/usr/bin/env bash
# Read-only backup of the production Supabase project (hjhmetomcaskrrwkgrbp)
# before the Cloudflare cutover. Writes OUTSIDE the repository.
#
#   SUPABASE_DB_URL='postgresql://postgres.hjhmetomcaskrrwkgrbp:…@aws-0-…pooler.supabase.com:5432/postgres' \
#   SUPABASE_URL=https://hjhmetomcaskrrwkgrbp.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
#   scripts/backup/supabase-backup.sh [/secure/backup/dir]
#
# Use the SESSION pooler (port 5432) or the direct connection, not the
# transaction pooler (6543): pg_dump needs a session. pg_dump/psql must be at
# least the server's major version. Nothing here writes to the database or to
# Storage. Exit status is non-zero on any failure; a partial directory is then
# not a backup.
#
# Consistency: the database dump is one snapshot. The inventory is taken
# before and after it, and Storage is read after it, so a write that lands
# during the run is reported (inventory differs) rather than hidden. Storage
# files and database rows are not captured at the same instant.
set -euo pipefail
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (session pooler, port 5432)}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
case "$SUPABASE_DB_URL" in *hjhmetomcaskrrwkgrbp*) ;; *) echo "Refusing: SUPABASE_DB_URL is not project hjhmetomcaskrrwkgrbp" >&2; exit 1;; esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ROOT="$(realpath -m "${1:-$HOME/fresh-petals-backups}")"
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -n "$REPO" ] && { [ "$ROOT" = "$REPO" ] || [ "${ROOT#"$REPO"/}" != "$ROOT" ]; }; then
  echo "Refusing: backup directory $ROOT is inside the repository" >&2; exit 1
fi
OUT="$ROOT/$STAMP"
umask 077
mkdir -p "$OUT"
echo "Backup → $OUT"

inventory() {
  psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT 'exact_count', table_schema || '.' || table_name,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 2;
SELECT 'auth', 'users', count(*)::text FROM auth.users;
SELECT 'auth', 'identities', count(*)::text FROM auth.identities;
SELECT 'auth', 'mfa_factors', count(*)::text FROM auth.mfa_factors;
SELECT 'storage_objects', bucket_id, count(*)::text FROM storage.objects GROUP BY bucket_id ORDER BY 2;
SELECT 'storage_bytes', bucket_id, coalesce(sum((metadata->>'size')::bigint), 0)::text FROM storage.objects GROUP BY bucket_id ORDER BY 2;
SELECT 'latest', 'public.inquiries', coalesce(max(created_at)::text, '-') FROM public.inquiries;
COMMIT;
SQL
}

# 1. Inventory, database snapshot, inventory again.
{ echo -e "taken_at\t$(date -u +%FT%TZ)\t"; inventory; } > "$OUT/inventory.tsv"
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --file="$OUT/database.dump"
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --schema=public --file="$OUT/public-schema.sql"
pg_restore --list "$OUT/database.dump" > "$OUT/database.toc"
{ echo -e "taken_at\t$(date -u +%FT%TZ)\t"; inventory; } > "$OUT/inventory-after.tsv"
if diff <(grep -v '^taken_at' "$OUT/inventory.tsv") <(grep -v '^taken_at' "$OUT/inventory-after.tsv") > "$OUT/inventory.diff"; then
  rm "$OUT/inventory.diff"; echo "Inventory unchanged during the dump."
else
  echo "WARNING: data changed while the dump ran (see inventory.diff). The dump is still one consistent snapshot; compare it with inventory-after.tsv." >&2
fi

# 2. Storage objects with their paths, sizes and SHA-256, checked against storage.objects.
node "$(dirname "$0")/storage-backup.mjs" "$OUT/storage" "$OUT/inventory-after.tsv"

# 3. Integrity.
( cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
echo "Done. Verify with: (cd '$OUT' && sha256sum -c SHA256SUMS) and scripts/backup/restore-rehearsal.sh '$OUT'"
echo "This directory holds password hashes, MFA secrets and customer enquiries: encrypt it (e.g. gpg --symmetric) and keep it off shared drives."
