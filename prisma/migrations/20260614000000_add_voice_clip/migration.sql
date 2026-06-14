-- CreateEnum
CREATE TYPE "VoiceClipKind" AS ENUM ('signature', 'dialogue', 'narration');

-- CreateEnum
CREATE TYPE "VoiceClipStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

-- CreateTable
CREATE TABLE "VoiceClip" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "entityId" TEXT,
    "kind" "VoiceClipKind" NOT NULL,
    "text" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "audioUrl" TEXT,
    "durationMs" INTEGER,
    "status" "VoiceClipStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceClip_campaignId_idx" ON "VoiceClip"("campaignId");

-- CreateIndex
CREATE INDEX "VoiceClip_entityId_kind_status_idx" ON "VoiceClip"("entityId", "kind", "status");

-- AddForeignKey
ALTER TABLE "VoiceClip" ADD CONSTRAINT "VoiceClip_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceClip" ADD CONSTRAINT "VoiceClip_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "WorldEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
