import type { PrismaClient } from '@prisma/client';
import { chatWithAI } from '../ai/chat';
import { RecapContentSchema, DEFAULT_THEME, type RecapTheme } from '@quiverdm/shared';

type Line = { index: number; speaker: string; text: string; start: number };
type Mark = { index: number; verdict?: 'strike' | 'stet' };
type Roster = { characterName: string | null; characterClass: string | null; name: string | null };

export function buildReviewedTranscript(lines: Line[], oocMarks: Mark[]): string {
  const struck = new Set(oocMarks.filter((m) => m.verdict === 'strike').map((m) => m.index));
  const kept = lines.filter((l) => !struck.has(l.index));
  const blocks: { speaker: string; text: string }[] = [];
  for (const l of kept) {
    const last = blocks[blocks.length - 1];
    if (last && last.speaker === l.speaker) last.text += ` ${l.text}`;
    else blocks.push({ speaker: l.speaker, text: l.text });
  }
  return blocks.map((b) => `${b.speaker}: ${b.text}`).join('\n\n');
}

const SCHEMA_HINT = `Return ONLY a JSON object (no prose, no code fences) matching exactly:
{
  "header": { "eyebrow": string, "title": string, "subtitle"?: string },
  "statline": [{ "label": string, "value": string }],
  "lede": string,
  "panels": {
    "party": [{ "name": string, "role"?: string, "status": "alive"|"down"|"dead"|"absent", "note"?: string }],
    "timeline": [{ "title": string, "tag"?: string, "body": string, "marker": "normal"|"reveal"|"flag"|"win" }],
    "npcs": [{ "name": string, "note"?: string, "disposition": "ally"|"neutral"|"hostile"|"unknown" }],
    "locations": [{ "name": string, "note"?: string }],
    "adversaries": [{ "name": string, "note"?: string, "status"?: "alive"|"down"|"dead"|"absent" }],
    "threads": [{ "title": string, "body"?: string, "marker": "normal"|"reveal"|"flag"|"win" }],
    "whereWeLeftOff": string
  }
}`;

export function buildMessages(transcript: string, roster: Roster[], meta: { title: string }) {
  const party = roster
    .map((r) => `- ${r.characterName ?? 'Unknown'}${r.characterClass ? ` (${r.characterClass})` : ''}${r.name ? ` — played by ${r.name}` : ''}`)
    .join('\n');
  const system = [
    'You are the chronicler of a Dungeons & Dragons campaign. Distill one session transcript into a structured recap.',
    'Rules: include ONLY what actually happened in THIS session. Do not invent names, places, or events.',
    'Tag a timeline/thread beat "reveal" when a secret or truth surfaces, "flag" when something ominous or unresolved is introduced, "win" for a decisive victory, else "normal".',
    'Leave a panel array empty when the session had none of that thing. Write "lede" and "whereWeLeftOff" as evocative but accurate prose (2-4 sentences each).',
    SCHEMA_HINT,
  ].join('\n\n');
  const user = [
    `Session title (working): ${meta.title}`,
    party ? `The party (use these exact character names/classes):\n${party}` : 'The party roster is unknown; infer character names from the transcript.',
    'Transcript (speaker: line):',
    transcript,
  ].join('\n\n');
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no json object');
  return JSON.parse(body.slice(start, end + 1));
}

export async function generateSessionRecap(
  prisma: PrismaClient,
  input: { campaignId: string; sessionId: string },
): Promise<void> {
  const transcript = await prisma.transcript.findFirst({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, timestamps: true, oocReviewItems: true },
  });
  const session = await prisma.gameSession.findFirst({
    where: { id: input.sessionId, campaignId: input.campaignId },
    select: { title: true, sessionNumber: true },
  });
  const campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId }, select: { theme: true } });
  const roster = await prisma.player.findMany({
    where: { campaignId: input.campaignId },
    select: { characterName: true, characterClass: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  const theme = (campaign?.theme as unknown as RecapTheme) ?? DEFAULT_THEME;
  const base = { where: { sessionId: input.sessionId }, create: { sessionId: input.sessionId, status: 'generating' } as const };

  if (!transcript) {
    await prisma.forgeRecap.upsert({ ...base, update: { status: 'failed', error: 'No transcript found for this session.' } });
    return;
  }

  const ts = (Array.isArray(transcript.timestamps) ? transcript.timestamps : []) as unknown as Array<{ start: number; end: number; text: string; speaker: string }>;
  const lines: Line[] = ts.map((t, index) => ({ index, speaker: t.speaker, text: t.text, start: t.start }));
  const marks = (Array.isArray(transcript.oocReviewItems) ? transcript.oocReviewItems : []) as unknown as Mark[];
  const reviewed = buildReviewedTranscript(lines, marks);
  const messages = buildMessages(reviewed, roster, { title: session?.title ?? `Session ${session?.sessionNumber ?? ''}`.trim() });

  let lastRaw = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      lastRaw = await chatWithAI(attempt === 0 ? messages : [...messages, { role: 'user', content: 'Your previous reply was not valid JSON. Reply with ONLY the JSON object.' }], { forceProvider: 'claude' });
      const parsed = RecapContentSchema.parse(extractJson(lastRaw));
      await prisma.forgeRecap.upsert({
        ...base,
        update: { status: 'ready', content: parsed as object, themeSnapshot: theme as object, error: null, rawOutput: null },
      });
      return;
    } catch (e) {
      if (attempt === 1) {
        await prisma.forgeRecap.upsert({
          ...base,
          update: { status: 'failed', error: e instanceof Error ? e.message : 'Generation failed', rawOutput: lastRaw.slice(0, 8000) },
        });
      }
    }
  }
}
