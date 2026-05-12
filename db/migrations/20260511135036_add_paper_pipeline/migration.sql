-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_PDF', 'ACCEPTED', 'EXCLUDED', 'ADDED_TO_TRAINING');

-- CreateTable
CREATE TABLE "Paper" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "year" INTEGER,
    "doi" TEXT,
    "openAlexId" TEXT,
    "abstract" TEXT,
    "pdfUrl" TEXT,
    "modelScore" DOUBLE PRECISION,
    "status" "PaperStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedById" INTEGER,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paper_doi_key" ON "Paper"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_openAlexId_key" ON "Paper"("openAlexId");

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
