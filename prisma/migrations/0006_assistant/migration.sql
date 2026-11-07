-- CreateTable
CREATE TABLE "AssistantChat" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantChat_clubId_userId_updatedAt_idx" ON "AssistantChat"("clubId", "userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantUsage_clubId_day_key" ON "AssistantUsage"("clubId", "day");

-- AddForeignKey
ALTER TABLE "AssistantChat" ADD CONSTRAINT "AssistantChat_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantUsage" ADD CONSTRAINT "AssistantUsage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

