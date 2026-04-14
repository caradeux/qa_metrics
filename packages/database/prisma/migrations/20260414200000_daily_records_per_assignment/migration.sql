-- DropIndex
DROP INDEX "DailyRecord_testerId_date_key";

-- AlterTable
ALTER TABLE "DailyRecord" ADD COLUMN "assignmentId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "DailyRecord_assignmentId_idx" ON "DailyRecord"("assignmentId");

-- CreateIndex
CREATE INDEX "DailyRecord_testerId_idx" ON "DailyRecord"("testerId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_assignmentId_date_key" ON "DailyRecord"("assignmentId", "date");

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TesterAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
