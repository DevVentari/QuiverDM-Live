-- Import Hub: multi-source content import (Notion, Obsidian, World Anvil,
-- Kanka, Campfire, Google Docs, Docx, Markdown).
-- Fully additive: 2 nullable columns on HomebrewContent + 2 new tables.
-- Safe to apply to a live DB — backward-compatible with the deployed app.

-- AlterTable
ALTER TABLE "HomebrewContent" ADD COLUMN     "sourceExternalId" TEXT,
ADD COLUMN     "sourceJobId" TEXT;

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ImportJob_userId_source_idx" ON "ImportJob"("userId", "source");

-- CreateIndex
CREATE INDEX "SourceCredential_userId_idx" ON "SourceCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCredential_userId_source_key" ON "SourceCredential"("userId", "source");

-- CreateIndex
CREATE INDEX "HomebrewContent_sourceExternalId_idx" ON "HomebrewContent"("sourceExternalId");

-- CreateIndex
CREATE INDEX "HomebrewContent_sourceJobId_idx" ON "HomebrewContent"("sourceJobId");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCredential" ADD CONSTRAINT "SourceCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
