# Move this project to a new repository

Goal: a new repository whose first and only commit is the current working tree, with no history. Nothing in the tree refers to the old product name, and the database schema is one baseline migration.

## 1. Check the tree

From the repository root, on the branch you will copy (after `clean-schema-baseline` is merged and pulled):

```bash
git status --short                      # must print nothing
npm run test:all                        # Docker Postgres only
grep -rIil "$(printf 'ip%s' id)" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=test-results --exclude-dir=playwright-report
```

The `grep` must print nothing. (The pattern is built with `printf` so this file does not contain the word it searches for.) `tests/unit/no-old-brand.test.ts` runs the same check on every `npm test`.

## 2. Copy the tree as one initial commit

`git archive` exports the tracked files of one commit and nothing else: no `.git`, no history, no `node_modules`, no `.env`, no build output.

```bash
mkdir ../NEW_REPO_NAME
git archive --format=tar HEAD | tar -x -C ../NEW_REPO_NAME
cd ../NEW_REPO_NAME

git init -b main
git config user.name  "Your Name"
git config user.email "you@example.com"      # the address you want on the commit
git add -A
git commit -m "Initial commit"
git log --oneline                           # exactly one commit

git remote add origin <URL of the new, empty repository>
git push -u origin main
```

Create the new repository empty (no README, licence or `.gitignore`) so the push is a plain first push.

Then in the new working tree:

```bash
npm ci
cp .env.example .env     # fill it in; .env is git-ignored
```

## 3. The database

- **Local (Docker):** `docker compose up -d` creates the roles `hub_owner` and `hub_app` (`docker/initdb/01-roles.sql`). Point `DATABASE_URL` (`hub_app`) and `DATABASE_ADMIN_URL` (`hub_owner`) in `.env` at it, then `npm run db:reset` (baseline migration, `prisma/grants.sql`, seed).
- **Hosted (Neon):** create the runtime role `hub_app` once (see `docker/initdb/01-roles.sql`; choose your own password). Then run `scripts/neon-rebuild.sql` by hand as the admin role:

  ```bash
  psql "$DATABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -f scripts/neon-rebuild.sql
  ```

  It drops and recreates the `public` schema, applies the baseline, records the baseline in Prisma's migration history and restores the `hub_app` grants, in one transaction. It destroys everything in the schema: only run it on a database you mean to rebuild. Afterwards load the demo data with `npm run db:seed` (with `DATABASE_ADMIN_URL` pointing at that database) and check `npx prisma migrate status` says the schema is up to date.
- `scripts/neon-rebuild.sql` is generated. After any change to the baseline migration or to `prisma/grants.sql`, run `npm run neon:rebuild-sql` and commit the result; `tests/unit/neon-rebuild.test.ts` fails when the file is stale.

## 4. Vercel project

Import the new repository as a new Vercel project (framework: Next.js). The build command comes from `package.json` (`vercel-build`): on a Production build it only checks that no migration is pending. Set these environment variables, names only; take the values from your own `.env` and database provider.

| Name | Needed | Note |
|---|---|---|
| `DATABASE_URL` | yes | Runtime connection, role `hub_app`. Production and Preview. On Neon use the pooled URL (`-pooler` host); the app opens one connection per function instance |
| `DATABASE_DIRECT_URL` | with a pooled `DATABASE_URL` | Direct (non-pooler) URL, same database and role. The Production build's migration check uses it. Unset, the check uses `DATABASE_URL` |
| `SESSION_SECRET` | yes | 32+ random characters |
| `DEMO_MODE` | yes for the demo | `true` shows the demo bar and "View as" |
| `DEMO_DEFAULT_USER_EMAIL` | demo | Session user with no cookie. If unset or inactive, the first active Admin is used |
| `DEMO_CLOCK_START` | demo | Pins the demo day. Production only, so previews keep live dates |
| `DEMO_CLOCK_ANCHOR` | optional | Fixes the clock offset across serverless instances. Ignored without `DEMO_CLOCK_START` |
| `DATABASE_ADMIN_URL` | only for Admin > Reset demo data and the idle restore | Owner role, pooled or direct. The build ignores it. Leave it out if you do not need the reset button in production |
| `APPROVED_DOC_HOSTS` | optional | Comma-separated hosts allowed in document links |
| `APP_TIMEZONE` | optional | Default `Europe/Bucharest` |
| `DUPLICATE_NAME_THRESHOLD` | optional | Default `0.85` |
| `GLEIF_BASE_URL` | optional | Has a default |
| `GLEIF_TIMEOUT_MS` | optional | Has a default |
| `GLEIF_CACHE_PATH` | optional | Has a default |
| `GLEIF_FORCE_CACHE` | optional | `true` serves GLEIF lookups from the cache only |
| `GLEIF_SEED_SOURCE` | `cache` on Vercel | Read when the data is restored. `cache` restores the generated snapshot and never calls the live GLEIF API |

Set by Vercel itself, not by you: `VERCEL_ENV`, `NODE_ENV`, `CI`. Used only by local scripts and tests: `POSTGRES_HOST_PORT`, `NEXT_DIST_DIR`. `NEXT_PUBLIC_DEMO_MODE`, `NEXT_PUBLIC_DEMO_CLOCK_START` and `NEXT_PUBLIC_DEMO_CLOCK_ANCHOR` are derived from the `DEMO_*` variables by `next.config.ts`; do not set them.

## 5. Last checks in the new repository

- `git log --oneline` shows one commit.
- `npm run test:all` passes against Docker Postgres.
- The first Production deploy passes the migration check in `scripts/vercel-build.sh`.
