#!/bin/sh
# Build on Vercel: apply database migrations, then build the app.
# Accepts DATABASE_URL / DIRECT_URL, or the variables Vercel's Supabase integration creates
# (POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING / POSTGRES_URL), with or without a custom prefix.
set -e

find_var() { # first env var whose NAME ends with $1
  name=$(env | sed -n "s/^\([A-Za-z0-9_]*$1\)=.*/\1/p" | head -n 1)
  [ -n "$name" ] && printenv "$name" || true
}

[ -z "$DATABASE_URL" ] && DATABASE_URL=$(find_var POSTGRES_PRISMA_URL)
[ -z "$DATABASE_URL" ] && DATABASE_URL=$(find_var POSTGRES_URL)
[ -z "$DIRECT_URL" ] && DIRECT_URL=$(find_var POSTGRES_URL_NON_POOLING)
[ -z "$DIRECT_URL" ] && DIRECT_URL="$DATABASE_URL"
export DATABASE_URL DIRECT_URL

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: No database configured." >&2
  echo "Connect Supabase under Vercel > Storage (or set DATABASE_URL), then redeploy." >&2
  echo "Database-related variable NAMES this build can see:" >&2
  env | grep -v '=$' | sed -n 's/^\([A-Za-z0-9_]*\(POSTGRES\|DATABASE\|SUPABASE\)[A-Za-z0-9_]*\)=.*/  \1/p' >&2
  exit 1
fi
echo "Database: $(echo "$DATABASE_URL" | sed 's#//[^@]*@#//***@#')"
npx prisma migrate deploy
npx next build
