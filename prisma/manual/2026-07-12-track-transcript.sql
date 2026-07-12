-- RecapForge P3 TrackTranscript (applied via prisma db execute; branch schema
-- predates the live DB's other tables so `db push` would drop them).
CREATE TABLE IF NOT EXISTS "TrackTranscript" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "uploadGroupId" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "characterName" TEXT,
    "text" TEXT NOT NULL,
    "segments" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackTranscript_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrackTranscript_recordingId_key" ON "TrackTranscript"("recordingId");
CREATE INDEX IF NOT EXISTS "TrackTranscript_sessionId_idx" ON "TrackTranscript"("sessionId");
CREATE INDEX IF NOT EXISTS "TrackTranscript_uploadGroupId_idx" ON "TrackTranscript"("uploadGroupId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrackTranscript_sessionId_fkey') THEN
    ALTER TABLE "TrackTranscript" ADD CONSTRAINT "TrackTranscript_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
