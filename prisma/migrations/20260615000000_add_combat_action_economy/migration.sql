-- AlterTable: live board state for the Heartflame predicate engine.
-- Adds action economy (action/bonus/reaction) + temp HP + concentration to
-- combat participants. All columns are additive with safe defaults, so existing
-- rows backfill cleanly and the change is non-destructive / reversible.
ALTER TABLE "EncounterParticipant"
    ADD COLUMN "tempHp" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "actionUsed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "bonusActionUsed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "reactionUsed" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "concentration" BOOLEAN NOT NULL DEFAULT false;
