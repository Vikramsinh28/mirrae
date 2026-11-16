-- CreateEnum
CREATE TYPE "ShopifyChargeStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ShopifyCharge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shopId" UUID,
    "shopDomain" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "priceUsd" DECIMAL(10,2) NOT NULL,
    "test" BOOLEAN NOT NULL,
    "status" "ShopifyChargeStatus" NOT NULL DEFAULT 'PENDING',
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyCharge_gid_key" ON "ShopifyCharge"("gid");

-- CreateIndex
CREATE INDEX "ShopifyCharge_shopId_status_idx" ON "ShopifyCharge"("shopId", "status");

-- AddForeignKey
ALTER TABLE "ShopifyCharge" ADD CONSTRAINT "ShopifyCharge_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
