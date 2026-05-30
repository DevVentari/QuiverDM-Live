import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env') });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const campaigns = await prisma.campaign.findMany({
  where: { OR: [{ slug: { contains: 'jordan', mode: 'insensitive' } }, { name: { contains: 'jordan', mode: 'insensitive' } }] },
  include: {
    gameSessions: {
      include: {
        transcripts: { select: { id: true, speakers: true, rawText: true, source: true, hasSpeakers: true } },
        recordings: { select: { id: true, speakerTag: true, processingStatus: true, mergeStatus: true, uploadGroupId: true } }
      }
    }
  }
});
const result = campaigns.map(c => ({
  id: c.id, name: c.name, slug: c.slug,
  sessions: c.gameSessions.map(s => ({
    id: s.id, title: s.title, sessionNumber: s.sessionNumber, status: s.status,
    recordings: s.recordings,
    hasTranscript: s.transcripts.length > 0,
    transcriptId: s.transcripts[0]?.id ?? null,
    transcriptSource: s.transcripts[0]?.source ?? null,
    hasSpeakers: s.transcripts[0]?.hasSpeakers ?? null,
    transcriptPreview: s.transcripts[0]?.rawText?.substring(0, 400) ?? null
  }))
}));
console.log(JSON.stringify(result, null, 2));
await prisma.$disconnect();
