# V2 Styling Sweep — Codex Handoff

> Branch: `v2-styling-sweep` (off `main`)
> Started: 2026-05-11 by Claude (Opus 4.7)
> Reference: `src/app/dev/home-shell/page.tsx` (canonical V2 implementation)
> V2 brief: `docs/superpowers/plans/2026-05-10-v2-visual-system-checklist.md`

## Goal

Migrate every `(app)`/`(admin)`/`(auth)` page off ad-hoc Tailwind palette + legacy `glass-*` classes onto the V2 primitive + token system. About 50 pages remain after Tier 1.

The V2 visual system is fully wired (tokens, primitives, global utilities). Most pages just need a mechanical rewrite of CSS classes plus replacing hand-rolled cards with `Card`/`Surface`/`Section` primitives.

## Status (as of branch head)

### Done in this branch
- `feb5fc6` — V2 setup: darker navy background, removed app-background.png overlay, `CampaignSwitcher` restyled, orphaned `campaign-nav.tsx` deleted
- `2113e28` — Tier 1: `world/page.tsx` (last in-progress migration)
- `642f732` — Tier 2: `campaigns/page.tsx` (campaigns list)
- `b40f0dc` — Tier 2: `campaigns/[slug]/sessions/page.tsx`

### Tier 1 — complete
- ✅ `world/page.tsx`
- ✅ `quests/page.tsx` (already on V2)
- ✅ `session/[id]/page.tsx` (already on V2)

### Tier 2 — partial, pick up here
Remaining high-traffic surfaces:
- `src/app/(app)/campaigns/new/page.tsx`
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx`
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx`
- `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`
- `src/app/(app)/campaigns/[slug]/sessions/new/page.tsx`
- `src/app/(app)/campaigns/[slug]/npcs/page.tsx` (has tokens, no primitives)
- `src/app/(app)/campaigns/[slug]/npcs/[npcId]/page.tsx`
- `src/app/(app)/campaigns/[slug]/npcs/[npcId]/edit/page.tsx`
- `src/app/(app)/campaigns/[slug]/npcs/new/page.tsx`
- `src/app/(app)/campaigns/[slug]/mechanics/page.tsx`
- `src/app/(app)/campaigns/[slug]/encounters/page.tsx`
- `src/app/(app)/campaigns/[slug]/encounters/[planId]/page.tsx`
- `src/app/(app)/campaigns/[slug]/encounters/new/page.tsx`

### Tier 3 — campaign sub-pages
- `members/`, `players/`, `search/`, `summaries/`, `settings/`
- `brain/` + `brain/entities/` + `brain/entities/[entityId]/`
- `world-map/`
- `world/[entrySlug]/` — has raw `text-*-400/80` palette

### Tier 4 — global app pages
- `dashboard/`, `feedback/`, `join/`
- `homebrew/` + `homebrew/[id]/` + `homebrew/pdfs/` + `homebrew/pdfs/[pdfId]/`
- `recap/` (line 88 has legacy `stone-card glass-panel`)
- `characters/` + `characters/[id]/` + `characters/[id]/edit/` + `characters/new/`

### Tier 5–7 — batch
- `onboarding/page.tsx` (Tier 3 candidate — first impression)
- `auth/{signin,signup,forgot-password,reset-password,error}/page.tsx`
- `settings/{page,account,admin,ai,api-usage,appearance,ddb,integrations,profile}/page.tsx` (9 files)
- `admin/{page,api-usage,health,invites,rules-sources,users,users/[userId]}/page.tsx` (7 files)

### Missing rail pages — NOT needed (re-audit on 2026-05-11)
The original audit claimed 5 missing routes (locations, monsters, items, lore,
assets). On verification this was a false positive — the audit compared against
the `dev/home-shell` preview's 11-item nav, NOT the production
`src/components/shell/CommandRail.tsx` which has 10 items and references only
existing routes. The production rail is already consolidated:

- Locations / Lore → folded into `/campaigns/[slug]/world` (filterable)
- Monsters / Items / Spells → folded into `/homebrew` (compendium with type filter)
- Maps → `/campaigns/[slug]/world-map`
- Assets → not in production rail; deferred until a real upload feature exists

Skip this task.

### Delete (don't migrate)
- `src/app/(app)/campaigns/[slug]/sidebar-test/page.tsx` (dev artifact, breaks type-check)
- `src/app/(app)/campaigns/[slug]/page.tsx` (4-line `permanentRedirect('/')`)
- `src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx` (superseded by `[sessionId]/prep/`)
- All of `src/app/(app)/play/**` — DM-only direction per project memory
- `src/app/(app)/recap/{demo,upload}/page.tsx` — likely PRD stubs (confirm with user first)

