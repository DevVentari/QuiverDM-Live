import type { ChatMessage } from '../ai/chat';

export function buildTitlerMessages(transcriptExcerpt: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'You title a D&D session for a printed chronicle. Reply ONLY with JSON: ' +
        '{"title": string (<=6 words, evocative), "voice": string (one lowercase phrase, <=10 words, the session\'s feel), "chapter": number|null}. No prose.',
    },
    { role: 'user', content: `Session transcript excerpt:\n\n${transcriptExcerpt.slice(0, 6000)}` },
  ];
}

export function parseTitlerResponse(raw: string): { title: string; voice: string; chapter: number | null } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { title: '', voice: '', chapter: null };
  try {
    const j = JSON.parse(match[0]) as { title?: string; voice?: string; chapter?: number };
    return {
      title: typeof j.title === 'string' ? j.title.trim() : '',
      voice: typeof j.voice === 'string' ? j.voice.trim() : '',
      chapter: typeof j.chapter === 'number' ? j.chapter : null,
    };
  } catch {
    return { title: '', voice: '', chapter: null };
  }
}
