-- AddForeignKey
ALTER TABLE "AutomationRecord" ADD CONSTRAINT "AutomationRecord_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;
