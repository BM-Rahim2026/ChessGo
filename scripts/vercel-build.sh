#!/bin/sh
# Build on Vercel: apply database migrations, then build the app.
# Accepts our own variable names or the ones Vercel's Supabase integration creates.
set -e
export DATABASE_URL="${DATABASE_URL:-$POSTGRES_PRISMA_URL}"
export DIRECT_URL="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -z "$DATABASE_URL" ]; then
  echo "No database configured: set DATABASE_URL (or connect Supabase under Vercel > Storage)." >&2
  exit 1
fi
npx prisma migrate deploy
npx next build
