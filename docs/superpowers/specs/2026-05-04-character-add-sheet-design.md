# Character Add Sheet — Design Spec
**Date:** 2026-05-04

## Overview

Replace the heavy 5-tab `/characters/new` full page with a right-side Sheet that presents DDB import as the hero path and a minimal manual form as a fallback. Removes ability score builder, SRD pickers, and personality field tabs — none of which are needed in a DM-focused app.

## Entry Points & Routing

- The two current buttons on `/characters` ("Import from D&D Beyond" and "New Character") are replaced by a single "Add Character" button.
- Clicking the button sets `?create=true` on the URL. The page reads this searchParam and opens the Sheet.
- The Sheet's `onOpenChange(false)` clears the param via `router.replace('/characters')`.
- `/characters/new` becomes a redirect to `/characters?create=true` (preserves any existing links).
- The existing DDB import Dialog on the list page is removed.

## Sheet Structure

A right-side shadcn `Sheet` with title "Add Character".

### Section 1 — DDB Import (hero)

- Overline label "Import from D&D Beyond" with DDB icon
- URL text input, placeholder `https://www.dndbeyond.com/characters/12345678`
- "Import" button — spinner while pending, inline error message on failure
- On success: sheet closes, navigate to `/characters/[id]`

### Section 2 — Manual Creation (fallback)

- Divider with "or create manually" label
- Portrait upload: small square click-to-upload area
- Name input (required)
- Class and Race text inputs (free text, not SRD pickers) in a 2-column grid
- Level number input (1–20, default 1)
- Backstory textarea
- "Create Character" button — on success: sheet closes, navigate to `/characters/[id]`

## Components

| Action | Path |
|--------|------|
| Create | `src/components/character/CharacterAddSheet.tsx` |
| Modify | `src/app/(app)/characters/page.tsx` |
| Delete | `src/app/(app)/characters/new/page.tsx` |
| Delete | `src/data/srd-characters.ts` |

`CharacterAddSheet` is self-contained — owns both mutation calls and all local state.

## tRPC Procedures Used

No new procedures needed.

- DDB import: `charactersDndBeyond.importCharacter({ url })`
- Manual create: `characters.create({ name, class, race, level, backstory, portraitUrl })`

## What Is Removed

- 5-tab create page (Details / Race / Class / Background / Scores)
- SRD race, class, background pickers
- Ability score builder (standard array, point buy, manual)
- Personality traits, ideals, bonds, flaws fields
- Standalone DDB import Dialog on the list page

## Out of Scope

- Character edit page (`/characters/[id]/edit`) — separate task
- Sheet audit across other routes — separate task
