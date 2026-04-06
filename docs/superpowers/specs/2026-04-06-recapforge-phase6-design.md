# RecapForge Phase 6 — Editing & Approval UI Design

## Goal

Let DMs edit, approve, and share session recaps to Discord without leaving the recap page.

## Architecture

### Data Layer

**New tRPC procedures (add to `src/server/routers/recap.ts`):**

- `recap.updateSections` — takes `recapId`, `campaignId`, `sections` (array of `{key, title, content}`), `status` (`REVIEWED` | `QUICK_FIRE`). Writes updated sections JSON + new status to `SessionRecap`. Requires `campaignDMProcedure`.
- `recap.regenSection` — takes `recapId`, `campaignId`, `sectionKey`, optional `dmNote`. Fires a targeted Anthropic call for just that section using the existing transcript. Returns `{ content: string }`. Does NOT write to DB — client holds result in local state. Requires `campaignDMProcedure`.
- `recap.shareToDiscord` — takes `recapId`, `campaignId`. Fetches recap sections + campaign's linked Discord channel. Posts formatted recap via bot. Returns typed error if channel not linked or bot not in guild. Requires `campaignDMProcedure`.
- `recap.linkDiscordChannel` — takes `campaignId`, `guildId`, `channelId`. Saves to `Campaign` model (new fields). Requires `campaignDMProcedure`.

**Prisma schema additions (`prisma/schema.prisma`):**
- `Campaign` model: add `discordGuildId String?` and `discordRecapChannelId String?`

**`RecapStatus` values** — `REVIEWED` and `QUICK_FIRE` are already present in `prisma/schema.prisma` (lines 1717–1718). No enum changes needed.

### Discord Bot

- Register `/quiverdm link` slash command (guild scope) — prompts channel selection, calls `recap.linkDiscordChannel` via internal API
- Bot invite URL must include `applications.commands` scope
- Bot app ID: `1438484597850767380`

### Client State Model (`recap/page.tsx`)

```ts
const [localSections, setLocalSections] = useState<Map<string, string>>(new Map());
const [regenning, setRegenning] = useState<Set<string>>(new Set());
const isDirty = sections?.some(s => localSections.has(s.key) && localSections.get(s.key) !== s.content) ?? false;
```

On approve/quick-fire: call `updateSections` with merged `localSections` over saved sections + new status.
On navigate-away with `isDirty`: show confirm dialog via `useBeforeUnload` + Next.js router guard.

## UI Components

### Recap Page (`src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`)

**Section cards — edit mode:**
- Clicking content area (or pencil icon) switches `<p>` to `<textarea>` with same amber text styling
- Escape cancels, restores saved content
- No auto-save — all edits held in `localSections` state

**Per-section regen:**
- "Regen section" button appears when section is in edit mode
- Opens inline input for optional DM note ("anything to keep in mind?")
- Fires `recap.regenSection`, shows spinner on section while in-flight
- On success: updates `localSections` for that key, clears spinner
- On failure: toast error, existing content preserved

**Top-right action bar additions (when `activeRecap.status === 'AUTO_GENERATED'` or `isDirty`):**
- **Approve** button — calls `updateSections` with `status: 'REVIEWED'`
- **Quick-fire** button — calls `updateSections` with `status: 'QUICK_FIRE'`
- Both disabled while mutation is pending

**Share to Discord button:**
- Visible when campaign has linked channel AND recap is `REVIEWED` or `QUICK_FIRE`
- Opens modal: formatted preview (first section + truncation notice), shows target channel name
- DM confirms → fires `recap.shareToDiscord`
- On success: toast "Posted to #channel-name"
- On failure — no channel: modal shows "Link a Discord channel first" with instructions
- On failure — bot not in guild: modal shows "Add QuiverDM bot first" with invite URL

**Style picker dots:**
- Each style button shows a dot indicating the best status recap available for that style
- Green dot: `AUTO_GENERATED` (unreviewed)
- Amber dot: `REVIEWED`
- Gold dot: `QUICK_FIRE`
- Priority: `QUICK_FIRE` > `REVIEWED` > `AUTO_GENERATED` when multiple exist for one style

### Campaign Settings — Discord Integration

New section on the existing campaign settings page at `src/app/(app)/campaigns/[slug]/settings/page.tsx`:

- Heading: "Discord Integration"
- Shows current linked channel name if set, else "No channel linked"
- "Link via slash command" instructions: run `/quiverdm link` in your Discord server
- Manual fallback: channel ID input + guild ID input + save button (calls `recap.linkDiscordChannel`)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `regenSection` fails | Toast error, existing content kept, spinner cleared |
| `updateSections` fails | Toast error, local state preserved (retry possible) |
| `shareToDiscord` — no channel | Modal shows link instructions |
| `shareToDiscord` — bot not in guild | Modal shows bot invite URL |
| `shareToDiscord` — Discord API error | Toast with error reason |
| Navigate away with dirty state | Confirm dialog: "You have unsaved changes" |

## Testing

**New workflow spec:** `tests/workflows/recapforge-editing.workflow.spec.ts`
- DM edits a section, approves — status shows REVIEWED
- DM uses regen-with-note — content updates in place
- DM shares to Discord — success toast
- Navigate away with dirty changes — confirm dialog appears

**Persona update:** `tests/personas/veteran-dm.persona.spec.ts`
- Add checkpoint: recap page loads, edit section, approve recap
