# Homebrew Chat Ingestion — Design Spec

**Date:** 2026-04-01
**Status:** Approved

## Problem

The current media import flow (upload → one-shot extract → static review) misses content. Haiku vision is weak on handwritten notes and complex stat blocks. There is no feedback loop — if the extraction misses something, the DM can only fix it by editing a degraded result. The original image is gone by review time.

## Solution

Replace the static extract+review flow with a conversational chat interface. The AI analyzes uploaded files and describes what it found, asking clarifying questions about anything unclear. The DM corrects and adds detail through natural conversation. The extracted items panel updates live on the right as the conversation progresses.

## Architecture

### New Files

- `src/app/api/uploads/homebrew-import/chat/route.ts` — stateless chat endpoint
- `src/app/api/uploads/homebrew-import/prepare/route.ts` — PDF→markdown via Docling

### Modified Files

- `src/components/homebrew/import-from-media-dialog.tsx` — full rewrite

### Unchanged Files

- `src/app/api/uploads/homebrew-import/extract/route.ts` — kept for internal/programmatic use
- `src/app/api/uploads/homebrew-import/save/route.ts` — unchanged

## API: `/prepare` Endpoint

`POST /api/uploads/homebrew-import/prepare`

- Accepts: FormData with a single `file` field (PDF only)
- Returns: `{ markdown: string }`
- Implementation: thin wrapper around existing Docling call, extracted from `extract/route.ts` so both routes can share it
- Auth: requires session

## API: `/chat` Endpoint

`POST /api/uploads/homebrew-import/chat`

Always JSON. No server-side session state.

### Request

```ts
interface ChatRequest {
  messages: ClientMessage[];
}

interface ClientMessage {
  role: 'user' | 'assistant';
  text: string;
  images?: Array<{ base64: string; mimeType: string }>;
}
```

### Response

```ts
interface ChatResponse {
  text: string;           // AI response with JSON block stripped — display-safe
  items: ExtractedItem[]; // parsed from JSON block in AI response
  messages: ClientMessage[]; // full updated history — client stores and passes back
}

interface ExtractedItem {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}
```

### Server Logic

1. Convert `ClientMessage[]` to Anthropic `MessageParam[]`. Images become `image` content blocks in the user message that contains them.
2. Select model: `claude-sonnet-4-6` if any message in history contains images; `claude-haiku-4-5-20251001` for text-only sessions.
3. Call Anthropic with system prompt (see below).
4. Parse response: strip the ` ```json ... ``` ` items block to get display-safe `text`; parse items from the block.
5. Append assistant message to history, return `{ text, items, messages }`.

### System Prompt

```
You are a D&D homebrew content extraction assistant helping a Dungeon Master capture their creative work.

When given images or text containing D&D content:
1. Briefly describe what you see (mention anything unclear or hard to read)
2. Extract all D&D homebrew content you can find
3. Ask 1-2 concise questions about genuinely unclear parts only

When the user corrects or adds information, update your extraction accordingly and confirm the change.

IMPORTANT: Always end every response with a JSON block containing ALL currently extracted items:

```json
{"items":[]}
```

Item schema: { "name": string, "type": string, "description": string, "properties": {} }
Valid types: item, spell, creature, location, faction, race, rule, adventure, npc_concept, plot_hook, lore, note

Keep descriptions rich — preserve the DM's original detail and voice. Do not summarise or paraphrase.
If nothing D&D-related is found, return the empty items array and say so clearly.
```

## Dialog: `ImportFromMediaDialog`

### Steps

`select → chat → saving → done`

The `extracting` and `review` steps are removed.

### `select` Step

Identical to current: file picker, drag/drop (images, PDFs, text/markdown), campaign selector (when no `campaignId` prop), up to 5 files at 10MB each.

Button label changes from "Extract" to "Start Chat".

On click:
1. Client preps all files in browser:
   - Images → `FileReader.readAsDataURL()` → strip `data:...;base64,` prefix to get raw base64 + mimeType from the data URL
   - Text/markdown → `FileReader.readAsText()`
   - PDFs → `POST /prepare` → markdown string
2. Transition to `chat` step
3. Auto-send first message:
   - Single file: `"Please extract all D&D homebrew content from this [image/document]."` with file attached
   - Multiple files: `"Please extract all D&D homebrew content from these [N] files."` with all files attached as image blocks or inline text

### `chat` Step — Layout

Max-width: `max-w-3xl`. Height: `max-h-[85vh]`, flex column.

**Left panel (flex-1):** Scrollable message history. User messages right-aligned with amber tint border. AI messages left-aligned on card background. Loading state shows a pulsing bubble. Auto-scrolls to latest message.

**Right panel (w-60, hidden below `sm`):** Live items panel.
- Header: "EXTRACTED (N)" in amber overline style
- Each item: name (inline editable Input), type (inline editable Select), delete button
- Edits are client-side only — not sent to AI, not re-extracted
- Empty state: "Nothing yet — the AI will populate this as you chat"

**Bottom bar (full width):**
- "Add files" icon button (paperclip) — opens file picker for mid-session uploads
- Text input (flex-1) — send on Enter or Send button
- "Save N items" primary button — disabled when 0 items, triggers `saving` step

**Responsive fallback (below `sm`):** Right panel moves below chat as a collapsible section. Collapsed state shows count badge only.

### Adding Files Mid-Session

1. User clicks "Add files" paperclip → file picker opens (same accept types)
2. Client preps new files same as initial prep
3. Appends a new user message: `"Here's another file: [filename]"` with image block (or text content)
4. Sends to `/chat` endpoint, conversation continues

### `saving` and `done` Steps

Unchanged from current implementation — `POST /api/uploads/homebrew-import/save` with the current items array.

## Error Handling

- File prep failure (e.g. Docling down for PDF): show inline error per file, skip that file, continue with others
- Chat API error: show error in chat as a system message, allow retry via resend
- Empty extraction (items array is empty after first turn): AI explains what it saw; user can add context via chat to try again
- Max history size: if `messages` array exceeds 20 turns, show a soft warning: "Long conversation — consider saving what you have and starting a new import"

## What Is Not Changed

- `save/route.ts` — item save logic is identical
- `extract/route.ts` — kept as-is for internal use (PDF pipeline workers etc.)
- `HomebrewContentCard` — unchanged
- All campaign homebrew tab logic
