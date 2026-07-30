-- CreateTable
CREATE TABLE "NormsCard" (
    "bibtex" TEXT NOT NULL,
    "card" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormsCard_pkey" PRIMARY KEY ("bibtex")
);
