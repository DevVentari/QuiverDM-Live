/**
 * DM Prompt Service
 *
 * Generates real-time DM hints based on recent transcript and equipped homebrew effects.
 * Fire-and-forget safe: never throws, returns [] on any error.
 */

import { prisma } from '../db';

export interface DmPrompt {
  text: string;
  priority: 'info' | 'important';
  effectName?: string;
}

async function getCharacterEffectsForCampaign(campaignId: string): Promise<string> {
  try {
    // Get active campaign characters with equipped homebrew items
    const campaignCharacters = await prisma.campaignCharacter.findMany({
      where: { campaignId, isActive: true },
      include: {
        character: {
          include: {
            homebrewItems: {
              where: { equipped: true },
              include: {
                homebrew: { select: { name: true, data: true } },
              },
            },
          },
        },
      },
    });

    const effectLines: string[] = [];

    for (const cc of campaignCharacters) {
      for (const ci of cc.character.homebrewItems) {
        const data = ci.homebrew.data as Record<string, unknown>;
        const rawEffects = Array.isArray(data.effects) ? data.effects : [];
        for (const effect of rawEffects) {
          if (
            typeof (effect as any)?.name === 'string' &&
            typeof (effect as any)?.description === 'string'
          ) {
            effectLines.push(`- [${ci.homebrew.name}] ${(effect as any).name}: ${(effect as any).description}`);
          }
        }
      }
    }

    return effectLines.join('\n');
  } catch {
    return '';
  }
}

function buildPrompt(recentTranscriptText: string, effectsSummary: string): string {
  const effectsSection = effectsSummary.trim()
    ? `\nEquipped homebrew item effects active in this session:\n${effectsSummary}\n`
    : '';

  return `You are a D&D 5e DM assistant. Based on the recent dialogue and the party's equipped item effects, generate 1-3 brief actionable hints for the DM.${effectsSection}
Recent dialogue:
${recentTranscriptText}

Return ONLY a JSON array, no explanation, no code fences:
[{"text": "<brief DM hint>", "priority": "info", "effectName": "<optional effect name if hint relates to a specific effect>"}]

Rules:
- "priority" must be exactly "info" or "important"
- Use "important" only for time-sensitive or safety-critical hints
- "effectName" is optional; include only if the hint directly relates to a specific item effect
- Each "text" must be under 120 characters
- Return [] if nothing relevant to suggest`;
}

function parseResponse(text: string): DmPrompt[] {
  let cleaned = text.trim();

  const fenceMatch = cleaned.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (h: any) =>
          typeof h?.text === 'string' &&
          (h.priority === 'info' || h.priority === 'important')
      )
      .map((h: any): DmPrompt => ({
        text: h.text,
        priority: h.priority as 'info' | 'important',
        effectName: typeof h.effectName === 'string' ? h.effectName : undefined,
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateDmPrompts(
  sessionId: string,
  campaignId: string,
  recentTranscriptText: string
): Promise<DmPrompt[]> {
  try {
    const effectsSummary = await getCharacterEffectsForCampaign(campaignId);
    const prompt = buildPrompt(recentTranscriptText, effectsSummary);

    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';

    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) return [];

    const result = await response.json();
    return parseResponse(result.response ?? '');
  } catch (err) {
    console.warn(
      `[dm-prompt.service] Failed to generate hints for session ${sessionId}:`,
      err instanceof Error ? err.message : 'Unknown error'
    );
    return [];
  }
}
