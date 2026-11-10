-- CreateTable
CREATE TABLE "LearnProgress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnProgress_studentId_levelId_key" ON "LearnProgress"("studentId", "levelId");

-- AddForeignKey
ALTER TABLE "LearnProgress" ADD CONSTRAINT "LearnProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

