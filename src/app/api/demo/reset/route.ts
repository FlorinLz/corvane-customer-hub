import { createAdminDb } from "@/server/db-admin";
import { handle } from "@/server/http";
import { NotFoundError } from "@/server/errors";
import { getCurrentUser } from "@/server/session";
import { assertCan } from "@/server/permissions/guard";
import { resetDemoData } from "@/server/demo-reset";

// The reset truncates and reseeds in one request. 300 s is the Vercel Functions default on every plan with Fluid Compute; it is
// explicit here so a two-minute reset on a database a network hop away can never be cut short (DECISIONS.md, "Reset duration").
export const maxDuration = 300;

// Brief 7.2.3. Admin only, DEMO_MODE only. Truncates every data table,
// reseeds with today from src/lib/dates.ts, increments
// DemoMeta.seedVersion. The client reloads to / and shows the toast
// "Demo data reset" (wired up with the Admin menu, milestone 4).
export const POST = handle("demo.reset", async () => {
  if (process.env.DEMO_MODE !== "true") throw new NotFoundError();

  const user = await getCurrentUser();
  assertCan(user, "admin.demoReset");

  const db = createAdminDb();
  try {
    await resetDemoData(db);
    const meta = await db.demoMeta.findUniqueOrThrow({ where: { id: 1 } });
    return { seedVersion: meta.seedVersion };
  } finally {
    await db.$disconnect();
  }
});
