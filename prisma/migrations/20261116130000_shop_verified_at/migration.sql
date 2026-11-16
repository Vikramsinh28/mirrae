-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- Shops that exist before this change keep working: this is pre-launch data, and Shopify shops are
-- verified by Shopify itself. Every shop created from now on starts unverified (WEB) or verified (Shopify).
UPDATE "Shop" SET "verifiedAt" = CURRENT_TIMESTAMP;
