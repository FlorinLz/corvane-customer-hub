import "dotenv/config";

import { createAdminDb } from "@/server/db-admin";
import { resetDemoData } from "@/server/demo-reset";

// The data-level reset (TRUNCATE + seed), callable without a running dev
// server — unlike `npm run db:reset`, this never calls
// `prisma migrate reset`, so it doesn't hit Prisma's AI-agent consent
// gate (DECISIONS.md). Used directly by `npm run demo:reset-data`, and
// chained (once under DEMO_CLOCK_START, once without) by `npm run
// test:all` (scripts/test-all.sh).
async function main() {
  const db = createAdminDb();
  try {
    await resetDemoData(db);
    console.log("Demo data reset.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
