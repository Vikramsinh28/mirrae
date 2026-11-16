-- CreateEnum
CREATE TYPE "StorefrontEventType" AS ENUM ('WIDGET_OPENED', 'RESULT_VIEWED', 'ADD_TO_CART', 'SHARED');

-- CreateTable
CREATE TABLE "StorefrontEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shopId" UUID NOT NULL,
    "sessionId" TEXT NOT NULL,
    "jobId" UUID,
    "type" "StorefrontEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorefrontEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorefrontEvent_shopId_type_createdAt_idx" ON "StorefrontEvent"("shopId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "StorefrontEvent" ADD CONSTRAINT "StorefrontEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
