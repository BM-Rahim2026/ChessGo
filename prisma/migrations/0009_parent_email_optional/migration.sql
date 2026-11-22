-- AlterTable
ALTER TABLE "FormSubmission" ALTER COLUMN "parentEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Parent" ALTER COLUMN "email" DROP NOT NULL;

