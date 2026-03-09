import type { WorldEntity } from '@prisma/client';
import type { CoDMSuggestion } from '@/lib/co-dm/types';

const SYSTEM_PROMPT = `You are an experienced Co-DM observing a D&D 5e session from the side. Your role is to support the Dungeon Master by flagging important moments — not to run the game yourself.

You watch for:
- Pacing issues (session dragging, players seem disengaged)
- NPC consistency (character behaving out of alignment with established traits)
- Rule reminders (common rule mistakes or missed interactions)
- Engagement signals (players going quiet, energy dropping)
- Lore continuity (contradictions with established world facts)

Detect whether the session is in RP mode (dialogue, exploration, social) or combat mode, and weight your suggestions accordingly.

Return ONLY a valid JSON array — no markdown, no explanation:
[
  {
    "type": "pacing" | "npc_consistency" | "rule_reminder" | "engagement" | "lore_continuity",
    "score": 0.0-1.0,
    "message": "short one-line summary for the DM",
    "detail": "optional additional context",
    "entityId": "optional world entity id if suggestion relates to a specific entity"
  }
]

Return an empty array [] if nothing notable is detected.`;

export function buildCoDMPrompt(
  chunk: string,
  context: { entities: WorldEntity[]; recentSuggestions: CoDMSuggestion[] }
): string {
  const entitySummary = context.entities
    .slice(0, 30)
    .map((e) => `- ${e.name} (${e.type}): ${e.description?.slice(0, 80) ?? 'no description'}`)
    .join('\n');

  const recentSuggestionSummary = context.recentSuggestions
    .slice(0, 5)
    .map((s) => `- [${s.type}] ${s.message}`)
    .join('\n');

  return `${SYSTEM_PROMPT}

## Known World Entities
${entitySummary || 'None tracked yet.'}

## Recent Suggestions Already Surfaced (avoid duplicates)
${recentSuggestionSummary || 'None.'}

## Transcript Chunk
${chunk.slice(0, 4000)}

Analyze this transcript chunk and return your suggestions as a JSON array.`;
}
