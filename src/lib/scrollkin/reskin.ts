/**
 * Optional AI re-skin. Re-words a chosen pool line in Scrollkin's voice —
 * it NEVER invents mechanics. The plain rule text (`PoolLine.rule`) is always
 * the authoritative content revealed on tap and is never sent through the model
 * as something to rewrite into rules; it is the ground truth.
 *
 * If the model is unavailable or returns something suspicious, callers fall back
 * to the original line text. This keeps Scrollkin fact-safe by construction.
 */

import { chatWithAI, type ChatMessage } from '@/lib/ai/chat'
import type { PoolLine } from './types'

const SYSTEM_PROMPT = `You are Scrollkin, a terse arcane familiar that nudges a Dungeon Master mid-combat.
Reword the GIVEN nudge in one short sentence (max ~12 words), in a dry, knowing voice.
RULES:
- Do NOT add, change, or invent any game mechanic, number, or rule.
- Do NOT introduce facts not present in the given nudge.
- Keep it a single sentence, no quotes, no preamble.
Return only the reworded sentence.`

/**
 * Reword a line's display text. Returns the original `line.text` on any failure
 * so delivery never blocks on the model. `forceProvider` defaults to the cheap,
 * fast Groq path; callers can override.
 */
export async function reskinLine(
  line: PoolLine,
  opts: { forceProvider?: string } = {},
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Nudge: ${line.text}` },
  ]

  try {
    const out = await chatWithAI(messages, {
      temperature: 0.7,
      forceProvider: opts.forceProvider ?? 'groq',
    })
    const cleaned = out.trim().replace(/^["']|["']$/g, '')
    // Guard against empty / runaway responses — fall back to the authored line.
    if (!cleaned || cleaned.length > 120) return line.text
    return cleaned
  } catch {
    return line.text
  }
}
