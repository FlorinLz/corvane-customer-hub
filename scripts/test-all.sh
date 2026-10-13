#!/usr/bin/env bash
# Runs the full check sequence the done-when criteria expect: lint,
# typecheck, the unit suite against a deterministic frozen-clock seed
# (matching tests/unit/seed/seed.test.ts's own worked-example assertions
# and playwright.config.ts's webServer clock), then the e2e suite, then
# restores a real-time seed so the repo is left usable for interactive
# browsing afterward. See README.md "Checks".
set -euo pipefail

# Keep in sync with playwright.config.ts's webServer.env.DEMO_CLOCK_START.
DEMO_CLOCK="2026-10-02T09:00:00+03:00"

cd "$(dirname "$0")/.."

echo "==> lint"
npm run lint

echo "==> typecheck"
npm run typecheck

echo "==> reset + seed under the frozen demo clock ($DEMO_CLOCK)"
DEMO_CLOCK_START="$DEMO_CLOCK" GLEIF_SEED_SOURCE=cache npm run demo:reset-data

echo "==> unit tests against the frozen-clock seed"
DEMO_CLOCK_START="$DEMO_CLOCK" npx vitest run tests/unit

echo "==> e2e suite"
npm run test:e2e

echo "==> restoring a real-time seed"
npm run demo:reset-data

echo "==> test:all passed"
