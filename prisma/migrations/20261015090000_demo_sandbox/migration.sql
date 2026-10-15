-- sandbox:skip
-- The registry of per-visitor sandboxes. It lives in the public schema only: scripts/sandbox-ddl-lib.ts leaves every migration that starts
-- with the line above out of the DDL it copies into a visitor's schema.

-- CreateEnum
CREATE TYPE "DemoSandboxStatus" AS ENUM ('SPARE', 'ASSIGNED');

-- CreateTable
CREATE TABLE "DemoSandbox" (
    "schemaName" TEXT NOT NULL,
    "status" "DemoSandboxStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "ddlHash" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,

    CONSTRAINT "DemoSandbox_pkey" PRIMARY KEY ("schemaName"),
    CONSTRAINT "DemoSandbox_schemaName_format" CHECK ("schemaName" ~ '^sbx_[0-9a-f]{16}$')
);

-- CreateIndex
CREATE INDEX "DemoSandbox_status_ddlHash_snapshotHash_idx" ON "DemoSandbox"("status", "ddlHash", "snapshotHash");

-- CreateIndex
CREATE INDEX "DemoSandbox_expiresAt_idx" ON "DemoSandbox"("expiresAt");

-- The app reads the registry on the runtime connection (is this visitor's sandbox still valid?); every write goes through the admin connection.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hub_app') THEN
    GRANT SELECT ON "DemoSandbox" TO hub_app;
  END IF;
END $$;
