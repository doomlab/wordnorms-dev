-- CreateTable
CREATE TABLE "DuplicateGroupIgnore" (
    "id" SERIAL NOT NULL,
    "groupKey" TEXT NOT NULL,
    "groupType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuplicateGroupIgnore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateGroupIgnore_groupKey_groupType_key" ON "DuplicateGroupIgnore"("groupKey", "groupType");
