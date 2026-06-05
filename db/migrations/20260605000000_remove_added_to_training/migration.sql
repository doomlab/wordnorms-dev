-- Remove unused ADDED_TO_TRAINING value from PaperStatus enum
-- No rows use this value, so the column alteration is safe.

ALTER TABLE "Paper" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "PaperStatus" RENAME TO "PaperStatus_old";

CREATE TYPE "PaperStatus" AS ENUM ('PENDING_REVIEW', 'PENDING_PDF', 'ACCEPTED', 'EXCLUDED');

ALTER TABLE "Paper" ALTER COLUMN "status" TYPE "PaperStatus" USING "status"::text::"PaperStatus";

DROP TYPE "PaperStatus_old";

ALTER TABLE "Paper" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW'::"PaperStatus";