### Skip
- `src/app/(marketing)/{landing,pricing}/page.tsx` — separate visual language, do not touch without explicit instruction

## Pattern library

### Token vocabulary

All available in `src/styles/tokens.css`. Reference these via Tailwind arbitrary values: `bg-[var(--q-surface-utility)]`, `border-[var(--q-amber-border)]`, `text-[var(--q-text-dim)]`.

Surfaces (tier-aware backgrounds):
- `--q-surface-utility` — calm, low-glow (lists, toolbars, default page surfaces)
- `--q-surface-feature` — glass/stone hybrid (cards with grain)
- `--q-surface-hero` — dominant panel on a page
- `--q-surface-signature` — page-defining moments (overlays, grimoire cards)

Borders: `--q-border-subtle`, `--q-border` (default), `--q-border-feature`, `--q-border-hero`, `--q-border-signature`.

Amber accent: `--q-amber` (full), `--q-amber-dim` (50%), `--q-amber-trace` (8% — for tints), `--q-amber-border` (22% — for borders).

Text: `--q-text` (primary), `--q-text-dim` (secondary), `--q-text-faint` (tertiary), `--q-text-info`, `--q-text-warning`, `--q-text-danger`.

Glow (for `Surface glow` or `Canvas` ambient): `--q-glow-amber`, `--q-glow-mystic`, `--q-glow-hero`, `--q-glow-signature`.

Fonts: `--q-font-display` (Cinzel — H1, H2, brand moments), `--q-font-body` (Bricolage Grotesque — body), `--q-font-mono` (JetBrains Mono — stats/dice/code).

### Global utilities (in `src/app/globals.css`)

- `.q-panel-grain` — subtle SVG noise overlay (apply to glass surfaces)
- `.q-signature-vignette` — radial vignette for signature surfaces
- `.q-hero-glow` — ambient hero glow gradients
- `.section-rule` — decorative amber rule before a heading
- `.label-overline` — Cinzel uppercase overline label (0.625rem, amber dim)
- `.text-fluid-{xl|2xl|3xl|4xl}` — responsive headings
- `.scrollbar-hide` — hide scrollbar, keep scroll

### Primitive APIs

```tsx
import { Surface, Card, Section, Canvas, Pill, Summon } from '@/components/primitives'
```

**Surface** — base material primitive
```tsx
<Surface variant="utility" /* | feature | hero | signature */
         grain={false}
         glow={false}
         ornament={false}    // grimoire-style clip-path
         inset={false}       // inner top highlight
         className="...">
```

**Card** — Surface + padding + optional grimoire treatment
```tsx
<Card variant="list" /* | detail | feature | hero | grimoire */>
```
Variant mapping:
- `list` → `Surface variant="utility"`, no grain, less padding
- `detail` → `Surface variant="feature"`, grain, inset highlight
- `feature` → `Surface variant="feature"`, grain
- `hero` → `Surface variant="hero"`, grain + glow
- `grimoire` → `Surface variant="signature"`, grain + glow + ornament + amber gradient

**Section** — heading + amber rule + action slot
```tsx
<Section label="LIBRARY" /* uppercase overline */
         title="Campaigns" /* H2 */
         description="..."
         action={<Button>...</Button>}
         tone="feature" /* | utility | ceremonial */>
  {children}
</Section>
```
- `utility` — practical heading, no amber
- `feature` — default, amber rule + standard H2
- `ceremonial` — Cinzel display title + bright amber rule

**Canvas** — page-level atmospheric backdrop
```tsx
<Canvas variant="world" /* | base | prep | recap | summon */
        grain
        vignette
        glow>
  {page contents}
</Canvas>
```

**Pill** — small status/phase chip
```tsx
<Pill variant="neutral" /* | info | warning | danger | primary | phase */>
```

### Page archetypes

#### Archetype 1: simple list page

See `campaigns/page.tsx` (post-migration).

```tsx
<div className="mx-auto max-w-[1400px] px-6 py-8">
  <Section
    label="Library"
    title="Things"
    tone="ceremonial"
    action={<Button>...</Button>}
  >
    {isLoading ? <Skeletons /> : isEmpty ? <EmptyState /> : <Grid />}
  </Section>
</div>
```

Empty state pattern:
```tsx
<Card variant="detail" className="flex flex-col items-center justify-center gap-6 py-24 text-center">
  <p className="font-[var(--q-font-display)] text-sm uppercase tracking-[2px] text-[var(--q-text-faint)]">
    No things yet
  </p>
  <Button>Create your first thing</Button>
</Card>
```

Grid item:
```tsx
<Surface variant={isActive ? 'feature' : 'utility'} grain={isActive}>
  {/* content */}
</Surface>
```

#### Archetype 2: filterable list with expansion rows

