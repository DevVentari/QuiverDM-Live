# Frontend Ground-Up Rewrite — Design Spec

> **Status:** Approved 2026-05-08. Implementation plan: `docs/superpowers/plans/2026-05-08-frontend-rewrite-slice-0-impl.md`

---

## Context

QuiverDM's frontend is suffering structural rot from three layered design eras (wireframe → glassmorphism → stone/UI 2.0) that were each added without the previous being deleted. The audit found:

- **76 page.tsx files** across 6 cohabiting chrome systems
- **Three competing card systems** in production simultaneously: shadcn `Card` (42 imports), `.stone-card` div soup (249 uses), `.glass-*` utilities (50 uses) — many pages mix all three
- **Token file does the work three times** (HSL fallback + OKLCH override + ad-hoc `--card-stone-*` vars), 359 lines
- **27 component folders** with overlap: `session/`(45) + `play/`(9) + `recap/`(12) is one product surface; `world/`(14) + `brain/`(13) is one entity model; `homebrew/`(23) parallels brain entity sheets
- **35 design commits in 3 months**, including 4 sequential recolors-then-revert
- **Two app shells** (legacy `Sidebar` and new `CommandRail`) and four sidebar implementations all currently wired up
- The "Digital Grimoire" immersion direction in `src/templates/BRAINSTORMING.md` is captured but unbuilt

The goal is to ship a coherent v2 frontend that captures D&D immersion ("arcane, commanding, alive") while drastically reducing surface area and erasing the layered-eras tax.

## Decisions locked

| Decision | Choice | Notes |
|---|---|---|
| Scope | Full rewrite | Rewrites presentation layer (76 pages, 27 component folders). tRPC/Prisma/services untouched. |
| Spine | Session-first home + World-as-zone + Brain ambient (⌘K) + Campaign-as-chrome | Replaces today's campaign-first drill-down model |
| Immersion treatment | Cinematic Atmospheric base + Digital Grimoire for ceremonial moments | Grimoire reserved for: Brain summon overlay, /world canvas, session-start curtain, recap reveal. Routine surfaces stay restrained. |
| Build strategy | Vertical slice first | Slice 0 = foundation + home + prep end-to-end. Subsequent slices migrate one surface at a time. No feature flag. |
| Old session URLs | 308 permanent redirect | `/campaigns/[slug]/sessions/[sessionId]` → `/session/[id]`. **Confirm during spec review.** |
| Settled (locked previously) | Ashwood midtone palette, amber primary `oklch(0.7 0.16 55)`, Cinzel/Bricolage/JetBrains typography, two-zone IA, session hub at one URL with phase pipeline | |

## North Star

> A session-timeline home, a world canvas for everything that lives in the world, and the Brain summoned from anywhere by ⌘K. One campaign at a time, switched in chrome.

Brand: **Arcane, Commanding, Alive.** A living artefact, not a productivity app. Immersion is delivered through restraint — Cinematic base treatment makes the Grimoire moments hit. Amber is precious; one use per screen.

## Surface taxonomy — ~24 route nodes (down from 76 page.tsx files)

### Authenticated app — `(app)/`

- **`/`** [NEW] — Session timeline home. Replaces `/dashboard` + `/campaigns/[slug]` overview.
- **`/session/[id]`** [NEW] — Single session hub at one URL with phase pill bar (Prep · Run · Process · Summary · Recap). Folds `/campaigns/[slug]/sessions/*` + `/play/[slug]/session` + `/recap`.
- **`/world`** [NEW] — World canvas (xyflow-based). NPCs, factions, regions, places, sessions as nodes. Folds `/campaigns/[slug]/world` + `/world-map` + `/brain`.
- **`/world/[entity]`** [NEW] — Entity sheet inside canvas right panel, deep-linkable.
- **`/compendium`** [KEEP+RENAME] — Unified library: homebrew + DDB-imported sourcebooks. Renamed from `/homebrew`.
- **`/characters`** [KEEP] — PCs across campaigns.
- **`/settings/*`** [KEEP, restyled] — account, AI, integrations, API usage, DDB.

### Always-on layers (not routes)

