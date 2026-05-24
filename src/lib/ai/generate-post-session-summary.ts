import { chatWithAI } from './chat';

export interface PostSessionSummaryInput {
  sessionTitle: string | null;
  revealedThisSession: Array<{ secretName: string; content: string }>;
  phasesElapsed: Array<{ name: string; targetMinutes: number }>;
  activeNpcNames: string[];
}

const SYSTEM_PROMPT = `You are a Dungeon Master's session recap assistant. Write a concise 2-3 paragraph post-session summary in plain markdown.
Cover: what secrets were revealed and what that means for the story, which NPCs were active, and what threads remain open.
Write in past tense. No headers, no bullet lists — flowing narrative prose.`;

function buildPrompt(input: PostSessionSummaryInput): string {
  const title = input.sessionTitle ?? 'Unnamed session';
  const revealed = input.revealedThisSession;
  const phases = input.phasesElapsed.map(p => p.name).join(' → ');
  const npcs = input.activeNpcNames.join(', ') || 'none';

  return `Session: ${title}

Secrets revealed this session (${revealed.length}):
${revealed.map(s => `- ${s.secretName}: ${s.content.slice(0, 120)}`).join('\n') || 'none'}

Phases played: ${phases || 'untracked'}
Active NPCs: ${npcs}

Write the post-session summary now.`;
}

export async function generatePostSessionSummary(input: PostSessionSummaryInput): Promise<string> {
  return chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    { forceProvider: 'claude', temperature: 0.6 }
  );
}
