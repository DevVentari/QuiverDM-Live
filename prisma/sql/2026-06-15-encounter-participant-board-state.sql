-- Scrollkin board-state: additive/nullable columns on EncounterParticipant.
-- Reviewable migration (repo uses `prisma db push`; apply to homelab via:
--   npx prisma db execute --url "<homelab-DATABASE_URL>" \
--     --file prisma/sql/2026-06-15-encounter-participant-board-state.sql
-- All columns are additive and non-breaking — existing rows default cleanly.

ALTER TABLE "EncounterParticipant"
  ADD COLUMN IF NOT EXISTS "tempHp" INTEGER,
  ADD COLUMN IF NOT EXISTS "actionUsed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bonusActionUsed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reactionUsed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "concentration" TEXT;
