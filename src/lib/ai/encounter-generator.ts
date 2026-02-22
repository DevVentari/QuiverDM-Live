/**
 * AI Encounter Generator
 *
 * Uses the multi-provider AI system to generate D&D 5e encounters
 * from natural language prompts.
 */

import { isOllamaAvailable, chatWithOllama } from './ollama';
import { getXpBudget, getCrRangeForDifficulty, xpForCr } from '../dnd5e/encounter-calculator';
import { getMonstersByCrRange, type SrdMonster } from '../srd/monsters';

export type EncounterDifficulty = 'easy' | 'medium' | 'hard' | 'deadly';

export interface GeneratedCreature {
  name: string;
  count: number;
  cr: string;
  xp: number;
  sourceType: 'srd' | 'npc' | 'homebrew' | 'custom';
  sourceId?: string;
  statBlock?: Record<string, unknown>;
}

export interface EncounterGenerationRequest {
  userPrompt: string;
  partySize: number;
  partyLevel: number;
  difficulty: EncounterDifficulty;
  campaignNpcs?: Array<{ id: string; name: string; cr?: string; stats?: Record<string, unknown> }>;
  homebrewCreatures?: Array<{ id: string; name: string; data?: Record<string, unknown> }>;
}

export interface EncounterGenerationResult {
  success: boolean;
  sceneDescription: string;
  tacticalNotes: string;
  creatures: GeneratedCreature[];
  error?: string;
}

function buildSystemPrompt(
  request: EncounterGenerationRequest,
  srdMonsters: SrdMonster[]
): string {
  const budget = getXpBudget(request.partySize, request.partyLevel, request.difficulty);
  const crRange = getCrRangeForDifficulty(request.partyLevel, request.difficulty);

  const monsterList = srdMonsters
    .slice(0, 30) // limit context size
    .map((m) => `- ${m.name} (CR ${m.challengeRating}, ${m.type}, ${m.xp} XP)`)
    .join('\n');

  const npcList =
    request.campaignNpcs && request.campaignNpcs.length > 0
      ? request.campaignNpcs
          .slice(0, 10)
          .map((n) => `- ${n.name} (Campaign NPC${n.cr ? ', CR ' + n.cr : ''})`)
          .join('\n')
      : 'None';

  const homebrewList =
    request.homebrewCreatures && request.homebrewCreatures.length > 0
      ? request.homebrewCreatures
          .slice(0, 10)
          .map((h) => `- ${h.name} (Homebrew creature)`)
          .join('\n')
      : 'None';

  return `You are an expert D&D 5e Dungeon Master designing encounters.

PARTY: ${request.partySize} characters at level ${request.partyLevel}
TARGET DIFFICULTY: ${request.difficulty}
XP BUDGET: ${budget.target} XP (${budget.easy} easy / ${budget.medium} medium / ${budget.hard} hard / ${budget.deadly} deadly)
SUGGESTED CR RANGE: ${crRange.min}–${crRange.max}

AVAILABLE SRD MONSTERS (prefer these, but you can suggest others by name):
${monsterList}

CAMPAIGN NPCs (can be used as enemies/allies):
${npcList}

HOMEBREW CREATURES:
${homebrewList}

Respond with ONLY valid JSON in this exact shape:
{
  "sceneDescription": "2-3 sentences of vivid scene-setting prose for the DM to read aloud",
  "tacticalNotes": "2-3 DM tips: positioning, tactics, environmental hazards, how monsters behave",
  "creatures": [
    {
      "name": "Monster Name",
      "count": 2,
      "cr": "1",
      "xp": 200,
      "sourceType": "srd"
    }
  ]
}

Rules:
- sourceType must be exactly "srd", "npc", "homebrew", or "custom"
- For SRD monsters, use names exactly as listed above
- For campaign NPCs, use sourceType "npc" and match the name exactly
- For homebrew creatures, use sourceType "homebrew" and match the name exactly
- For monsters not in any list, use sourceType "custom"
- Keep total adjusted XP near the ${request.difficulty} budget of ${budget.target} XP
- Adjust count to balance the encounter
- xp should be XP per individual creature (not total)
- cr should be a string: "0", "1/8", "1/4", "1/2", "1", "2", ... "30"`;
}

function parseEncounterResponse(text: string): Omit<EncounterGenerationResult, 'success' | 'error'> | null {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Find the JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    const sceneDescription = typeof parsed.sceneDescription === 'string' ? parsed.sceneDescription : '';
    const tacticalNotes = typeof parsed.tacticalNotes === 'string' ? parsed.tacticalNotes : '';
    const rawCreatures = Array.isArray(parsed.creatures) ? parsed.creatures : [];

    const creatures: GeneratedCreature[] = rawCreatures
      .filter((c: unknown) => c && typeof c === 'object' && 'name' in (c as object))
      .map((c: Record<string, unknown>) => ({
        name: String(c.name ?? ''),
        count: Number(c.count ?? 1),
        cr: String(c.cr ?? '1'),
        xp: Number(c.xp ?? xpForCr(String(c.cr ?? '1'))),
        sourceType: (['srd', 'npc', 'homebrew', 'custom'].includes(String(c.sourceType))
          ? c.sourceType
          : 'custom') as GeneratedCreature['sourceType'],
        sourceId: c.sourceId ? String(c.sourceId) : undefined,
        statBlock: c.statBlock as Record<string, unknown> | undefined,
      }))
      .filter((c: GeneratedCreature) => c.name.length > 0);

    return { sceneDescription, tacticalNotes, creatures };
  } catch {
    return null;
  }
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER REQUEST: ${prompt}` }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAnthropic(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callOllama(prompt: string, systemPrompt: string): Promise<string> {
  const available = await isOllamaAvailable();
  if (!available) throw new Error('Ollama not running');

  const content = await chatWithOllama([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ]);

  return content;
}

type Provider = 'gemini' | 'anthropic' | 'openai' | 'ollama';

function getAvailableProviders(): Provider[] {
  const providers: Provider[] = [];
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  providers.push('ollama'); // always attempt; will fail gracefully
  return providers;
}

async function callProvider(provider: Provider, prompt: string, systemPrompt: string): Promise<string> {
  switch (provider) {
    case 'gemini':    return callGemini(prompt, systemPrompt);
    case 'anthropic': return callAnthropic(prompt, systemPrompt);
    case 'openai':    return callOpenAI(prompt, systemPrompt);
    case 'ollama':    return callOllama(prompt, systemPrompt);
  }
}

/**
 * Generate an encounter from a natural language prompt.
 * Tries cloud providers first, then Ollama as fallback.
 */
export async function generateEncounter(
  request: EncounterGenerationRequest
): Promise<EncounterGenerationResult> {
  const crRange = getCrRangeForDifficulty(request.partyLevel, request.difficulty);
  const srdMonsters = getMonstersByCrRange(crRange.min, crRange.max);

  const systemPrompt = buildSystemPrompt(request, srdMonsters);
  const providers = getAvailableProviders();

  let lastError = 'No AI providers available';

  for (const provider of providers) {
    try {
      const raw = await callProvider(provider, request.userPrompt, systemPrompt);
      const parsed = parseEncounterResponse(raw);

      if (parsed && parsed.creatures.length > 0) {
        return { success: true, ...parsed };
      }

      lastError = `${provider} returned unparseable response`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[EncounterGenerator] ${provider} failed: ${lastError}`);
    }
  }

  return {
    success: false,
    sceneDescription: '',
    tacticalNotes: '',
    creatures: [],
    error: lastError,
  };
}
