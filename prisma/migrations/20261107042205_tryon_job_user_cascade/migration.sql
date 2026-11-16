-- DropForeignKey
ALTER TABLE "TryOnJob" DROP CONSTRAINT "TryOnJob_userId_fkey";

-- AddForeignKey
ALTER TABLE "TryOnJob" ADD CONSTRAINT "TryOnJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
