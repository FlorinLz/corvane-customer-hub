import "dotenv/config";

// Times the app's restore (the snapshot path) against DATABASE_ADMIN_URL: `npm run demo:restore-time`.
async function main() {
  process.env.DEMO_CLOCK_START = "2026-10-05T10:05:00+02:00";
  delete process.env.DEMO_CLOCK_ANCHOR;
  process.env.GLEIF_SEED_SOURCE = "cache";
  const { createAdminDb } = await import("../src/server/db-admin");
  const { restoreDemoData } = await import("../src/server/demo-reset");
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const { mode, seedVersion } = await restoreDemoData(createAdminDb);
    console.log(`restore ${i + 1}: ${mode}, seedVersion ${seedVersion}, ${((performance.now() - t0) / 1000).toFixed(2)} s`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
