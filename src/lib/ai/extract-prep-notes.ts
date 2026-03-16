import { chatWithOllama } from './ollama';
import type { SessionPrepData } from '@/lib/prep-types';

export interface ExtractPrepNotesInput {
  text: string;
  campaignContext: {
    npcs: Array<{ id: string; name: string }>;
    characters: Array<{ id: string; name: string }>;
    recentSessions: Array<{ title?: string | null; recap?: string | null }>;
  };
}

const SYSTEM_PROMPT = `You are a D&D session prep assistant. Extract structured prep content from the DM's raw notes.
Return ONLY valid JSON matching the schema. Omit any field where no relevant content exists in the notes.`;

function buildUserPrompt(text: string, context: ExtractPrepNotesInput['campaignContext']): string {
  return `Campaign context:
- Characters: ${context.characters.map(c => c.name).join(', ') || 'none'}
- Known NPCs: ${context.npcs.map(n => n.name).join(', ') || 'none'}
- Recent sessions: ${context.recentSessions.map(s => s.title ?? 'Untitled').join(', ') || 'none'}

DM Notes:
${text}

Extract prep content as JSON with these optional fields:
{
  "strongStart": "string — opening hook or scene",
  "scenes": [{ "title": "string", "description": "string" }],
  "secretsAndClues": [{ "secret": "string" }],
  "npcs": [{ "name": "string", "goal": "string" }],
  "monsters": [{ "name": "string", "notes": "string" }],
  "rewards": [{ "name": "string", "description": "string" }],
  "looseThreads": [{ "thread": "string" }]
}`;
}

export async function extractPrepNotes(
  input: ExtractPrepNotesInput
): Promise<Partial<SessionPrepData>> {
  const raw = await chatWithOllama(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(input.text, input.campaignContext) },
    ],
    { format: 'json', temperature: 0.3 }
  );

  try {
    return JSON.parse(raw) as Partial<SessionPrepData>;
  } catch {
    return {};
  }
}
