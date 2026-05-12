-- CreateTable
CREATE TABLE "PaperExtraction" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paperId" INTEGER NOT NULL,
    "language" TEXT[],
    "participantCount" INTEGER,
    "participantType" TEXT,
    "stimuliType" TEXT[],
    "stimuliCount" INTEGER,
    "normsCollected" TEXT[],
    "instructions" TEXT,
    "confidence" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "extractedBy" TEXT,
    "extractedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperExtraction_paperId_key" ON "PaperExtraction"("paperId");

-- AddForeignKey
ALTER TABLE "PaperExtraction" ADD CONSTRAINT "PaperExtraction_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
