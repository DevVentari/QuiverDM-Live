-- prisma/manual/2026-07-12-forge-recap.sql
-- Additive: ForgeRecap table + Campaign.theme. Idempotent.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "theme" JSONB;

CREATE TABLE IF NOT EXISTS "ForgeRecap" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'generating',
  "content"       JSONB,
  "themeSnapshot" JSONB,
  "generatedHtml" TEXT,
  "rawOutput"     TEXT,
  "error"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ForgeRecap_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ForgeRecap_sessionId_key" ON "ForgeRecap"("sessionId");
DO $$ BEGIN
  ALTER TABLE "ForgeRecap" ADD CONSTRAINT "ForgeRecap_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
