-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectManagerId" TEXT;

-- CreateIndex
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
