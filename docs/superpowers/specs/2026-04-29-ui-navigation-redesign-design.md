# UI & Navigation Redesign — Design Spec

**Date:** 2026-04-29  
**Status:** Approved — ready for implementation planning  
**Scope:** Navigation structure, session lifecycle flow, campaign overview, page template consistency

---

## Problem

The current UI has three compounding issues:

1. **Disjointed session lifecycle** — a single session is spread across 4+ routes (`/sessions/prep`, `/sessions/[id]`, `/sessions/[id]/prep`, `/recap/upload`, `/sessions/[id]/recap`). There is no sense of where the DM is in the journey or what to do next.
2. **Incoherent navigation** — the sidebar fully swaps between a global mode and a campaign mode, creating a jarring context switch with no visual continuity.
3. **Inconsistent page templates** — every page invents its own heading, card style, and layout. Some use `stone-card glass-panel`, others use raw `border border-border`. Some pages hardcode `hsl()` values instead of using CSS variables.

The design system tokens (oklch colours, amber primary, glass panels, grain, vignette) are solid and are not changing. This redesign enforces the existing system uniformly and fixes the IA.

---

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Landing page | Last active campaign | Most DMs have 1–2 campaigns. Dashboard becomes a campaign picker for power DMs. |
| Session flow | Session hub — single URL | DMs return to a session across days. One URL shows state and what to do next. |
| Campaign overview | Hero "continue" + next session row + world state | Removes redundant sessions card. Hero is context-aware. World state uses Brain data. |
| Navigation | Two-zone sidebar | Both zones always visible. No context switching. Global top, campaign sub-nav below. |

---

## Section 1 — Navigation (Two-zone sidebar)

### Structure

```
┌──────────────────────────┐
│  QUIVERDM       [≡]      │  ← Logo + collapse toggle
├──────────────────────────┤
│  GLOBAL                  │
│  · Dashboard             │  ← Campaign list/picker when not in campaign
│  · Recaps          [2]   │  ← Pending badge
│  · Homebrew              │
│  · Characters            │
├──────────────────────────┤
│  ┌────────────────────┐  │
│  │ Wyrm's End    ↕    │  │  ← Campaign switcher pill (click to switch)
│  │ 14 sessions        │  │
│  └────────────────────┘  │
│  CAMPAIGN                │
│  · Overview              │
│  · Sessions              │
│  · NPCs                  │
│  · DM Brain              │
│  · Encounters            │
│  · Members               │
├──────────────────────────┤
│  · Settings              │  ← Always at bottom
└──────────────────────────┘
```

### Behaviour

- **Both zones always visible** when inside a campaign — no full sidebar swap.
- **Campaign zone hidden** when not in any campaign (global only shown).
- **Campaign switcher pill** replaces the current `CampaignSwitcher` / `CampaignContext` dual-component. Single component: shows current campaign name + session count, opens dropdown to switch.
- **Dashboard** route: redirects to most recent active campaign if one exists; otherwise shows campaign list/picker.
- **Collapsed state**: global items show icons only, campaign section collapses to campaign icon + campaign sub-nav icons.

### Route impact

None. All existing routes remain. Only the sidebar rendering logic changes.

---

## Section 2 — Campaign Overview (`/campaigns/[slug]`)

### Layout

```
Campaign name                               [DM badge]
14 sessions · 5 members · Active Jan 2026

┌─────────────────────────────────────────────────────┐
│ 🎙️  Continue where you left off                      │
│     Session 14 · Upload your recording    [Upload →] │
│     Transcript and AI summary waiting on this step   │
└─────────────────────────────────────────────────────┘

[ Fri May 2 ]  Session 15  ·  No title yet     Prep 60%

┌──────────────────────┐  ┌──────────────────────────┐
│  WORLD PRESSURE      │  │  OPEN HOOKS              │
│  Political   ██░ 72% │  │  ● Baron's ultimatum…    │
│  Supernatural █░ 48% │  │  ○ Mira's debt…          │
│  Economic    █░  21% │  │  ○ Missing shipment…     │
└──────────────────────┘  └──────────────────────────┘
```

### Hero "continue" card

Context-aware — driven by the last active session's current lifecycle phase:

| Session state | Hero shows |
|---|---|
| Prep incomplete | "Finish prep for Session N" → links to session hub Prep phase |
| No recording uploaded | "Upload your recording" → links to session hub Processing phase |
| Transcript processing | "Transcript generating…" (disabled CTA, spinner) |
| Summary ready, recap not approved | "Review and approve recap" → links to session hub Recap phase |
| All complete | "Start prep for Session N+1" → links to next session |
| No sessions yet | "Create your first session" → new session flow |

### Next session row

