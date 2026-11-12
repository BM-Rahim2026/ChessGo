-- AlterTable
ALTER TABLE "FormSubmission" ADD COLUMN     "schoolLeadId" TEXT;

-- CreateTable
CREATE TABLE "SchoolLead" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Polska',
    "city" TEXT,
    "schoolType" TEXT NOT NULL DEFAULT 'public',
    "contactName" TEXT,
    "contactRole" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "nextFollowUp" TEXT,
    "openDayDate" TEXT,
    "openDayTime" TEXT,
    "registeredKids" INTEGER NOT NULL DEFAULT 0,
    "targetKids" INTEGER NOT NULL DEFAULT 8,
    "scheduleDay" INTEGER,
    "scheduleTime" TEXT,
    "room" TEXT,
    "coachId" TEXT,
    "notes" TEXT,
    "failedCalls" INTEGER NOT NULL DEFAULT 0,
    "checklist" JSONB,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolLead_clubId_status_idx" ON "SchoolLead"("clubId", "status");

-- CreateIndex
CREATE INDEX "SchoolActivity_clubId_createdAt_idx" ON "SchoolActivity"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "FormSubmission_schoolLeadId_idx" ON "FormSubmission"("schoolLeadId");

-- AddForeignKey
ALTER TABLE "SchoolLead" ADD CONSTRAINT "SchoolLead_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolActivity" ADD CONSTRAINT "SchoolActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SchoolLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

