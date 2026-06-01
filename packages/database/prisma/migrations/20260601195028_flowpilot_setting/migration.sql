-- CreateTable
CREATE TABLE "FlowpilotSetting" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowpilotSetting_pkey" PRIMARY KEY ("id")
);
