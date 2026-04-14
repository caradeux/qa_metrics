-- CreateEnum
CREATE TYPE "AssignmentPhaseType" AS ENUM ('ANALYSIS', 'TEST_DESIGN', 'EXECUTION');

-- CreateTable
CREATE TABLE "AssignmentPhase" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "phase" "AssignmentPhaseType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "AssignmentPhase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentPhase_assignmentId_idx" ON "AssignmentPhase"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentPhase_assignmentId_phase_key" ON "AssignmentPhase"("assignmentId", "phase");

-- AddForeignKey
ALTER TABLE "AssignmentPhase" ADD CONSTRAINT "AssignmentPhase_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TesterAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
