ALTER TABLE "Paper" ADD COLUMN "canonicalPaperId" INTEGER;

ALTER TABLE "Paper" ADD CONSTRAINT "Paper_canonicalPaperId_fkey"
  FOREIGN KEY ("canonicalPaperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Paper_canonicalPaperId_idx" ON "Paper"("canonicalPaperId");