See `campaigns/[slug]/world/page.tsx` for the canonical example.

Filter chips:
```tsx
function filterChipClass(isActive: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium border transition-colors',
    isActive
      ? 'border-[var(--q-amber-border)] bg-[var(--q-amber-trace)] text-[var(--q-amber)]'
      : 'border-[var(--q-border-subtle)] bg-[var(--q-surface-utility)] text-[var(--q-text-dim)] hover:border-[var(--q-amber-border)] hover:text-[var(--q-text)]',
  )
}
```

Expandable rows: wrap in `Surface variant={expanded ? 'feature' : 'utility'} grain={expanded}`.

#### Archetype 3: SplitCanvas list+inspector

See `campaigns/[slug]/sessions/page.tsx`.

The mobile list and desktop SplitCanvas share a row component. Status colors come from a `STATUS_CONFIG` object using tokens, not raw Tailwind palette.

#### Archetype 4: form / detail page

(No fully-migrated example yet — pick a Tier 2 detail page first.)

Likely pattern:
```tsx
<div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
  <Section label="EDIT" title="..." />
  <Card variant="detail" className="space-y-4">
    {/* form fields */}
  </Card>
</div>
```

## Anti-patterns to remove (grep before touching any file)

```bash
# Legacy material classes
glass-card|glass-panel|glass-tile|glass-stone|stone-card

# Hardcoded palette colors
text-(amber|emerald|blue|violet|cyan|pink|red|yellow|fuchsia|sky|purple|slate|zinc|gray)-(300|400|500)/[0-9]+
bg-(white|black)/[0-9]+
bg-(zinc|slate|gray|amber|emerald|red|sky|purple|violet)-[0-9]+/[0-9]+
border-(amber|emerald|blue|violet|red|sky|purple|slate)-(300|400|500)/[0-9]+

# Stray references to retired tokens
--q-surface-sunken   # use --q-surface-utility/feature
bg-\[var\(--q-surface\)\]   # not a real token, falls back

# Raw hsl inline
style=\{\{.*hsl\(.*\)\}\}
border-\[hsl\(
```

## Per-page migration checklist

For each page:
1. Open the file. Find any of the anti-patterns above.
2. Replace raw palette → token: `text-amber-400/80` → `text-[var(--q-amber)]`; `text-slate-400` → `text-[var(--q-text-dim)]`; etc.
3. Replace hand-rolled cards → `Surface variant="..."` or `Card variant="..."`.
4. Replace ad-hoc page headers → `Section label="..." title="..." tone="...">`.
5. If the page has a strong atmospheric identity (World, Prep, Recap), wrap the root in `Canvas variant="...">`.
6. Empty states → `Card variant="detail"` with `q-text-faint` body.
7. Skeletons → `bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)]` (instead of `bg-white/5`).
8. **Per-type discriminating colors** — collapse to `--q-text-faint`. The V2 brief mandates "amber concentrated". Icons + labels carry differentiation.
9. Run `npx tsc --noEmit` after each file. Ignore the preexisting `sidebar-test` and `world-map.workflow` errors.

## Commit conventions

One commit per logical batch (file or small group of related files). Format:

```
refactor(<scope>): <one-line summary>

- bullet 1
- bullet 2

Co-Authored-By: Codex <noreply@openai.com>
```

Scopes seen so far: `theme`, `world`, `campaigns`, `sessions`, `npc`, etc. Use the folder name.

## Verification

- `npx tsc --noEmit` — should be clean except for the two preexisting errors:
  - `sidebar-test/page.tsx(89,9)` — will be fixed by deleting the file in Tier 7
  - `tests/workflows/world-map.workflow.spec.ts` — preexisting, not in V2 scope
- For UI surfaces, run `npm run dev` and visit `/campaigns`, `/campaigns/[slug]/world`, `/campaigns/[slug]/sessions` to sanity-check before committing.
- Visual reference: `/dev/home-shell` (always available, never to be touched).

## Skip / out of scope

- All sheet/dialog components (`src/components/**/*sheet*.tsx`, `src/components/**/*Dialog*.tsx`) — they need a separate `Summon` primitive wrapping pass. Track in a follow-up sweep.
- `src/app/(marketing)/**` — separate visual language.
- Shell components (`CommandRail`, etc.) — explicit instruction from user to leave alone.
- `Card`/`Surface`/`Section` primitive internals — they're done. Just consume them.

## Working with this branch

```bash
git fetch
git checkout v2-styling-sweep
git pull
# pick a tier task, make changes, npx tsc --noEmit, commit, push
```

When all tiers are done, the branch should be PR-ready. Hold off on the PR until the user reviews — they may want to scope the merge differently (e.g. ship Tier 1+2 first).
