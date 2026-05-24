import { chatWithAI } from './chat';

export interface PrepBriefInput {
  intentBrief: {
    toneKeywords: string[];
    playerGoals: string[];
    dmOnlyTruths: string[];
  } | null;
  prepSecrets: Array<{
    name: string;
    content: string;
    isCritical?: boolean;
    isRevealed?: boolean;
  }>;
  revealedToPlayers: Array<{ secretName: string }>;
}

const SYSTEM_PROMPT = `You are a Dungeon Master's pre-session advisor. Write a focused 2-4 paragraph prep brief in plain markdown.
Cover: what secrets the players already know, which critical secrets are still hidden, how the session tone should feel, and the one thing the DM must not forget.
Be concise and specific. Write in second person ("You are walking into..."). No headers, no bullet lists — flowing prose only.`;

function buildPrompt(input: PrepBriefInput): string {
  const tone = input.intentBrief?.toneKeywords.join(', ') || 'none set';
  const goals = input.intentBrief?.playerGoals.join(' | ') || 'none set';
  const truths = input.intentBrief?.dmOnlyTruths.join(' | ') || 'none';

  const unrevealed = input.prepSecrets.filter(s => !s.isRevealed);
  const critical = unrevealed.filter(s => s.isCritical);
  const revealed = input.revealedToPlayers.map(r => r.secretName);

  return `Session intent:
Tone: ${tone}
Player goals: ${goals}
DM-only truths: ${truths}

Secrets still hidden (${unrevealed.length}):
${unrevealed.map(s => `- [${s.isCritical ? 'CRITICAL' : 'normal'}] ${s.name}: ${s.content.slice(0, 150)}`).join('\n') || 'none'}

Critical unrevealed (${critical.length}): ${critical.map(s => s.name).join(', ') || 'none'}

Already revealed to players (${revealed.length}): ${revealed.join(', ') || 'none'}

Write the prep brief now.`;
}

export async function generatePrepBrief(input: PrepBriefInput): Promise<string> {
  return chatWithAI(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    { forceProvider: 'claude', temperature: 0.7 }
  );
}
