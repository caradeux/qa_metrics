-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'PAUSED', 'DONE');

-- AlterEnum
ALTER TYPE "Modality" ADD VALUE 'AUTOMATION';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "testLineId" TEXT;

-- CreateTable
CREATE TABLE "TestLine" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "complexity" "Complexity" NOT NULL DEFAULT 'MEDIUM',
    "projectId" TEXT NOT NULL,

    CONSTRAINT "TestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAssignment" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "testLineId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "AutomationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRecord" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scriptsCreated" INTEGER NOT NULL DEFAULT 0,
    "scriptsRefactored" INTEGER NOT NULL DEFAULT 0,
    "scriptsFixed" INTEGER NOT NULL DEFAULT 0,
    "execTotal" INTEGER NOT NULL DEFAULT 0,
    "execPassed" INTEGER NOT NULL DEFAULT 0,
    "execFailed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestLine_projectId_idx" ON "TestLine"("projectId");

-- CreateIndex
CREATE INDEX "AutomationAssignment_testerId_idx" ON "AutomationAssignment"("testerId");

-- CreateIndex
CREATE INDEX "AutomationAssignment_testLineId_idx" ON "AutomationAssignment"("testLineId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationAssignment_testerId_testLineId_key" ON "AutomationAssignment"("testerId", "testLineId");

-- CreateIndex
CREATE INDEX "AutomationRecord_assignmentId_idx" ON "AutomationRecord"("assignmentId");

-- CreateIndex
CREATE INDEX "AutomationRecord_testerId_idx" ON "AutomationRecord"("testerId");

-- CreateIndex
CREATE INDEX "AutomationRecord_date_idx" ON "AutomationRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRecord_assignmentId_date_key" ON "AutomationRecord"("assignmentId", "date");

-- CreateIndex
CREATE INDEX "Activity_testLineId_idx" ON "Activity"("testLineId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_testLineId_fkey" FOREIGN KEY ("testLineId") REFERENCES "TestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestLine" ADD CONSTRAINT "TestLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAssignment" ADD CONSTRAINT "AutomationAssignment_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAssignment" ADD CONSTRAINT "AutomationAssignment_testLineId_fkey" FOREIGN KEY ("testLineId") REFERENCES "TestLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRecord" ADD CONSTRAINT "AutomationRecord_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AutomationAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
