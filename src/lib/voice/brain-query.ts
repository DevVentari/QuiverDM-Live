import type { ChatMessage } from '@/lib/ai/chat';
import { chatWithAI } from '@/lib/ai/chat';
import { brainRepository } from '@/server/repositories/brain.repository';

export async function answerBrainQuery(query: string, campaignId: string): Promise<string> {
  const [entities, relationships] = await Promise.all([
    brainRepository.findEntities(campaignId),
    brainRepository.findRelationships(campaignId),
  ]);

  const entityLines = entities.slice(0, 40).map((e) => {
    const desc = e.description ? ` — ${e.description.slice(0, 120)}` : '';
    return `${e.name} (${e.type})${desc}`;
  });

  const relationshipLines = relationships.slice(0, 30).map((r) => {
    const from = entities.find((e) => e.id === r.fromEntityId)?.name ?? r.fromEntityId;
    const to = entities.find((e) => e.id === r.toEntityId)?.name ?? r.toEntityId;
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