Single row: date chip + session title + prep percentage. Tapping navigates to that session's hub. Hidden if no future session exists.

### World state columns

- **World Pressure**: pressure gauge bars for active tracks only (Political, Supernatural, Economic, Cosmic, Social). Zero-value tracks hidden. Sourced from `brain.state.get`.
- **Open Hooks**: up to 5 hooks, sorted by urgency (high → medium → low). Dot colour = urgency. Age shown as secondary text. Tapping opens the hook detail drawer. Sourced from `brain.hooks.getAll`.

Both columns hidden if no Brain data exists yet (no empty state shown — columns simply don't render).

---

## Section 3 — Session Hub (`/campaigns/[slug]/sessions/[id]`)

### Concept

A session is a living document that evolves over days. One URL, one place for the entire lifecycle. The pipeline at the top always shows where the session is and what comes next.

### Pipeline indicator

```
● Prep  ──  ● Ran  ──  ◉ Processing  ──  ○ Summary  ──  ○ Recap
```

- `●` green dot = phase complete
- `◉` amber dot + label = current phase (highlighted)
- `○` dimmed = not yet reached
- Clicking a completed phase scrolls to its summary row

### Page content by phase

**Prep phase** (status: `planning`)
- Session title, date, quick notes
- Strong start field
- Encounter hooks list
- Linked NPCs
- CTA: "Mark session as run" → advances to Ran phase

**Ran phase** (status: `in_progress` or `active`)
- Quick notes field (mid-session capture)
- CTA: "Session complete" → advances to Processing phase

**Processing phase** (status: `completed`, no recording)
- Upload recording UI — drag-and-drop, multi-track support
- Replaces `/recap/upload` entirely
- Upload triggers transcription worker, advances to Summary phase automatically

**Summary phase** (transcript processing or complete)
- Transcript viewer (collapsible)
- AI summary display (or "Generating…" skeleton)
- CTA: "Generate summary" if not yet triggered

**Recap phase**
- Recap editor (existing `RecapViewer` component)
- Share to Discord button
- Approve button

### Completed phase rows

Once a phase is complete, it collapses to a single summary row:

```
✓  Prep saved · 3 days ago                              [Edit]
✓  Session ran · Fri Apr 25 · 4h 12m
✓  Recording uploaded · 2 files · 847 MB
```

### Route cleanup

| Old route | New behaviour |
|---|---|
| `/campaigns/[slug]/sessions/prep` (new session) | Unchanged — creates session and redirects to hub |
| `/campaigns/[slug]/sessions/[id]/prep` | Redirects to `/campaigns/[slug]/sessions/[id]` (hub handles prep phase) |
| `/campaigns/[slug]/sessions/[id]/recap` | Redirects to hub (hub handles recap phase) |
| `/recap/upload` | Redirects to the most recent incomplete session hub, Processing phase |

---

## Section 4 — Page Template Consistency

### Page header pattern (all pages)

Every page uses this structure:

```tsx
<div>
  <p className="label-overline">Section Name</p>
  <div className="section-rule" />
  <div className="flex items-center justify-between mt-3">
    <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide">
      Page Title
    </h1>
    {/* optional CTA */}
  </div>
</div>
```

Pages that currently skip the overline/rule or use inconsistent heading sizes are updated to match.

### Card consistency

All content cards use `stone-card glass-panel`. Raw `rounded-lg border border-border` cards are replaced. The `stone-card-header` / `stone-card-body` structure is used for all internal card layouts.

### CSS variable enforcement

All hardcoded `hsl()` and `oklch()` values inside component files are replaced with CSS variable references (`var(--primary)`, `border-border`, etc.). Exceptions: gradient definitions in `globals.css` where raw values are intentional.

### Pages in scope for template cleanup

- Dashboard
- Campaigns list
- Campaign overview (full redesign above)
- Sessions list
- Session hub (new)
- NPCs list
- NPC detail
- Homebrew list
- Brain page
- Settings

---

## Out of Scope

- Design system token changes (colours, fonts, spacing — these are correct)
- New features (Encounters, DM Brain features, voice, etc.)
- Mobile layout (addressed separately)
- Marketing / landing pages
- Auth pages

---

## Implementation Notes

- The session hub phases are driven by session `status` field + presence of recordings/transcriptions/recap — no new DB fields required.
- The hero "continue" card logic lives in a `useContinueAction(campaignId)` hook that queries the most recent session and derives the correct CTA.
- The two-zone sidebar is a refactor of the existing `Sidebar` component — same data, different render logic. The `CampaignContext` and `CampaignSwitcher` components merge into one `CampaignPill` component.
- Route redirects are Next.js `redirect()` calls in the old page files — no middleware needed.
