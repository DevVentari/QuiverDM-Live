-- Battle-map token positions (percentage of canvas, nullable until placed).
ALTER TABLE "EncounterParticipant" ADD COLUMN "mapX" DOUBLE PRECISION;
ALTER TABLE "EncounterParticipant" ADD COLUMN "mapY" DOUBLE PRECISION;

-- Persisted fog-of-war: hidden rectangles per encounter (percentage coords).
CREATE TABLE "FogRegion" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FogRegion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FogRegion_encounterId_idx" ON "FogRegion"("encounterId");

ALTER TABLE "FogRegion" ADD CONSTRAINT "FogRegion_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
