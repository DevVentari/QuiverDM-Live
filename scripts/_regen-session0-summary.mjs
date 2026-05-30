import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
const apiKey = env.match(/ANTHROPIC_API_KEY="?([^"\n]+)"?/)?.[1];

const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://quiverdm:localdev@192.168.1.21:5432/quiverdm' } },
});

const session = await prisma.gameSession.findUnique({
  where: { id: 'cmp8681g30005vhe123rytkc6' },
  include: { transcripts: { take: 1 } },
});

const transcript = session.transcripts[0];
const text = transcript.correctedText || transcript.rawText;

console.log('Transcript length:', text.length);
console.log('Generating summary via Claude...');

// Use Groq (free tier) since Anthropic credits are low
const prompt = `You are summarizing a D&D session recording for a DM's session notes. Write a 3-4 sentence narrative recap of what happened in this session. Focus on: what the DM established about the world, key lore revealed, tone and themes, and what was covered for the players. Write in past tense, flowing prose — not a bullet list.

Session transcript:
${text.slice(0, 8000)}

Write the recap now (3-4 sentences, narrative prose):`;

const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.match(/GROQ_API_KEY=([^\n]+)/)?.[1]?.trim()}`,
  },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  }),
});

const groqData = await groqRes.json();
const summary = groqData.choices?.[0]?.message?.content?.trim() ?? '';
console.log('\nGenerated summary:\n', summary);

await prisma.gameSession.update({
  where: { id: 'cmp8681g30005vhe123rytkc6' },
  data: { aiSummary: summary },
});

console.log('\nSaved to DB.');
await prisma.$disconnect();
