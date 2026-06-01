-- CreateTable
CREATE TABLE "FlowpilotCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowpilotCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowpilotConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowpilotUserId" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowpilotConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowpilotMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "contractId" INTEGER,
    "projectId" INTEGER,
    "entityName" TEXT NOT NULL,
    "taskTypeId" INTEGER NOT NULL,
    "taskTypeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowpilotMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowpilotSyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entryIds" INTEGER[],
    "hoursTotal" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowpilotSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlowpilotCredential_userId_key" ON "FlowpilotCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowpilotConnection_userId_key" ON "FlowpilotConnection"("userId");

-- CreateIndex
CREATE INDEX "FlowpilotMapping_userId_idx" ON "FlowpilotMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowpilotMapping_userId_kind_key" ON "FlowpilotMapping"("userId", "kind");

-- CreateIndex
CREATE INDEX "FlowpilotSyncLog_userId_idx" ON "FlowpilotSyncLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowpilotSyncLog_userId_date_key" ON "FlowpilotSyncLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "FlowpilotCredential" ADD CONSTRAINT "FlowpilotCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowpilotConnection" ADD CONSTRAINT "FlowpilotConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowpilotMapping" ADD CONSTRAINT "FlowpilotMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowpilotSyncLog" ADD CONSTRAINT "FlowpilotSyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
