-- AlterEnum (an admin's credit change is its own kind of history row, so it is never counted as try-on spend)
ALTER TYPE "CreditOperation" ADD VALUE 'ADMIN_ADJUSTMENT';

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('SHOP_SUSPENDED', 'SHOP_UNSUSPENDED', 'CREDITS_GRANTED', 'CREDITS_REMOVED');

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adminId" INTEGER NOT NULL,
    "action" "AdminAction" NOT NULL,
    "shopId" UUID,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_shopId_createdAt_idx" ON "AdminAuditLog"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
