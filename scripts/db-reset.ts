import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createAdminDb } from "@/server/db-admin";
import { seed } from "@seed/seed";

// Brief 3.1.5 "db:reset": prisma migrate reset --force, then
// prisma/grants.sql, then the seed. Prisma 7 dropped --skip-seed (there is
// no migrations.seed configured in prisma.config.ts for it to skip).
function run(command: string) {
  execSync(command, { stdio: "inherit" });
}

async function main() {
  run("npx prisma migrate reset --force");

  const db = createAdminDb();
  try {
    const grants = readFileSync("prisma/grants.sql", "utf-8");
    for (const statement of grants.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(statement);
    }
    await seed(db);
    console.log("db:reset complete.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
