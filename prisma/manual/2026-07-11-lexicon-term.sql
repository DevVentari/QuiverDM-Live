-- Additive: RecapForge P2 LexiconTerm (applied via prisma db execute because
-- this branch's schema predates the live DB's encounter-studio tables and
-- `db push` would try to drop them).
CREATE TABLE IF NOT EXISTS "LexiconTerm" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LexiconTerm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LexiconTerm_campaignId_term_key" ON "LexiconTerm"("campaignId", "term");
CREATE INDEX IF NOT EXISTS "LexiconTerm_campaignId_idx" ON "LexiconTerm"("campaignId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LexiconTerm_campaignId_fkey') THEN
    ALTER TABLE "LexiconTerm" ADD CONSTRAINT "LexiconTerm_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
