-- CreateEnum
CREATE TYPE "ShopPlatform" AS ENUM ('WEB', 'SHOPIFY', 'WOOCOMMERCE', 'API');
-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'UNINSTALLED');
-- AlterTable
ALTER TABLE "TryOnJob" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "shopId" UUID;
-- CreateTable
CREATE TABLE "Shop" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "ShopPlatform" NOT NULL DEFAULT 'WEB',
    "domain" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[],
    "imageHosts" TEXT[],
    "status" "ShopStatus" NOT NULL DEFAULT 'ACTIVE',
    "dailyTryOnCap" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "Shop_publicKey_key" ON "Shop"("publicKey");
-- CreateIndex
CREATE INDEX "Shop_ownerId_idx" ON "Shop"("ownerId");
-- CreateIndex
CREATE UNIQUE INDEX "Shop_platform_domain_key" ON "Shop"("platform", "domain");
-- CreateIndex
CREATE INDEX "TryOnJob_shopId_createdAt_idx" ON "TryOnJob"("shopId", "createdAt");
-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
