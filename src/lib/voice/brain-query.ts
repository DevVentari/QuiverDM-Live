import type { ChatMessage } from '@/lib/ai/chat';
import { chatWithAI } from '@/lib/ai/chat';
import { brainRepository } from '@/server/repositories/brain.repository';
import { selectRelevantEntities } from '@/lib/voice/brain-context-selector';

export async function answerBrainQuery(query: string, campaignId: string): Promise<string> {
  const [entities, relationships] = await Promise.all([
    brainRepository.findEntities(campaignId),
    brainRepository.findRelationships(campaignId),
  ]);

  const { selected, droppedCount } = selectRelevantEntities(query, entities, relationships);
  if (droppedCount > 0) {
    console.warn(`[brain-query] dropped ${droppedCount} entities beyond context limit for campaign ${campaignId}`);
  }

  const selectedIds = new Set(selected.map((e) => e.id));

  const entityLines = selected.map((e) => {
    const desc = e.description ? ` — ${e.description.slice(0, 120)}` : '';
    return `${e.name} (${e.type})${desc}`;
  });

  const relationshipLines = relationships
    .filter((r) => selectedIds.has(r.fromEntityId) && selectedIds.has(r.toEntityId))
    .slice(0, 30)
    .map((r) => {
      const from = selected.find((e) => e.id === r.fromEntityId)?.name ?? r.fromEntityId;
      const to = selected.find((e) => e.id === r.toEntityId)?.name ?? r.toEntityId;
      return `${from} → ${r.type} → ${to}`;
    });

  const worldContext = [
    entityLines.length > 0 ? `Entities:\n${entityLines.join('\n')}` : '',
    relationshipLines.length > 0 ? `Relationships:\n${relationshipLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a DM assistant for a D&D campaign. Answer questions concisely based on the world knowledge provided. Keep responses under 3 sentences. If the information is not in the world context, say so briefly.\n\nWorld Knowledge:\n${worldContext || 'No entities recorded yet.'}`,
    },
    {
      role: 'user',
      content: query,
    },
  ];

  return chatWithAI(messages, { temperature: 0.3 });
}
