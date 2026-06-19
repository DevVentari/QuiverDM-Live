/**
 * v3-token-compliance.test.ts
 *
 * Static file-scan guardrail: asserts that ported v3 files use only --qd-* design tokens
 * and never reach back to v2/shadcn tokens or forbidden patterns.
 *
 * HOW THE --q- vs --qd- REGEX WORKS
 * ------------------------------------
 * We want to flag the legacy "--q-" prefix (e.g. "--q-surface", "--q-border-subtle")
 * but NEVER flag the live v3 prefix "--qd-" (e.g. "--qd-accent", "--qd-surface").
 *
 * Pattern used:  /--q-(?!d)/
 *   - Matches "--q-" only when NOT followed by "d"
 *   - "--q-surface"  → matches (legacy, forbidden)
 *   - "--qd-accent"  → does NOT match (safe, this is the new token)
 *   - "--qd-border"  → does NOT match (safe)
 *
 * Verified manually: "--qd-accent".match(/--q-(?!d)/) === null ✓
 *
 * TASK SCOPE
 * ----------
 * Task 1: Scan only src/components/ui-v3/**\/\*.tsx — these files are freshly written
 * against --qd-* tokens and must pass immediately.
 *
 * TASK 7: Expand FILES to include ported cluster files (see placeholder below).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ─── Files in scope (grows per task) ───────────────────────────────────────

/** Returns all *.tsx files under a directory, recursively. */
function glob(dir: string, ext = '.tsx'): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...glob(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

const ROOT = resolve(process.cwd());

const UI_V3_DIR = resolve(ROOT, 'src/components/ui-v3');

// Task 1: only scan the freshly-created primitive set.
const FILES: string[] = glob(UI_V3_DIR);

// TASK 7: expand this list to the ported cluster files, e.g.:
// const CLUSTER_FILES: string[] = [
//   'src/app/v3/campaigns/[slug]/session/[id]/_components/SomeComponent.tsx',
//   // ... all cluster files ported in tasks 2-6
// ];
// const FILES: string[] = [...glob(UI_V3_DIR), ...CLUSTER_FILES.map(f => resolve(ROOT, f))];

// ─── Forbidden patterns ─────────────────────────────────────────────────────

const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  {
    // shadcn/ui imports — the whole point is to NOT use these
    pattern: /@\/components\/ui\//,
    reason: 'imports from @/components/ui/ (shadcn — resolves to v2 tokens)',
  },
  {
    // Legacy --q- namespace (e.g. --q-surface, --q-border-subtle)
    // Negative lookahead (?!d) ensures --qd-* is NOT matched.
    pattern: /--q-(?!d)/,
    reason: 'uses legacy --q-* token namespace (not --qd-*)',
  },
  {
    // v2 Tailwind utility: background token
    pattern: /\bbg-background\b/,
    reason: 'uses v2 token bg-background',
  },
  {
    // v2 Tailwind utility: foreground text
    pattern: /\btext-foreground\b/,
    reason: 'uses v2 token text-foreground',
  },
  {
    // v2 Tailwind utility: primary background (resolves to --primary, not --qd-accent)
    pattern: /\bbg-primary\b/,
    reason: 'uses v2 token bg-primary',
  },
  {
    // v2 Tailwind utility: muted background
    pattern: /\bbg-muted\b/,
    reason: 'uses v2 token bg-muted',
  },
  {
    // v2 Tailwind utility: destructive text
    pattern: /\btext-destructive\b/,
    reason: 'uses v2 token text-destructive',
  },
  {
    // v2 Tailwind utility: input border
    pattern: /\bborder-input\b/,
    reason: 'uses v2 token border-input',
  },
  {
    // Raw oklch() color — tokens should be used instead
    pattern: /oklch\(/,
    reason: 'hard-coded oklch() color (use a --qd-* token instead)',
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('v3-token-compliance', () => {
  it('ui-v3 directory exists and contains files', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  for (const absPath of FILES) {
    // Produce a stable relative display path for test names
    const relPath = absPath.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/');

    it(`${relPath} — no forbidden v2/legacy tokens`, () => {
      const rawContent = readFileSync(absPath, 'utf8');

      // Strip single-line comments (// ...) and block comments (/* ... */) so that
      // explanatory text in JSDoc blocks (e.g. "do NOT import from @/components/ui/")
      // doesn't produce false positives. We scan the *executable* source only.
      const content = rawContent
        // Remove block comments /** ... */ and /* ... */ (non-greedy, dotall)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Remove single-line comments // ...
        .replace(/\/\/.*/g, '');

      const violations: string[] = [];

      for (const { pattern, reason } of FORBIDDEN) {
        // Use a fresh regex per file (global flag would carry state)
        const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
        if (re.test(content)) {
          // Find line numbers against raw content for readable output
          const lines = rawContent.split('\n');
          const matchingLines = lines
            .map((line, i) => ({ line, num: i + 1 }))
            .filter(({ line }) => {
              // Skip comment lines when reporting too
              const trimmed = line.trim();
              if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
              return re.test(line);
            })
            .slice(0, 3)
            .map(({ num, line }) => `L${num}: ${line.trim()}`);
          violations.push(`[${reason}]\n    ${matchingLines.join('\n    ')}`);
        }
      }

      expect(
        violations,
        `\n${relPath} has v3-token violations:\n\n${violations.join('\n\n')}\n`,
      ).toEqual([]);
    });
  }
});
