-- Backfill NULL array fields in PaperExtraction to empty arrays
UPDATE "PaperExtraction"
SET
  "language"       = COALESCE("language",       ARRAY[]::TEXT[]),
  "stimuliType"    = COALESCE("stimuliType",    ARRAY[]::TEXT[]),
  "normsCollected" = COALESCE("normsCollected", ARRAY[]::TEXT[]);

-- Add defaults so future inserts without these fields don't produce NULLs
ALTER TABLE "PaperExtraction"
  ALTER COLUMN "language"       SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "stimuliType"    SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "normsCollected" SET DEFAULT ARRAY[]::TEXT[];
