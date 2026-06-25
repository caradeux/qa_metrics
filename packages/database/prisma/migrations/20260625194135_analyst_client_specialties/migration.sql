-- CreateEnum
CREATE TYPE "Specialty" AS ENUM ('QA_MANUAL', 'QA_AUTOMATION', 'PERFORMANCE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "specialties" "Specialty"[] DEFAULT ARRAY[]::"Specialty"[];

-- CreateTable
CREATE TABLE "_AnalystClients" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AnalystClients_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AnalystClients_B_index" ON "_AnalystClients"("B");

-- AddForeignKey
ALTER TABLE "_AnalystClients" ADD CONSTRAINT "_AnalystClients_A_fkey" FOREIGN KEY ("A") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnalystClients" ADD CONSTRAINT "_AnalystClients_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: los analistas marcados como automatización reciben la especialidad QA_AUTOMATION
UPDATE "User" SET "specialties" = ARRAY['QA_AUTOMATION']::"Specialty"[] WHERE "isAutomation" = true;
