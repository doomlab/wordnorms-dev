-- AlterTable
ALTER TABLE "PaperExtraction" ADD COLUMN     "participantLevelData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reliabilities" JSONB;
