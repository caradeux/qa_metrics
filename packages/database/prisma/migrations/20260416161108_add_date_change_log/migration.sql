-- CreateEnum
CREATE TYPE "DateChangeEntityType" AS ENUM ('CYCLE', 'ASSIGNMENT', 'PHASE');

-- CreateTable
CREATE TABLE "DateChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" "DateChangeEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TIMESTAMP(3),
    "newValue" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DateChangeLog_entityType_entityId_idx" ON "DateChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DateChangeLog_userId_idx" ON "DateChangeLog"("userId");

-- CreateIndex
CREATE INDEX "DateChangeLog_createdAt_idx" ON "DateChangeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "DateChangeLog" ADD CONSTRAINT "DateChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
