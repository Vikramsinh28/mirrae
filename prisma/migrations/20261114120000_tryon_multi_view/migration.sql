-- AlterTable
ALTER TABLE "TryOnJob" ADD COLUMN     "backImageKey" TEXT,
ADD COLUMN     "extrasSettledAt" TIMESTAMP(3),
ADD COLUMN     "sideImageKey" TEXT,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 1;
