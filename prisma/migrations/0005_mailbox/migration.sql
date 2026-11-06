-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "resendId" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "fromAddr" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddrs" TEXT NOT NULL,
    "ccAddrs" TEXT,
    "mailbox" TEXT,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "attachments" JSONB,
    "readAt" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_resendId_key" ON "MailMessage"("resendId");

-- CreateIndex
CREATE INDEX "MailMessage_clubId_direction_archived_createdAt_idx" ON "MailMessage"("clubId", "direction", "archived", "createdAt");

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

