-- AlterTable
ALTER TABLE "DemoMeta" ADD COLUMN     "lastRestoreAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastWriteAt" TIMESTAMPTZ(3);
