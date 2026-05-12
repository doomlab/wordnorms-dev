-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "isValidation" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ModelRun" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainSize" INTEGER NOT NULL,
    "valSize" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1" DOUBLE PRECISION NOT NULL,
    "valRebalanced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);
