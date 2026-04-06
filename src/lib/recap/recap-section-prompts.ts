import { STYLE_INSTRUCTIONS, RecapStyleKey } from './recap-prompts';

export interface SectionRegenContext {
  correctedText: string;
  sectionKey: string;
  sectionTitle: string;
  style: RecapStyleKey;
  dmNote?: string;
}

export function buildSectionRegenPrompt(ctx: SectionRegenContext): { system: string; user: string } {
  const system =
    'You are an expert D&D session recorder. Respond ONLY with the section content text — no JSON, no markdown, no preamble, no title.';
  const instruction = STYLE_INSTRUCTIONS[ctx.style];
  const noteBlock = ctx.dmNote ? `\nDM NOTE (incorporate this): ${ctx.dmNote}\n` : '';
  const user = `Rewrite only the "${ctx.sectionTitle}" section of a D&D session recap.
Style instructions: ${instruction}
${noteBlock}
TRANSCRIPT:
${ctx.correctedText}

Write only the section content. Do not include the section title or any JSON.`;
  return { system, user };
}
