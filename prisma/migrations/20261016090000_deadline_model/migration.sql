-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "pausedBusinessMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "restoreNote" VARCHAR(500),
ADD COLUMN     "restoredAt" TIMESTAMPTZ(3),
ADD COLUMN     "restoredById" TEXT;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
