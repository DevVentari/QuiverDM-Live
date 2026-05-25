# Session Intelligence Phase 4 — PDF/Doc Import Pipeline

**Date:** 2026-05-25
**Status:** Approved for implementation

## Overview

Phase 4 adds a document import pipeline that extracts structured Session Intelligence data (PrepSecrets, SessionPhases, SessionRoutes, NpcBehaviorProfiles) from a DM's prep notes — PDF, plain text, or paste. The entry point is the BRIEF tab in the cockpit's SessionIntelDrawer. The DM reviews extracted items before anything is written to the database.

---

## 1. Architecture & Flow

**State machine:** `idle → uploading → extracting → reviewing → confirming → done`

**Two-mutation pipeline:**

1. `sessions.extractSIPrepDoc` — accepts file/text, runs AI extraction + NPC fuzzy match, returns a preview payload. **No DB writes.**
2. `sessions.confirmSIPrepImport` — accepts the user's accepted/edited selections, writes all items additively. **All writes.**

This keeps the review sheet stateless: it receives the extraction payload as props and emits a confirm payload back to the parent.

**Entry point:** "Import from doc" button in the BRIEF tab of `SessionIntelDrawer`. State lives in the drawer; the review sheet renders as a separate `Sheet` overlaid on the drawer.

---

## 2. Extraction (`extractSIPrepDoc`)

**Input:** `{ campaignId, sessionId, text: string }` — callers extract text before calling (PDF via existing Docling/pdfplumber pipeline; paste/txt directly).

**AI function:** `src/lib/ai/extract-si-prep-doc.ts`
- Provider: Claude via `chatWithAI(messages, { forceProvider: 'claude', temperature: 0.2 })`
- Schema (Zod): extracts `intentBrief`, `secrets[]`, `phases[]`, `routes[]`, `npcProfiles[]`

**Extraction schema:**
```ts
const SIExtractedDoc = z.object({
  intentBrief: z.string().optional(),
  secrets: z.array(z.object({
    name: z.string(),
    content: z.string(),
    isCritical: z.boolean().default(false),
    knowledge: z.array(z.object({
      entityName: z.string(),
      revealCondition: z.string().optional(),
    })),
  })),
  phases: z.array(z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().int(),
  })),
  routes: z.array(z.object({
    title: z.string(),
    description: z.string(),
    isDefault: z.boolean().default(false),
  })),
  npcProfiles: z.array(z.object({
    name: z.string(),
    defaultBehavior: z.string(),
    triggeredBehaviors: z.array(z.object({ condition: z.string(), behavior: z.string() })),
    criticalDialogue: z.array(z.object({ line: z.string(), trigger: z.string() })),
  })),
});
```

**NPC fuzzy match (server-side, after AI extraction):**
- For each extracted NPC name: `prisma.worldEntity.findMany({ where: { campaignId, type: 'NPC', name: { contains: token, mode: 'insensitive' } } })` for each word token
- Scoring: word overlap (shared tokens / max token count). Score ≥ 0.7 = confident suggestion
- Each NPC profile in the returned preview includes `{ suggestedMatch?: { worldEntityId, name, score } }`

**Return shape:** `SIExtractedPreview` — the extraction result with NPC suggestions attached.

---

## 3. Review Sheet (`si-review-sheet.tsx`)

`src/components/cockpit/session-intel/si-review-sheet.tsx`

A full-height shadcn `Sheet` (side="right", width ~640px) with:

**Header:** "Review Import" title + "X of Y items" count + Cancel/Confirm footer buttons

**5 collapsible sections** (shadcn Accordion):

1. **Intent Brief** — editable textarea, pre-filled from extraction
2. **Secrets** (`N extracted`) — per-secret card: name/content editable, isCritical toggle, knowledge chips (entityName + optional revealCondition), per-item accept/discard toggle
3. **Phases** (`N extracted`) — per-phase card: title/description editable, order displayed, per-item accept/discard
4. **Routes** (`N extracted`) — per-route card: title/description editable, isDefault radio (only one allowed), per-item accept/discard
5. **NPCs** (`N extracted`) — per-NPC card: name/defaultBehavior editable, triggered behaviors + dialogue lines listed, NPC link widget: if `suggestedMatch` exists, shows chip "Link to [Name] (87%)" with accept/skip toggle; if skipped or no suggestion, will create a new WorldEntity on confirm

**State:** all edits are local React state in the sheet. On "Confirm Import" the sheet assembles the final payload and calls `confirmSIPrepImport`.

---

## 4. `confirmSIPrepImport` Mutation

**Input:** `{ campaignId, sessionId, items: SIImportConfirmPayload }`

```ts
type SIImportConfirmPayload = {
  intentBrief?: string;
  secrets: Array<{
    name: string; content: string; isCritical: boolean;
    knowledge: Array<{ entityName: string; worldEntityId?: string; revealCondition?: string }>;
  }>;
  phases: Array<{ title: string; description: string; order: number }>;
  routes: Array<{ title: string; description: string; isDefault: boolean }>;
  npcProfiles: Array<{
    worldEntityId?: string;
    name: string;
    defaultBehavior: string;
    triggeredBehaviors: TriggeredBehavior[];
    criticalDialogue: CriticalDialogueLine[];
  }>;
};
```

**Write behavior — strictly additive, never overwrites existing data:**

- **Intent brief:** stored as `session.prepNotes` (new plain-text field on `Session` model, added in migration)
- **PrepSecrets:** `prisma.prepSecret.create` for each accepted secret, then `PrepKnowledge` rows with resolved `worldEntityId`
- **SessionPhases:** `create` with `order` starting after current `MAX(order)` for this session (existing phases not renumbered)
- **SessionRoutes:** `create`; if `isDefault: true`, first clears `isDefault` on all other routes for this session
- **NpcBehaviorProfiles:**
  - `worldEntityId` present (user accepted fuzzy match) → `upsert` on `worldEntityId`; merges `triggeredBehaviors` and `criticalDialogue` by concat + dedupe; does not replace `defaultBehavior` if already set
  - `worldEntityId` absent → create new `WorldEntity` (`type: NPC, campaignId`) first, then create profile against it

**Return:** `{ secretsCreated, phasesCreated, routesCreated, profilesUpserted, entitiesCreated }` — counts shown in success toast.

---

## 5. Testing

Additions to `tests/workflows/session-intelligence-prep.workflow.spec.ts`:

**Test 1 — extraction happy path:**
- Open session cockpit → BRIEF tab → "Import from doc"
- Upload a small plaintext `.txt` fixture
- Verify review sheet opens with at least one section populated
- Confirm import, verify success toast "Import complete"

**Test 2 — NPC link flow:**
- Same flow with a fixture containing an NPC name that matches an existing WorldEntity
- Verify the NPC section shows a suggestion chip with the matched entity name
- Accept the suggestion, confirm
- Verify no duplicate WorldEntity created (via `trpc.npcs.list`)

---

## Schema Change

Add to `Session` model in `prisma/schema.prisma`:
```prisma
prepNotes  String?  // DM prep intent brief, plain text
```

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `prepNotes String?` to Session |
| `src/lib/ai/extract-si-prep-doc.ts` | New — AI extraction function |
| `src/server/routers/sessions.ts` | Add `extractSIPrepDoc` + `confirmSIPrepImport` procedures |
| `src/components/cockpit/session-intel/si-review-sheet.tsx` | New — review sheet component |
| `src/components/cockpit/session-intel/brief-panel.tsx` | Add "Import from doc" button + upload/state wiring |
| `tests/workflows/session-intelligence-prep.workflow.spec.ts` | Add 2 tests |
