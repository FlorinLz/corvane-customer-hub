import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: Migrate commands (migrate dev/reset, db execute, db push) read
// the connection from here. The running app connects through a driver
// adapter instead (src/server/db.ts, db-admin.ts).
//
// `env("DATABASE_ADMIN_URL")` would throw at config-load time (before
// any command dispatches) if the var is unset — which it deliberately
// isn't on Vercel, since the build only ever runs `prisma generate`
// (no real connection needed) and shouldn't be handed admin credentials.
// Falling back keeps `generate` working everywhere; real migrate
// commands still need DATABASE_ADMIN_URL set for real, same as before.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL ?? "postgresql://unset/unset",
  },
});
