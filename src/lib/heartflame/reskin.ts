/**
 * Heartflame — optional AI re-skin (the diagram's final, optional box).
 *
 * Re-words a chosen flavour line in the Heartflame's voice WITHOUT inventing
 * anything: the authoritative rule text is never sent through AI, only the
 * already-selected line. A guardrail rejects rewrites that drift (too long,
 * exclamation marks, em dashes, first-person "I", more than two sentences) and
 * any AI error falls back to the authored line. There is no path by which the
 * AI can add a fact — it can only rephrase, or be ignored.
 */
import { chatWithAI, type ChatMessage } from '@/lib/ai/chat';
import type { NudgeCategory } from './types';
import type { SurfacedNudge } from './delivery';

export interface ReskinContext {
  actorName?: string;
  category?: NudgeCategory;
}

/** Injectable rewriter (defaults to the AI call) — lets the guardrail be tested deterministically. */
export type LineRewriter = (line: string, ctx: ReskinContext) => Promise<string>;

const SYSTEM = [
  "You are the Heartflame, an ancient hearth-fire that watches a Dungeon Master's campaign.",
  'Rephrase the single line you are given so it still means exactly the same thing.',
  'Never add information, names, numbers, or rules the line does not already contain.',
  'One or two short sentences. Observational, old, warm but not soft.',
  'Never say "I". Never use exclamation marks. Never use em dashes.',
  'Reply with only the rephrased line and nothing else.',
].join(' ');

async function defaultRewrite(line: string, _ctx: ReskinContext): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Rephrase, same meaning, no new facts:\n"${line}"` },
  ];
  return chatWithAI(messages, { forceProvider: 'claude', temperature: 0.7 });
}

const MAX_SENTENCES = 2;

/** True when a candidate rewrite is safe to surface (pure; the guardrail). */
export function isAcceptableReskin(candidate: string, original: string): boolean {
  const c = candidate.trim();
  if (!c) return false;
  if (c.includes('—')) return false; // voice: no em dashes
  if (c.includes('!')) return false; // voice: no exclamation marks
  if (/\bI\b|\bI['’]/.test(c)) return false; // voice: never first-person "I"
  const maxLen = Math.max(140, Math.ceil(original.length * 1.8));
  if (c.length > maxLen) return false; // not rambling
  const sentences = c.split(/[.?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > MAX_SENTENCES) return false;
  return true;
}

/** Strip wrapping quotes/whitespace the model often adds. */
function clean(raw: string): string {
  return raw.trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
}

/**
 * Return a re-worded version of `line`, or the original line unchanged if the
 * rewrite drifts or the rewriter throws. Never rejects.
 */
export async function reskinLine(
  line: string,
  ctx: ReskinContext = {},
  rewrite: LineRewriter = defaultRewrite,
): Promise<string> {
  if (!line) return line;
  try {
    const candidate = clean(await rewrite(line, ctx));
    return isAcceptableReskin(candidate, line) ? candidate : line;
  } catch {
    return line; // never break delivery on AI failure
  }
}

/** Re-skin the flavour line of a surfaced nudge, preserving everything else. */
export async function reskinSurfaced(
  nudge: SurfacedNudge,
  rewrite: LineRewriter = defaultRewrite,
): Promise<SurfacedNudge> {
  const line = await reskinLine(nudge.line, { category: nudge.category }, rewrite);
  return { ...nudge, line };
}
