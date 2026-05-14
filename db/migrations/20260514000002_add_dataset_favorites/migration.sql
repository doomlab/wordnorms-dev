-- CreateTable
CREATE TABLE "UserDatasetFavorite" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "bibtex" TEXT NOT NULL,

    CONSTRAINT "UserDatasetFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDatasetFavorite_userId_bibtex_key" ON "UserDatasetFavorite"("userId", "bibtex");

-- AddForeignKey
ALTER TABLE "UserDatasetFavorite" ADD CONSTRAINT "UserDatasetFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
