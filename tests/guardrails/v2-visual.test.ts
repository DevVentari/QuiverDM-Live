import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * V2 visual-system regression guardrails (Task 12 of the V2 plan).
 *
 * Routes that have been migrated onto the primitive system must not reach
 * back to raw material tokens — surfaces, borders, and atmospheres should
 * come from Surface/Card/Section/Canvas/Pill/Summon, not inline classes.
 *
 * Add new routes here as they're migrated; do NOT add allowlists to silence
 * a violation. If a primitive needs to grow a variant, grow the primitive.
 */
const MIGRATED_ROUTES = [
  'src/app/(app)/page.tsx',
  'src/app/(app)/campaigns/[slug]/world/page.tsx',
  'src/app/(app)/session/[id]/page.tsx',
  'src/app/(app)/session/[id]/_components/PrepWorkspace.tsx',
  'src/components/home/HomeHero.tsx',
  'src/components/home/ActiveCampaignSummary.tsx',
  'src/components/home/RecentSessionsList.tsx',
  'src/components/home/WorldActivityStub.tsx',
  'src/components/home/PrepRemindersStub.tsx',
]

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /bg-\[var\(--q-surface-(?:utility|feature|hero|signature|sunken|flat|raised)\)/g,
    reason: 'raw surface token — use Surface/Card variant',
  },
  {
    pattern: /bg-\[var\(--q-bg\)/g,
    reason: 'raw page bg token — use Canvas variant for atmospheric layer',
  },
  {
    // Catch surface-style border tokens, but allow directional dividers
    // (border-t/b/l/r/x/y followed by the same token).
    pattern: /(?<!border-[tblrxy]\s)\bborder-\[var\(--q-border-(?:subtle|feature|hero|signature)\)/g,
    reason: 'raw border token used as surface treatment — use Surface/Card variant (directional dividers like `border-t border-[var(--q-border-subtle)]` are exempt)',
  },
  {
    pattern: /\bclass(?:Name)?=["'][^"']*\bglass-(?:flat|raised|sunken|grimoire)/g,
    reason: 'legacy .glass-* class — use Surface/Card variant',
  },
  {
    pattern: /q-hero-glow|q-panel-grain|q-signature-vignette/g,
    reason: 'raw atmospheric utility — use Card glow/grain props or Canvas variant',
  },
]

describe('V2 visual-system guardrails', () => {
  for (const relPath of MIGRATED_ROUTES) {
    it(`${relPath} uses primitives, not raw material tokens`, () => {
      const absPath = resolve(process.cwd(), relPath)
      const content = readFileSync(absPath, 'utf8')
      const violations: string[] = []

      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        const matches = content.match(pattern)
        if (matches && matches.length > 0) {
          const sample = matches.slice(0, 3).join(', ')
          violations.push(`${reason} — ${matches.length}x: ${sample}`)
        }
      }

      expect(violations, `${relPath} reached past the V2 primitives:\n  - ${violations.join('\n  - ')}`).toEqual([])
    })
  }
})
