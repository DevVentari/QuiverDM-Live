import dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';
dotenv.config({ path: resolve(process.cwd(), '.env') });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const t = await prisma.transcript.findUnique({
  where: { id: 'cmp86w82f0001guq587adyht4' },
  select: { id: true, rawText: true, speakers: true, hasSpeakers: true, source: true, durationSeconds: true, createdAt: true },
});

// JSON — full record
writeFileSync('docs/Jordan-New-Campaign/master-transcript.json', JSON.stringify(t, null, 2), 'utf8');

// Markdown — readable
const md = `# Jordan's Campaign — Session 0 Transcript\n\n**Source:** ${t.source} | **Duration:** ${t.durationSeconds ? Math.round(t.durationSeconds / 60) + ' min' : 'unknown'} | **Speakers:** ${t.hasSpeakers}\n\n---\n\n${t.rawText}\n`;
writeFileSync('docs/Jordan-New-Campaign/master-transcript.md', md, 'utf8');

console.log('Wrote master-transcript.json and master-transcript.md');
await prisma.$disconnect();
