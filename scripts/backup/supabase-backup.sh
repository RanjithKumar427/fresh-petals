#!/usr/bin/env bash
# Read-only backup of the production Supabase project (hjhmetomcaskrrwkgrbp)
# before the Cloudflare cutover. Writes OUTSIDE the repository.
#
#   SUPABASE_DB_URL='postgresql://postgres.hjhmetomcaskrrwkgrbp:…@aws-0-…pooler.supabase.com:5432/postgres' \
#   SUPABASE_URL=https://hjhmetomcaskrrwkgrbp.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
#   scripts/backup/supabase-backup.sh [/secure/backup/dir]
#
# Use the SESSION pooler (port 5432) or the direct connection, not the
# transaction pooler (6543): pg_dump needs a session. Nothing here writes to
# the database or to Storage. Requires pg_dump/psql 15+ and Node 24.
set -euo pipefail
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL (session pooler, port 5432)}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
case "$SUPABASE_DB_URL" in *hjhmetomcaskrrwkgrbp*) ;; *) echo "Refusing: SUPABASE_DB_URL is not project hjhmetomcaskrrwkgrbp" >&2; exit 1;; esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ROOT="${1:-$HOME/fresh-petals-backups}"
OUT="$ROOT/$STAMP"
case "$(cd "$(dirname "$ROOT")" 2>/dev/null && pwd)/" in "$(git rev-parse --show-toplevel 2>/dev/null || echo /nonexistent)"/*) echo "Refusing: backup directory is inside the repository" >&2; exit 1;; esac
umask 077
mkdir -p "$OUT"
echo "Backup → $OUT"

# 1. Timestamped inventory (read-only queries).
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' > "$OUT/inventory.tsv" <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 'taken_at', now()::text;
SELECT 'table', schemaname || '.' || relname, n_live_tup::text FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY 2;
SELECT 'exact_count', 'public.inquiries', count(*)::text FROM public.inquiries;
SELECT 'exact_count', 'public.products', count(*)::text FROM public.products;
SELECT 'auth', 'users', count(*)::text FROM auth.users;
SELECT 'auth', 'mfa_factors', count(*)::text FROM auth.mfa_factors;
SELECT 'storage', bucket_id, count(*)::text || ' objects, ' || coalesce(sum((metadata->>'size')::bigint), 0)::text || ' bytes' FROM storage.objects GROUP BY bucket_id ORDER BY 2;
SELECT 'latest_inquiry', coalesce(max(created_at)::text, '-'), '' FROM public.inquiries;
COMMIT;
SQL

# 2. Database: application data, Auth users/identities/MFA factors, Storage
#    object metadata. Custom format, restorable table by table.
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --file="$OUT/database.dump"
pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --schema=public --file="$OUT/public-schema.sql"
pg_restore --list "$OUT/database.dump" > "$OUT/database.toc"

# 3. Storage objects with their paths, sizes and SHA-256.
node "$(dirname "$0")/storage-backup.mjs" "$OUT/storage"

# 4. Integrity.
( cd "$OUT" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )
echo "Done. Verify with: (cd '$OUT' && sha256sum -c SHA256SUMS) and scripts/backup/restore-rehearsal.sh '$OUT'"
echo "This directory holds password hashes, MFA secrets and customer enquiries: encrypt it (e.g. gpg --symmetric) and keep it off shared drives."
