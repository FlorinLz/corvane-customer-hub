import "dotenv/config";

import { createAdminDb } from "@/server/db-admin";

import { seed } from "./seed";

async function main() {
  const db = createAdminDb();
  try {
    await seed(db);
    console.log("Seed complete.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
