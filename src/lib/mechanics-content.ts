import { z } from 'zod'

export const SecretContentSchema = z.object({
  flavorText: z.string().min(1),
  hiddenTruth: z.string().min(1),
  mechanicalEffect: z.string().optional(),
})

export type SecretContent = z.infer<typeof SecretContentSchema>

export const TarokkaSuitEnum = z.enum(['high', 'swords', 'stars', 'glyphs', 'coins'])
export const TarokkaPositionEnum = z.enum([
  'history',
  'ally',
  'enemy',
  'item',
  'final-battle-location',
])

export const TarotContentSchema = z.object({
  cardName: z.string().min(1),
  suit: TarokkaSuitEnum,
  artUrl: z.string().url().optional(),
  divinationPosition: TarokkaPositionEnum,
  interpretation: z.string().min(1),
})

export type TarotContent = z.infer<typeof TarotContentSchema>

export type MechanicKind = 'secret' | 'tarot'

/** Pick the right Zod schema for a given kind. Throws on unknown kinds. */
export function contentSchemaFor(kind: string) {
  if (kind === 'secret') return SecretContentSchema
  if (kind === 'tarot') return TarotContentSchema
  throw new Error(`Unknown mechanic kind: ${kind}`)
}

/** Strip the DM-only fields from content based on viewer privilege. */
export function stripHiddenContent(kind: string, content: unknown, viewerCanSeeHidden: boolean): unknown {
  if (viewerCanSeeHidden) return content
  if (kind === 'secret') {
    const parsed = SecretContentSchema.safeParse(content)
    if (!parsed.success) return content
    const { hiddenTruth: _strip, ...rest } = parsed.data
    return rest
  }
  // Tarot has no hidden fields today — return as-is.
  return content
}