- **CommandBar** [NEW] — top, 48px: campaign-switcher · 4 pressure gauges · ⌘K · user menu.
- **CommandRail** [NEW, building on May 7 PM partial work] — left, 56→260px: Home · World · Compendium · Characters · Settings.
- **Brain Summon (⌘K)** [NEW] — full-screen overlay, Grimoire treatment, dimmed backdrop.

### Specialised shells

- **`/session/[id]/live`** — fullscreen cockpit, bypasses (app) shell.
- **`/admin/*`** — own shell, restyled in slice 6.
- **`/auth`, `/onboarding`, `/(marketing)`** — pre-auth shells, restyled in slice 7.

### Killed

`/dashboard`, `/campaigns` list, `/campaigns/[slug]` overview, dedicated `/brain` page, entire `/play/*` tree (already on chopping block), top-level `/recap`.

## Primitive layer — six primitives, one token file

Single source of truth. No more div-soup. No more three-card-systems.

| Primitive | Replaces | Variants | File |
|---|---|---|---|
| `Surface` | `.stone-card` + shadcn `Card` + `.glass-*` | `flat / raised / sunken` | `src/components/primitives/Surface.tsx` |
| `Card` | ad-hoc list-item divs | `list / feature / grimoire` | `src/components/primitives/Card.tsx` |
| `Section` | ad-hoc h2/h3 + `.section-rule` | (no variants — overline label + amber rule) | `src/components/primitives/Section.tsx` |
| `Summon` | shadcn Sheet/Dialog scattered patterns | `dialog / sheet / overlay` (Grimoire treatment available per variant) | `src/components/primitives/Summon.tsx` |
| `Pill` | various tag/chip/button-small implementations | `info / warning / danger / primary` | `src/components/primitives/Pill.tsx` |
| `Canvas` | per-page bg/grain/glow CSS | (full-bleed atmospheric area, owns gradients) | `src/components/primitives/Canvas.tsx` |

**Token file:** single OKLCH layer at `src/styles/tokens.css`. No HSL fallback duplicate. No `--card-stone-*` ad-hoc vars. Semantic tokens scoped by purpose.

**Motion library:** `src/lib/motion.ts` — `inkSpread`, `candleBreathe`, `summonFade`, `phaseTransition`. Framer Motion under the hood.

## Decomposition — 8 slices

Each independently shippable. New shell wraps everything from slice 0 onward; subsequent slices replace inner contents. Visual mismatch between migrated and not-yet-migrated surfaces is expected during the migration window.

| # | Slice | Why this order |
|---|---|---|
| **0** | **Foundation + Home + Prep** | Validates shell, primitives, ⌘K on highest-traffic flow. Forces token + primitive + shell discipline before they're load-bearing. |
| 1 | Recap | Smallest follow-up, big visual win. Folds `/recap` into session phase. |
| 2 | Run / Live cockpit | Migrates session-live to new primitives. Keeps fullscreen-bypass behaviour. |
| 3 | World canvas | Biggest invention. Folds world + brain into one xyflow surface. |
| 4 | Compendium | Renames `/homebrew` → `/compendium`. Folds DDB content. PDF flow stays. |
| 5 | Characters | Smallest cluster. Mostly visual restyle. |
| 6 | Settings + Admin | Replaces `SettingsShell` hero and admin shell with shared chrome. |
| 7 | Cleanup | Delete folded folders (`session/`, `play/`, `recap/`, `world/`, `brain/`), legacy primitives, archived routes. Auth/onboarding/marketing visual refresh. |

## Slice 0 — concrete scope

### Critical files to CREATE

```
src/styles/tokens.css                                   # single OKLCH source of truth
src/components/primitives/Surface.tsx                   # the six primitives
src/components/primitives/Card.tsx
src/components/primitives/Section.tsx
src/components/primitives/Summon.tsx
src/components/primitives/Pill.tsx
src/components/primitives/Canvas.tsx
src/components/primitives/index.ts
src/components/shell/CommandBar.tsx                     # consolidated from src/components/layout/command-bar.tsx
src/components/shell/CommandRail.tsx                    # consolidated from src/components/layout/command-rail.tsx
src/components/shell/BrainSummon.tsx                    # ⌘K overlay (Grimoire treatment)
src/components/shell/PressureGauges.tsx                 # 4 gauges in CommandBar (extract from current brain page)
src/lib/motion.ts                                       # motion primitives
src/app/(app)/page.tsx                                  # NEW home — session-first timeline (replaces dashboard)
src/app/(app)/session/[id]/page.tsx                     # NEW session hub (Prep phase only in slice 0)
src/app/(app)/session/[id]/_components/PhasePillBar.tsx # phase pill bar
src/app/(app)/session/[id]/_components/PrepWorkspace.tsx # prep phase (port from existing prep wizard)
tests/workflows/home.workflow.spec.ts                   # E2E for new home
tests/workflows/session-prep.workflow.spec.ts           # E2E for new prep flow
```

