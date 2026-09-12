-- AlterTable
ALTER TABLE "User" ADD COLUMN "resetTokenHash" TEXT,
ADD COLUMN "resetTokenExpiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetTokenHash_key" ON "User"("resetTokenHash");
