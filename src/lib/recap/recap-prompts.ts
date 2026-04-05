export const SECTION_SHAPES = {
  NARRATIVE: [
    { key: 'setup', title: 'Setting the Scene' },
    { key: 'key_events', title: 'What Unfolded' },
    { key: 'resolution', title: 'Resolution' },
    { key: 'cliffhanger', title: 'To Be Continued' },
  ],
  SESSION_LOG: [
    { key: 'key_events', title: 'Key Events' },
    { key: 'npcs_met', title: 'NPCs Met' },
    { key: 'decisions', title: 'Decisions Made' },
    { key: 'loot', title: 'Loot & Rewards' },
  ],
  BARDS_TALE: [
    { key: 'tale', title: "The Bard's Tale" },
  ],
  PREVIOUSLY_ON: [
    { key: 'cold_open', title: 'Previously On…' },
  ],
} as const;

export type RecapStyleKey = keyof typeof SECTION_SHAPES;

const SYSTEM_PROMPT =
  'You are an expert D&D session recorder. Respond ONLY with valid JSON — no prose, no markdown fencing, no explanation.';

const STYLE_INSTRUCTIONS: Record<RecapStyleKey, string> = {
  NARRATIVE:
    'Write a dramatic third-person narrative (~150 words per section) that reads like a novel excerpt.',
  SESSION_LOG:
    'Write a structured session log. key_events as a numbered list. All other sections as bullet points (~80 words per section).',
  BARDS_TALE:
    "Write a first-person bard's account, theatrical and entertaining, as told at a tavern (~300 words).",
  PREVIOUSLY_ON:
    'Write a 3–4 sentence cold-open recap, punchy and dramatic, suitable for reading aloud at the start of the next session (~60 words total).',
};

export interface RecapPromptContext {
  correctedText: string;
  speakersJson: string;
  campaignContext: string;
  style: RecapStyleKey;
}

export function buildRecapPrompt(ctx: RecapPromptContext): { system: string; user: string } {
  const shapes = SECTION_SHAPES[ctx.style];
  const sectionSpec = shapes
    .map((s) => `  { "key": "${s.key}", "title": "${s.title}", "content": "..." }`)
    .join(',\n');

  const user = `Generate a D&D session recap in the "${ctx.style}" style.
${STYLE_INSTRUCTIONS[ctx.style]}

CAMPAIGN CONTEXT (prior sessions):
${ctx.campaignContext || 'No prior context available.'}

SPEAKERS:
${ctx.speakersJson}

TRANSCRIPT:
${ctx.correctedText}

Respond with this exact JSON structure — fill each "content" field, keep keys and titles verbatim:
{
  "sections": [
${sectionSpec}
  ]
}`;

  return { system: SYSTEM_PROMPT, user };
}
