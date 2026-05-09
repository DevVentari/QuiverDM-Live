import { chatWithAI } from './chat';
import { z } from 'zod';
import type { BriefingCard } from '@/lib/briefing-types';

export interface GenerateBriefingInput {
  worldState: {
    pressurePolitical: number;
    pressureSupernatural: number;
    pressureEconomic: number;
    pressureCosmic: number;
    pressureSocial: number;
    hooks: Array<{ text: string; urgency: string }>;
    threats: Array<{ name?: string; description?: string }>;
  };
  recentChanges: Array<{
    entityName: string;
    entityType: string;
    changeType: string;
  }>;
  entities: Array<{
    name: string;
    type: string;
    description?: string | null;
  }>;
}

const SYSTEM_PROMPT = `You are the DM Brain for a D&D campaign. Generate a session prep briefing.
Identify 3-7 pressure points from the world state that need the DM's attention this session.
For each, write a specific scene or NPC behavior proposal the DM can use directly at the table.
Return ONLY valid JSON — no markdown, no explanation.`;

function buildPrompt(input: GenerateBriefingInput): string {
  const elevated = [
    { name: 'Political', value: input.worldState.pressurePolitical },
    { name: 'Supernatural', value: input.worldState.pressureSupernatural },
    { name: 'Economic', value: input.worldState.pressureEconomic },
    { name: 'Cosmic', value: input.worldState.pressureCosmic },
    { name: 'Social', value: input.worldState.pressureSocial },
  ]
    .filter((p) => p.value > 0.2)
    .sort((a, b) => b.value - a.value);

  return `World state:
Pressure tracks: ${elevated.map((p) => `${p.name}: ${(p.value * 100).toFixed(0)}%`).join(', ') || 'none elevated'}
Open hooks: ${input.worldState.hooks.map((h) => h.text).join(' | ') || 'none'}
Active threats: ${input.worldState.threats.map((t) => t.name ?? t.description ?? '').filter(Boolean).join(' | ') || 'none'}

Recent world changes:
${input.recentChanges.map((c) => `- ${c.entityName} (${c.entityType}): ${c.changeType}`).join('\n') || 'none'}

Notable entities:
${input.entities.slice(0, 15).map((e) => `- ${e.name} (${e.type})${e.description ? `: ${e.description.slice(0, 100)}` : ''}`).join('\n') || 'none'}

Generate 3-7 pressure point cards as JSON:
{
  "cards": [
    {
      "type": "FACTION" | "NPC" | "HOOK" | "REGION",
      "entityName": "name of the entity or hook",
      "urgencyLevel": 1-5,
      "context": "2-3 sentences: what the Brain knows about this entity, why it matters now",
      "proposal": "3-5 sentences: a specific scene, encounter, or NPC behavior the DM can run this session"
    }
  ]
}

Sort cards by urgencyLevel descending. urgencyLevel 5 = must address this session, 1 = background.`;
}

const ResponseSchema = z.object({
  cards: z.array(
    z.object({
      type: z.enum(['FACTION', 'NPC', 'HOOK', 'REGION']),
      entityName: z.string(),
      urgencyLevel: z.number().int().min(1).max(5),
      context: z.string(),
      proposal: z.string(),
    })
  ),
});

export async function generateBriefingCards(input: GenerateBriefingInput): Promise<BriefingCard[]> {
  const raw = await chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    { temperature: 0.7 }
  );

  try {
    const jsonStr = raw.trim().match(/\{[\s\S]*\}/)?.[0] ?? raw.trim();
    const parsed = ResponseSchema.parse(JSON.parse(jsonStr));
    return parsed.cards.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
      status: 'proposed' as const,
    }));
  } catch (err) {
    console.warn('[generateBriefingCards] failed to parse AI response', err instanceof Error ? err.message : err, raw.slice(0, 300));
    return [];
  }
}
