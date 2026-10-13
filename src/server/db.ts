import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Runtime connection, hub_app role (3.1.4). Prisma 7 requires a driver
// adapter instead of a datasource url in schema.prisma.
const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

export const db =
  globalForPrisma.db ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db;
