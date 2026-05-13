-- CreateTable
CREATE TABLE "ExtractionEditSuggestion" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paperId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "language" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "participantCount" INTEGER,
    "participantType" TEXT,
    "stimuliType" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stimuliCount" INTEGER,
    "normsCollected" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instructions" TEXT,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExtractionEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataEditSuggestion" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paperId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "doi" TEXT,
    "journal" TEXT,
    "abstract" TEXT,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MetadataEditSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionEditSuggestion_userId_paperId_key" ON "ExtractionEditSuggestion"("userId", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataEditSuggestion_userId_paperId_key" ON "MetadataEditSuggestion"("userId", "paperId");

-- AddForeignKey
ALTER TABLE "ExtractionEditSuggestion" ADD CONSTRAINT "ExtractionEditSuggestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionEditSuggestion" ADD CONSTRAINT "ExtractionEditSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataEditSuggestion" ADD CONSTRAINT "MetadataEditSuggestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataEditSuggestion" ADD CONSTRAINT "MetadataEditSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