### Critical files to MODIFY

```
src/app/(app)/layout.tsx          # mount new CommandRail + CommandBar; delete legacy Sidebar import
src/app/(app)/app-shell.tsx       # consolidate shell composition; delete CampaignVoiceShell wrapper if unused
src/store/header-store.ts         # add isDM, pressure-gauge state slots if missing
src/app/globals.css               # delete .stone-*, .glass-*, --card-stone-* vars; collapse to import of tokens.css
src/app/dashboard/page.tsx        # 308 redirect to /
src/app/(app)/campaigns/page.tsx  # 308 redirect to /
src/app/(app)/campaigns/[slug]/page.tsx                          # 308 redirect to /
src/app/(app)/campaigns/[slug]/sessions/[sessionId]/page.tsx     # 308 redirect to /session/[sessionId]
src/app/(app)/campaigns/[slug]/sessions/[sessionId]/prep/page.tsx # 308 redirect to /session/[sessionId]?phase=prep
```

### Critical files to DELETE (slice 0)

```
src/components/sidebar.tsx                  # legacy Sidebar
src/components/sidebar/MobileSidebar.tsx    # legacy mobile (replaced by CommandRail mobile sheet)
src/components/layout/page-layout.tsx       # PageLayout — pages migrate to Section primitive
src/templates/                              # entire folder (move BRAINSTORMING.md to docs/obsidian-vault/20-Brainstorm/)
```

### Stays as-is in slice 0 (visually inconsistent but functional)

All other (app) routes — `/world*`, `/brain`, `/compendium` (still `/homebrew`), `/characters`, `/settings`, `/admin`. They render inside the new shell with their existing components and stone/glass utilities. The visual mismatch is the migration receipt.

## Verification

### Per-slice gate

- New workflow spec at `tests/workflows/<slice>.workflow.spec.ts` written before or alongside implementation
- Persona suites pass: `veteran-dm` (Vic, primary), `mobile-dm`, `error-resilience`
- `npm run qa:cycle` green before merge
- Visual regression: Playwright screenshot diff between `before` (current) and `after` (slice N) of touched routes

### Cross-cutting

- "Run a real session" smoke test at each slice — the DM can run a Tuesday session at slice N with everything else still old, no regressions
- Token regression check: `grep -r "stone-card\|--card-stone\|\.glass-shell\|\.glass-panel\|\.glass-row" src/` returns zero hits after slice 0
- a11y at slice 0: 44px minimum touch targets, contrast on Cinematic surfaces, ⌘K overlay focus trap
- Final cleanup slice (7) verified by zero-hit grep of every legacy class/folder

### Definition of done for slice 0

- New `/` home renders under new CommandRail + CommandBar shell with ⌘K functional
- `/session/[id]` Prep phase fully usable; old session URLs 308-redirect cleanly
- Six primitives in place, token file collapsed, legacy Sidebar/MobileSidebar/PageLayout deleted
- No `.stone-*`, `.glass-*`, `--card-stone-*` references remain in code touched by slice 0
- Both new workflow specs pass + persona suites pass + `npm run qa:cycle` green
- DM can run their next session normally from the new home + prep screens

## Open assumptions — confirm before implementation begins

1. **Session URL redirect strategy** — assumed 308 permanent redirect. Alternative: keep both URLs working with no redirect.
2. **Mobile parity in slice 0** — assumed responsive home + prep, existing mobile bottom-tab pattern transplanted to new shell. Not separately redesigned.
3. **`src/templates/BRAINSTORMING.md`** — assumed moved to `docs/obsidian-vault/20-Brainstorm/digital-grimoire-treatment.md` rather than deleted.
4. **CampaignVoiceShell** — assumed stays in place (voice features unchanged). Verify it's not load-bearing for the new shell.
