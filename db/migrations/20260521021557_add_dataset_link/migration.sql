-- CreateTable
CREATE TABLE "DatasetLink" (
    "bibtex" TEXT NOT NULL,
    "paperId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetLink_pkey" PRIMARY KEY ("bibtex")
);

-- CreateIndex
CREATE INDEX "DatasetLink_paperId_idx" ON "DatasetLink"("paperId");

-- AddForeignKey
ALTER TABLE "DatasetLink" ADD CONSTRAINT "DatasetLink_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
