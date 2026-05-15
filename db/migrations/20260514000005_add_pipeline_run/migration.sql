CREATE TYPE "PipelineStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

CREATE TABLE "PipelineRun" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "PipelineStatus" NOT NULL DEFAULT 'RUNNING',
    "step" TEXT,
    "output" TEXT,
    "startedById" INTEGER,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_startedById_fkey"
  FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
