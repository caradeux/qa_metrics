-- DropForeignKey
ALTER TABLE "UserStory" DROP CONSTRAINT "UserStory_cycleId_fkey";

-- DropIndex
DROP INDEX "TesterAssignment_testerId_storyId_key";

-- DropIndex
DROP INDEX "UserStory_cycleId_idx";

-- AlterTable (destructive: clean DB, no data loss concern)
ALTER TABLE "TesterAssignment" DROP COLUMN "executionCycle",
ADD COLUMN     "cycleId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserStory" DROP COLUMN "complexity",
DROP COLUMN "cycleId",
ADD COLUMN     "designComplexity" "Complexity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "executionComplexity" "Complexity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "projectId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "AssignmentStatusLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentStatusLog_assignmentId_idx" ON "AssignmentStatusLog"("assignmentId");

-- CreateIndex
CREATE INDEX "TesterAssignment_cycleId_idx" ON "TesterAssignment"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "TesterAssignment_testerId_storyId_cycleId_key" ON "TesterAssignment"("testerId", "storyId", "cycleId");

-- CreateIndex
CREATE INDEX "UserStory_projectId_idx" ON "UserStory"("projectId");

-- AddForeignKey
ALTER TABLE "TesterAssignment" ADD CONSTRAINT "TesterAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TestCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentStatusLog" ADD CONSTRAINT "AssignmentStatusLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TesterAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
