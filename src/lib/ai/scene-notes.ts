/**
 * AI note functions for the scene note builder. Invisible-AI: seed an initial
 * note set, draft one note, suggest "ghost" notes, refine prose inline. Uses
 * chatWithAI Claude-first via the provider chain — never forceProvider, so a
 * Claude outage falls back. Mirrors the defensive parse of generate-statblock.ts.
 */
import { z } from 'zod';
import { chatWithAI, type ChatMessage } from './chat';
import type { SceneContext } from './generate-scene';

export type NoteContext = SceneContext;
export type NoteType = 'read_aloud' | 'tactic' | 'secret' | 'check' | 'lore' | 'trigger';

const noteSchema = z.object({
  type: z.enum(['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger']),
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(2000),
  data: z
    .union([
      z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(30) }),
      z.object({
        condition: z.string().max(300),
        dc: z.object({ skill: z.string().max(40), dc: z.number().int().min(1).max(30) }).nullish(),
        reveal: z.string().max(600).nullish(),
      }),
    ])
    .nullish(),
});
export type NoteDraft = z.infer<typeof noteSchema>;
const notesSchema = z.object({ notes: z.array(noteSchema).max(12) });

function extractJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('nothing usable');
  return JSON.parse(match[0]);
}

function contextBlock(ctx: NoteContext): string {
  const cast = ctx.tagged.length
    ? ctx.tagged.map((e) => {
        const hist = e.history?.length ? ` | past: ${e.history.join('; ')}` : '';
        return `- ${e.name} (${e.type})${e.statSummary ? ` — ${e.statSummary}` : ''}${e.description ? `: ${e.description}` : ''}${hist}`;
      }).join('\n')
    : '- (none tagged)';
  const party = ctx.party.length
    ? ctx.party.map((p) => `- ${p.name}: ${p.summary}${p.hook ? ` | hook: ${p.hook}` : ''}`).join('\n')
    : '- (none)';
  return [
    ctx.campaignName ? `Campaign: ${ctx.campaignName}` : '',
    ctx.mood ? `Mood: ${ctx.mood}` : '',
    `Scene: ${ctx.intent.trim()}`,
    `Cast & locations (weave their past in):\n${cast}`,
    `Party (hook the scene to a bond where natural):\n${party}`,
  ].filter(Boolean).join('\n\n');
}

const NOTE_SHAPES = `Note shapes (STRICT JSON, no fences):
- read_aloud: { "type":"read_aloud", "body": player-facing prose to speak }
- tactic:     { "type":"tactic", "body": how a creature/NPC behaves }
- secret:     { "type":"secret", "body": hidden fact/consequence }
- lore:       { "type":"lore", "body": background/continuity tidbit }
- check:      { "type":"check", "body": what it reveals, "data": { "skill": string, "dc": 1-30 } }
- trigger:    { "type":"trigger", "body": short summary, "data": { "condition": "if players …", "dc": {"skill":string,"dc":1-30}|null, "reveal": read-aloud-on-trigger|null } }`;

async function call(messages: ChatMessage[], temperature: number): Promise<string> {
  // Claude-first via AI_PROVIDER_ORDER; NEVER forceProvider (a Claude outage must fall back).
  return chatWithAI(messages, { temperature });
}

export async function seedSceneNotes(ctx: NoteContext): Promise<NoteDraft[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM building run-help for a scene as STRICT JSON: { "notes": Note[] }.\n${NOTE_SHAPES}\nProduce 3-6 notes: at least one read_aloud, plus the tactics/secrets/checks a DM would otherwise run from memory. Weave the cast's past and party hooks in naturally. Player-safe text in read_aloud; hidden material in secret/trigger.` },
    { role: 'user', content: contextBlock(ctx) },
  ];
  return parseNotes(await call(messages, 0.8));
}

export async function draftNote(ctx: NoteContext, type: NoteType, hint?: string): Promise<NoteDraft> {
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM. Write ONE scene note of type "${type}" as STRICT JSON (no fences).\n${NOTE_SHAPES}` },
    { role: 'user', content: `${contextBlock(ctx)}\n\nWrite the ${type} note.${hint ? ` Focus: ${hint}` : ''}` },
  ];
  const parsed = parseOne(await call(messages, 0.8));
  return { ...parsed, type };
}

export async function suggestNotes(ctx: NoteContext, existing: Array<{ type: string; body: string }>): Promise<NoteDraft[]> {
  const have = existing.length ? existing.map((n) => `- ${n.type}: ${n.body}`).join('\n') : '- (none yet)';
  const messages: ChatMessage[] = [
    { role: 'system', content: `You are a D&D 5e co-DM. The DM asks "what am I forgetting?". Propose 2-4 NEW notes they're missing as STRICT JSON { "notes": Note[] }. Do not repeat existing notes.\n${NOTE_SHAPES}` },
    { role: 'user', content: `${contextBlock(ctx)}\n\nExisting notes:\n${have}` },
  ];
  return parseNotes(await call(messages, 0.9));
}

export async function refineNote(body: string, instruction: string): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: 'Rewrite the DM scene-note text per the instruction. Return ONLY the rewritten text — no quotes, no preamble.' },
    { role: 'user', content: `Instruction: ${instruction}\n\nText:\n${body}` },
  ];
  const out = (await call(messages, 0.7)).trim();
  if (!out) throw new Error('The refinement could not be read. Try again.');
  return out;
}

function parseNotes(raw: string): NoteDraft[] {
  let parsed: unknown;
  try { parsed = extractJson(raw); } catch { throw new Error('The notes could not be read. Try again or rephrase.'); }
  const result = notesSchema.safeParse(parsed);
  if (!result.success) throw new Error('The notes could not be read. Try again or rephrase.');
  return result.data.notes;
}

function parseOne(raw: string): NoteDraft {
  let parsed: unknown;
  try { parsed = extractJson(raw); } catch { throw new Error('The note could not be read. Try again or rephrase.'); }
  const result = noteSchema.safeParse(parsed);
  if (!result.success) throw new Error('The note could not be read. Try again or rephrase.');
  return result.data;
}
