-- User: groqApiKey
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "groqApiKey" TEXT;

-- PaperExtraction: verifiedAt, verifiedById
ALTER TABLE "PaperExtraction" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "PaperExtraction" ADD COLUMN IF NOT EXISTS "verifiedById" INTEGER;
ALTER TABLE "PaperExtraction" ADD CONSTRAINT "PaperExtraction_verifiedById_fkey"
  FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
