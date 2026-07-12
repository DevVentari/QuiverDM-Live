-- prisma/manual/2026-07-13-recap-publish.sql
-- Additive: per-campaign publish target + recap publish state. Idempotent.
ALTER TABLE "Campaign"   ADD COLUMN IF NOT EXISTS "publishConfig" JSONB;
ALTER TABLE "ForgeRecap" ADD COLUMN IF NOT EXISTS "publishedAt"  TIMESTAMP(3);
ALTER TABLE "ForgeRecap" ADD COLUMN IF NOT EXISTS "publishedUrl" TEXT;
ALTER TABLE "ForgeRecap" ADD COLUMN IF NOT EXISTS "publishError" TEXT;
