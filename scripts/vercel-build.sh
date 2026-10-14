#!/usr/bin/env bash
# Vercel's build step (package.json "vercel-build"): verify the database schema is current, then build.
#
# Admin credentials are deliberately NOT on Vercel (DECISIONS.md), so the build never migrates anything.
# Migrations are applied by hand with the owner role, before the code that needs them is merged. On a
# Production build this script only VERIFIES that nothing is pending, with the runtime connection the
# build already has (DATABASE_URL, role hub_app, which can read _prisma_migrations):
#   - `prisma migrate status` is read-only. It exits non-zero when a migration is pending (or failed), or
#     when the migration table cannot be read; in either case the build fails here, before `next build`,
#     so the previous deployment stays live instead of new code going out against an old schema.
# Preview builds skip the check: a preview is allowed to be ahead of the database.
set -uo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "vercel-build: DATABASE_URL is not set for the Production build, so the migration check cannot run." >&2
    exit 1
  fi
  # prisma.config.ts reads DATABASE_ADMIN_URL first and falls back to DATABASE_URL. Admin credentials are not on
  # Vercel, but if one were ever added, the check must still use the runtime connection, never the owner role.
  unset DATABASE_ADMIN_URL
  # The runtime DATABASE_URL may be a pooled (Neon "-pooler") URL. Prisma Migrate needs a direct connection (it takes an
  # advisory lock a transaction-mode pooler cannot keep), so when DATABASE_DIRECT_URL is set the check uses it instead.
  # Unset, the check uses DATABASE_URL, as before.
  if [ -n "${DATABASE_DIRECT_URL:-}" ]; then
    export DATABASE_URL="$DATABASE_DIRECT_URL"
    echo "vercel-build: the migration check uses DATABASE_DIRECT_URL"
  fi
  echo "vercel-build: checking that no migration is pending (prisma migrate status, read-only)"
  status_output="$(npx prisma migrate status 2>&1)"
  status_code=$?
  echo "$status_output"
  if [ "$status_code" -ne 0 ]; then
    echo >&2
    if echo "$status_output" | grep -q "have not yet been applied"; then
      echo "vercel-build: Pending migration: apply it with the owner role before deploying (see DECISIONS.md, \"How migrations reach production\")." >&2
    else
      echo "vercel-build: could not confirm the schema is current (see the output above). If the runtime role cannot read _prisma_migrations, grant it with the owner role: GRANT SELECT ON \"_prisma_migrations\" TO hub_app;" >&2
    fi
    exit 1
  fi
  echo "vercel-build: the database schema is current"
else
  echo "vercel-build: skipping the migration check (VERCEL_ENV=${VERCEL_ENV:-unset}); only Production builds verify"
fi

exec npx next build
