-- AlterTable
ALTER TABLE "ExtractionEditSuggestion" ADD COLUMN     "sourceEvidence" JSONB;

-- AlterTable
ALTER TABLE "PaperExtraction" ADD COLUMN     "sourceSnippets" JSONB;
