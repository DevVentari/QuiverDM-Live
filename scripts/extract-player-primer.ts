/**
 * Extract a player primer from a Session 0 transcript via Claude.
 *
 * Usage:
 *   npx tsx scripts/extract-player-primer.ts \
 *     --campaign-slug jordans-campaign \
 *     [--session-number 0] \
 *     [--out docs/Jordan-New-Campaign]
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { parseArgs } from 'node:util';
import OpenAI from 'openai';
import { prisma } from '../src/lib/prisma';

const { values: args } = parseArgs({
  options: {
    'campaign-slug':  { type: 'string', default: 'jordans-campaign' },
    'session-number': { type: 'string', default: '0' },
    'out':            { type: 'string', default: 'docs/Jordan-New-Campaign' },
  },
});

const campaignSlug  = args['campaign-slug']!;
const sessionNumber = parseInt(args['session-number']!, 10);
const outDir        = path.resolve(process.cwd(), args['out']!);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlayerPrimer {
  campaignName: string;
  generatedAt: string;

  worldOverview: {
    name: string;
    tagline: string;
    tone: string;
    history: string;
    cosmology: string;
  };

  whatYouKnow: Array<{
    topic: string;
    detail: string;
    confidence: 'established' | 'rumored';
  }>;

  factions: Array<{
    name: string;
    description: string;
    playerRelationship: 'ally' | 'neutral' | 'antagonist' | 'unknown';
    notes: string;
  }>;

  locations: Array<{
    name: string;
    description: string;
    significance: string;
  }>;

  characterGuide: {
    overview: string;
    recommendedClasses: Array<{ class: string; why: string }>;
    recommendedBackgrounds: Array<{ background: string; why: string }>;
    themes: string[];
    warnings: string[];
  };

  mechanics: Array<{
    name: string;
    description: string;
    type: 'house_rule' | 'custom_mechanic' | 'variant_rule';
  }>;
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a campaign scribe for a tabletop RPG. Extract structured information from this Session 0 transcript.

Session 0 is the campaign kickoff: the DM introduces the world, players ask questions, character concepts are discussed, and house rules are established.

Respond ONLY with valid JSON matching this exact shape (no markdown fences, no extra keys):

{
  "campaignName": "string — the campaign or world name as the DM describes it",
  "worldOverview": {
    "name": "string — the world or setting name",
    "tagline": "string — one evocative sentence capturing the world's essence",
    "tone": "string — e.g. 'gritty survival horror', 'dark heroic fantasy', 'political intrigue'",
    "history": "string — 2-3 paragraphs of established world history and context, written as player-facing prose",
    "cosmology": "string — gods, magic system, planes if discussed; empty string if not mentioned"
  },
  "whatYouKnow": [
    {
      "topic": "string — short topic name, e.g. 'The Demon War', 'The Night Cycle'",
      "detail": "string — factual paragraph of what players now know about this topic",
      "confidence": "established | rumored"
    }
  ],
  "factions": [
    {
      "name": "string",
      "description": "string — who they are and what they want",
      "playerRelationship": "ally | neutral | antagonist | unknown",
      "notes": "string — how players should think about this faction"
    }
  ],
  "locations": [
    {
      "name": "string",
      "description": "string — what it is like",
      "significance": "string — why it matters to the players"
    }
  ],
  "characterGuide": {
    "overview": "string — 1-2 sentences on what kinds of characters fit this world",
    "recommendedClasses": [{ "class": "string", "why": "string — 1 sentence" }],
    "recommendedBackgrounds": [{ "background": "string", "why": "string — 1 sentence" }],
    "themes": ["string — motivations or themes that resonate with this setting"],
    "warnings": ["string — things the DM said may not fit, or preferences stated about the campaign"]
  },
  "mechanics": [
    {
      "name": "string — rule name",
      "description": "string — what the rule does and how it works",
      "type": "house_rule | custom_mechanic | variant_rule"
    }
  ]
}

Rules:
- Extract only what is stated in the transcript — do not invent
- "established" = stated as fact by the DM; "rumored" = mentioned as uncertain, legend, or in-world hearsay
- characterGuide must be grounded in what the DM said, not generic advice
- If a section has nothing to extract, use an empty array []
- cosmology: empty string if not discussed
- whatYouKnow: aim for 4-10 items covering the major topics the DM explained
- factions: only groups specifically named and described
- mechanics: include any rules deviations, custom systems, or house rules the DM mentioned`;

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const campaign = await prisma.campaign.findUnique({ where: { slug: campaignSlug } });
  if (!campaign) throw new Error(`Campaign not found: ${campaignSlug}`);
  console.log(`Campaign: ${campaign.name} (${campaign.id})`);

  const session = await prisma.gameSession.findUnique({
    where: { campaignId_sessionNumber: { campaignId: campaign.id, sessionNumber } },
  });
  if (!session) throw new Error(`Session ${sessionNumber} not found in campaign ${campaignSlug}`);
  console.log(`Session: ${session.title} (${session.id})`);

  const transcript = await prisma.transcript.findFirst({
    where: { sessionId: session.id },
    select: { id: true, rawText: true },
  });
  if (!transcript?.rawText) throw new Error(`No transcript found for session ${session.id}`);
  console.log(`Transcript: ${transcript.id} (${transcript.rawText.length} chars)`);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in .env');

  const client = new OpenAI({ apiKey });
  console.log('Extracting via GPT-4o...');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8192,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Session transcript:\n\n${transcript.rawText}` },
    ],
  });

  let raw = (response.choices[0]?.message?.content ?? '').trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  const extracted = JSON.parse(raw) as Omit<PlayerPrimer, 'generatedAt'>;

  const primer: PlayerPrimer = {
    ...extracted,
    campaignName: extracted.campaignName || campaign.name,
    generatedAt: new Date().toISOString(),
  };

  console.log(`Extracted: ${primer.whatYouKnow.length} facts, ${primer.factions.length} factions, ${primer.locations.length} locations, ${primer.mechanics.length} mechanics`);

  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'player-primer.json');
  fs.writeFileSync(jsonPath, JSON.stringify(primer, null, 2), 'utf8');
  console.log(`\nWrote: ${jsonPath}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
