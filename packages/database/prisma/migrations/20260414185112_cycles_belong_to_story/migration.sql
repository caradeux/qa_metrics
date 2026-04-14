/*
  Warnings:

  - You are about to drop the column `cycleId` on the `DailyRecord` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `TestCycle` table. All the data in the column will be lost.
  - You are about to drop the `CycleBreakdown` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `storyId` to the `TestCycle` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CycleBreakdown" DROP CONSTRAINT "CycleBreakdown_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "DailyRecord" DROP CONSTRAINT "DailyRecord_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "TestCycle" DROP CONSTRAINT "TestCycle_projectId_fkey";

-- DropIndex
DROP INDEX "DailyRecord_cycleId_idx";

-- DropIndex
DROP INDEX "TestCycle_projectId_idx";

-- AlterTable
ALTER TABLE "DailyRecord" DROP COLUMN "cycleId";

-- AlterTable
ALTER TABLE "TestCycle" DROP COLUMN "projectId",
ADD COLUMN     "storyId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CycleBreakdown";

-- CreateIndex
CREATE INDEX "TestCycle_storyId_idx" ON "TestCycle"("storyId");

-- AddForeignKey
ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "UserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
