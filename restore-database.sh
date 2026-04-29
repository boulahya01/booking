set -euo pipefail


if [ -z "${SUPABASE_DB_URL:-}" ]; then
  if [ -f .env.local ]; then
    SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env.local | sed -E 's/^SUPABASE_DB_URL=//')
  fi
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set."
  echo "Set SUPABASE_DB_URL in your environment or in .env.local."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is not installed. Install PostgreSQL client tools first."
  exit 1
fi

echo "Using SUPABASE_DB_URL=${SUPABASE_DB_URL}"

MIGRATION_DIR="supabase/migrations"
MIGRATIONS=("${MIGRATION_DIR}"/*.sql)

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  echo "ERROR: no migrations found in ${MIGRATION_DIR}"
  exit 1
fi

echo "Applying ${#MIGRATIONS[@]} migration files in lexicographic order..."

for migration in "${MIGRATIONS[@]}"; do
  echo "\n--- Applying: ${migration} ---"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$migration"
  echo "Completed: ${migration}"
done

echo "\nDatabase restore complete."
