-- CreateEnum
CREATE TYPE "TryOnStatus" AS ENUM ('QUEUED', 'PROCESSING', 'DONE', 'FAILED');

-- AlterEnum
ALTER TYPE "CreditOperation" ADD VALUE 'TRYON';

-- CreateTable
CREATE TABLE "TryOnJob" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" INTEGER NOT NULL,
    "personImageKey" TEXT NOT NULL,
    "productImageKey" TEXT NOT NULL,
    "resultImageKey" TEXT,
    "status" "TryOnStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "chargedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TryOnJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TryOnJob_userId_createdAt_idx" ON "TryOnJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TryOnJob_status_updatedAt_idx" ON "TryOnJob"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
