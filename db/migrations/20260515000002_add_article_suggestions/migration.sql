CREATE TABLE "ArticleSuggestion" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "authors" TEXT,
    "year" INTEGER,
    "doi" TEXT,
    "url" TEXT,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArticleSuggestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ArticleSuggestion" ADD CONSTRAINT "ArticleSuggestion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
