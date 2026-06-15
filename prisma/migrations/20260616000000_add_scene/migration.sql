-- CreateTable: Scene (RP/description/shop/theatre moments presented to players)
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rp',
    "description" TEXT,
    "dmNotes" TEXT,
    "imageUrl" TEXT,
    "musicCue" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isPresented" BOOLEAN NOT NULL DEFAULT false,
    "linkedEntityIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scene_campaignId_idx" ON "Scene"("campaignId");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
