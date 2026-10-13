import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// hub_owner role (3.1.4). Used only by migrations, seed, db:reset and the
// "Reset demo data" endpoint — the only path that removes audit entries
// (via TRUNCATE, which row triggers do not block).
export function createAdminDb(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }),
  });
}
