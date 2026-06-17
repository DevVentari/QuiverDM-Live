/**
 * AI scene generation. Turns a DM's short description + tagged compendium
 * entities into a structured scene: player-facing read-aloud, secret DM prep,
 * a music cue, suggested checks, and per-entity beats. Mirrors the defensive
 * JSON-parse pattern in generate-statblock.ts. Validated, never trusted raw.
 */
import { z } from 'zod';
import { chatWithAI, type ChatMessage } from './chat';

export type SceneType = 'rp' | 'description' | 'tavern' | 'battle' | 'theatre';

export interface SceneContext {
  intent: string;
  mood?: SceneType;
  tagged: Array<{ id: string; name: string; type: string; description?: string; statSummary?: string }>;
  party: Array<{ name: string; summary: string }>;
  campaignName?: string;
}

const sceneSchema = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(['rp', 'description', 'tavern', 'battle', 'theatre']),
  readAloud: z.string().max(4000).default(''),
  dmNotes: z.string().max(4000).default(''),
  musicCue: z.string().max(160).default(''),
  suggestedChecks: z
    .array(z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(30), note: z.string().max(300) }))
    .max(8)
    .default([]),
  entityBeats: z
    .record(z.object({ wantsInScene: z.string().max(400), secret: z.string().max(400).nullable() }))
    .default({}),
});

export type GeneratedScene = z.infer<typeof sceneSchema>;

const SYSTEM_PROMPT = `You are a Dungeons & Dragons 5e co-DM. Given a scene description and the cast/locations present, write a single scene as STRICT JSON — no prose, no markdown fences.

Return exactly:
{
  "title": short evocative scene title,
  "type": one of "rp" | "description" | "tavern" | "battle" | "theatre",
  "readAloud": 2-4 sentences of PLAYER-FACING narration. Atmospheric, second person, NO secrets or hidden info,
  "dmNotes": secret DM prep — what is really going on, complications, how it could turn,
  "musicCue": a short evocative audio cue, e.g. "low dread strings",
  "suggestedChecks": array of { "skill": string, "dc": integer 1-30, "note": what it reveals },
  "entityBeats": object keyed by the EXACT entity id given, each { "wantsInScene": what they want here, "secret": a hidden fact or null }
}

Weave every tagged entity into the scene. Keep readAloud safe to read at the table. Put all hidden material in dmNotes / entityBeats.secret. Return ONLY the JSON object.`;

/** Pull the first JSON object out of a model response, tolerating code fences. */
function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The vision returned nothing usable.');
  return JSON.parse(match[0]);
}

function buildUserMessage(ctx: SceneContext): string {
  const cast = ctx.tagged.length
    ? ctx.tagged
        .map(
          (e) =>
            `- [${e.id}] ${e.name} (${e.type})${e.statSummary ? ` — ${e.statSummary}` : ''}${e.description ? `: ${e.description}` : ''}`,
        )
        .join('\n')
    : '- (none tagged)';
  const party = ctx.party.length
    ? ctx.party.map((p) => `- ${p.name}: ${p.summary}`).join('\n')
    : '- (none specified)';
  return [
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : '',
    ctx.mood ? `Mood: ${ctx.mood}` : '',
    `Scene description: ${ctx.intent.trim()}`,
    `Cast & locations present (use these exact ids in entityBeats):\n${cast}`,
    `Party present:\n${party}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function generateScene(
  ctx: SceneContext,
  options: { userId?: string } = {},
): Promise<GeneratedScene> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(ctx) },
  ];

  // Scenes are creative writing — Claude gives the best voice, so AI_PROVIDER_ORDER
  // lists it first. We deliberately do NOT force a single provider: a Claude outage
  // (e.g. an out-of-credits 400) must fall back through the chain rather than 500.
  // Same approach as generate-statblock.ts.
  const raw = await chatWithAI(messages, { temperature: 0.8, userId: options.userId });

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    throw new Error('The generated scene could not be read. Try again or rephrase.');
  }

  const result = sceneSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('The generated scene could not be read. Try again or rephrase.');
  }
  return result.data;
}
