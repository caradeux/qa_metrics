-- AlterEnum
BEGIN;
CREATE TYPE "AssignmentStatus_new" AS ENUM ('REGISTERED', 'ANALYSIS', 'TEST_DESIGN', 'EXECUTION', 'RETURNED_TO_DEV', 'WAITING_UAT', 'UAT', 'PRODUCTION');
ALTER TABLE "public"."TesterAssignment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TesterAssignment" ALTER COLUMN "status" TYPE "AssignmentStatus_new" USING ("status"::text::"AssignmentStatus_new");
ALTER TYPE "AssignmentStatus" RENAME TO "AssignmentStatus_old";
ALTER TYPE "AssignmentStatus_new" RENAME TO "AssignmentStatus";
DROP TYPE "public"."AssignmentStatus_old";
ALTER TABLE "TesterAssignment" ALTER COLUMN "status" SET DEFAULT 'REGISTERED';
COMMIT;

-- DropForeignKey
ALTER TABLE "WeeklyRecord" DROP CONSTRAINT "WeeklyRecord_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "WeeklyRecord" DROP CONSTRAINT "WeeklyRecord_testerId_fkey";

-- AlterTable
ALTER TABLE "Tester" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "TesterAssignment" ADD COLUMN     "executionCycle" TEXT,
ALTER COLUMN "status" SET DEFAULT 'REGISTERED';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "roleId" TEXT NOT NULL;

-- DropTable
DROP TABLE "WeeklyRecord";

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "designed" INTEGER NOT NULL DEFAULT 0,
    "executed" INTEGER NOT NULL DEFAULT 0,
    "defects" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleBreakdown" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "designedFunctional" INTEGER NOT NULL DEFAULT 0,
    "designedRegression" INTEGER NOT NULL DEFAULT 0,
    "designedSmoke" INTEGER NOT NULL DEFAULT 0,
    "designedExploratory" INTEGER NOT NULL DEFAULT 0,
    "executedFunctional" INTEGER NOT NULL DEFAULT 0,
    "executedRegression" INTEGER NOT NULL DEFAULT 0,
    "executedSmoke" INTEGER NOT NULL DEFAULT 0,
    "executedExploratory" INTEGER NOT NULL DEFAULT 0,
    "defectsCritical" INTEGER NOT NULL DEFAULT 0,
    "defectsHigh" INTEGER NOT NULL DEFAULT 0,
    "defectsMedium" INTEGER NOT NULL DEFAULT 0,
    "defectsLow" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_resource_action_key" ON "Permission"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "DailyRecord_cycleId_idx" ON "DailyRecord"("cycleId");

-- CreateIndex
CREATE INDEX "DailyRecord_date_idx" ON "DailyRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_testerId_date_key" ON "DailyRecord"("testerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CycleBreakdown_cycleId_key" ON "CycleBreakdown"("cycleId");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "TestCycle_projectId_idx" ON "TestCycle"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Tester_userId_key" ON "Tester"("userId");

-- CreateIndex
CREATE INDEX "Tester_projectId_idx" ON "Tester"("projectId");

-- CreateIndex
CREATE INDEX "TesterAssignment_testerId_idx" ON "TesterAssignment"("testerId");

-- CreateIndex
CREATE INDEX "TesterAssignment_storyId_idx" ON "TesterAssignment"("storyId");

-- CreateIndex
CREATE INDEX "UserStory_cycleId_idx" ON "UserStory"("cycleId");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tester" ADD CONSTRAINT "Tester_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecord" ADD CONSTRAINT "DailyRecord_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TestCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleBreakdown" ADD CONSTRAINT "CycleBreakdown_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TestCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
