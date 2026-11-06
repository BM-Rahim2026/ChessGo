-- Price plans
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCts" INTEGER NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'month',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Club" ADD COLUMN "paymentInfo" TEXT;

ALTER TABLE "Student" ADD COLUMN "planId" TEXT;
ALTER TABLE "Student" ADD CONSTRAINT "Student_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment requests: title, plan, payment link token, sent date, Stripe session
ALTER TABLE "FeeInvoice" ADD COLUMN "title" TEXT,
  ADD COLUMN "planId" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "payToken" TEXT,
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "stripeSessionId" TEXT;
UPDATE "FeeInvoice" SET "dedupeKey" = "studentId" || ':' || "period" || ':group',
  "payToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
ALTER TABLE "FeeInvoice" ALTER COLUMN "dedupeKey" SET NOT NULL, ALTER COLUMN "payToken" SET NOT NULL;
DROP INDEX IF EXISTS "FeeInvoice_studentId_period_key";
CREATE UNIQUE INDEX "FeeInvoice_dedupeKey_key" ON "FeeInvoice"("dedupeKey");
CREATE UNIQUE INDEX "FeeInvoice_payToken_key" ON "FeeInvoice"("payToken");
CREATE UNIQUE INDEX "FeeInvoice_stripeSessionId_key" ON "FeeInvoice"("stripeSessionId");
ALTER TABLE "FeeInvoice" ADD CONSTRAINT "FeeInvoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
