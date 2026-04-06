# RecapForge Phase 6b — Discord Channel Linking & Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let DMs link a Discord channel to their campaign and share approved recaps to that channel with one click via a preview modal.

**Architecture:** Two new Campaign fields (`discordGuildId`, `discordRecapChannelId`) store the linked channel. A `recap.linkDiscordChannel` procedure saves them via campaign settings page. A `recap.shareToDiscord` procedure posts recap content to the channel using the existing QuiverDM bot token (`QUIVERDM_DISCORD_BOT_TOKEN`). A preview modal on the recap page shows content before posting.

**Tech Stack:** tRPC v11, Prisma migration, Discord REST API v10 (bot token POST to channel), Next.js Dialog component, existing `postSummaryToDiscord` pattern in `src/lib/discord/`.

> **Note:** The Discord slash command (`/quiverdm link`) is deferred — channel linking is done manually via campaign settings only. The slash command requires a Discord interactions endpoint + auth token exchange and is a separate future task.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `discordGuildId String?` and `discordRecapChannelId String?` to Campaign |
| `src/lib/discord/bot.ts` | Create | `postRecapToChannel()` — bot-token POST to Discord channel |
| `src/server/routers/recap.ts` | Modify | Add `linkDiscordChannel` and `shareToDiscord` procedures |
| `src/server/routers/campaigns.ts` | Check | Verify `campaigns.getById` returns new Discord fields (likely automatic) |
| `src/app/(app)/campaigns/[slug]/settings/page.tsx` | Modify | Add Discord Integration section with channel ID + guild ID inputs |
| `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx` | Modify | Add Share to Discord button + preview modal |
| `tests/workflows/recapforge-editing.workflow.spec.ts` | Modify | Add Discord share stub |

---

### Task 1: Prisma — add Discord fields to Campaign

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to Campaign model**

Find the `Campaign` model in `prisma/schema.prisma`. Add after the existing fields (before the closing `}`):

```prisma
  discordGuildId         String?
  discordRecapChannelId  String?
```

- [ ] **Step 2: Push schema to local DB**

```bash
cd E:/Projects/QuiverDM && npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep -i "schema\|prisma\|campaign" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(recap): add discordGuildId + discordRecapChannelId to Campaign"
```

---

### Task 2: Discord bot utility — postRecapToChannel

**Files:**
- Create: `src/lib/discord/bot.ts`

- [ ] **Step 1: Create bot.ts**

```ts
const DISCORD_API = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.QUIVERDM_DISCORD_BOT_TOKEN;

interface PostRecapOptions {
  channelId: string;
  sessionTitle: string;
  sections: Array<{ title: string; content: string }>;
}

export async function postRecapToChannel(opts: PostRecapOptions): Promise<void> {
  if (!BOT_TOKEN) throw new Error('QUIVERDM_DISCORD_BOT_TOKEN not set');

  // Build message — Discord limit 2000 chars per message
  const header = `**${opts.sessionTitle} — Session Recap**\n\n`;
  const body = opts.sections
    .map((s) => `**${s.title}**\n${s.content}`)
    .join('\n\n');

  const full = header + body;
  const chunks = splitIntoChunks(full, 2000);

  for (const chunk of chunks) {
    const res = await fetch(`${DISCORD_API}/channels/${opts.channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Discord API error ${res.status}: ${text}`);
    }
  }
}

function splitIntoChunks(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    // Split at last newline before limit
    const slice = remaining.slice(0, limit);
    const lastNewline = slice.lastIndexOf('\n');
    const cut = lastNewline > limit / 2 ? lastNewline : limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return chunks;
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "discord/bot" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/discord/bot.ts
git commit -m "feat(discord): postRecapToChannel utility using bot token"
```

---

### Task 3: Add linkDiscordChannel and shareToDiscord procedures

**Files:**
- Modify: `src/server/routers/recap.ts`

- [ ] **Step 1: Add postRecapToChannel import**

At the top of `src/server/routers/recap.ts`, add:

```ts
import { postRecapToChannel } from '@/lib/discord/bot';
```

- [ ] **Step 2: Add linkDiscordChannel procedure**

Add before the closing `});` of the router:

```ts
  linkDiscordChannel: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        guildId: z.string().min(1),
        channelId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          discordGuildId: input.guildId,
          discordRecapChannelId: input.channelId,
        },
      });
      return { ok: true };
    }),
```

- [ ] **Step 3: Add shareToDiscord procedure**

```ts
  shareToDiscord: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        recapId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const [recap, campaign] = await Promise.all([
        prisma.sessionRecap.findFirst({
          where: { id: input.recapId, campaignId: input.campaignId },
          include: { session: { select: { title: true, sessionNumber: true } } },
        }),
        prisma.campaign.findUnique({
          where: { id: input.campaignId },
          select: { discordRecapChannelId: true, discordGuildId: true },
        }),
      ]);

      if (!recap) throw new NotFoundError('recap', input.recapId);
      if (!campaign?.discordRecapChannelId) {
        throw new Error('NO_CHANNEL_LINKED');
      }

      const sessionTitle =
        recap.session.title ?? `Session ${recap.session.sessionNumber}`;
      const sections = recap.sections as Array<{ key: string; title: string; content: string }>;

      await postRecapToChannel({
        channelId: campaign.discordRecapChannelId,
        sessionTitle,
        sections,
      });

      return { ok: true };
    }),
```

- [ ] **Step 4: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/recap.ts
git commit -m "feat(recap): add linkDiscordChannel and shareToDiscord procedures"
```

---

### Task 4: Campaign settings — Discord Integration section

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/settings/page.tsx`

- [ ] **Step 1: Add Discord state and mutation**

In `CampaignSettingsPage`, after the `discordWebhookUrl` state:

```tsx
const [discordGuildId, setDiscordGuildId] = useState('');
const [discordChannelId, setDiscordChannelId] = useState('');

const linkDiscordMutation = trpc.recap.linkDiscordChannel.useMutation({
  onSuccess: () => {
    toast({ title: 'Discord channel linked' });
    utils.campaigns.getById.invalidate({ id: campaignId });
  },
  onError: (e) => toast({ title: 'Link failed', description: e.message, variant: 'destructive' }),
});
```

- [ ] **Step 2: Populate state from campaign data**

In the existing `useEffect` that sets state from `campaign.data`, add:

```tsx
setDiscordGuildId((data.discordGuildId as string) || '');
setDiscordChannelId((data.discordRecapChannelId as string) || '');
```

- [ ] **Step 3: Add Discord Integration section to the JSX**

Find a good location in the settings page JSX (before or after the Webhook section). Add:

```tsx
<Separator className="my-6" />
<div className="space-y-4">
  <div>
    <h3 className="text-sm font-semibold" style={{ color: 'hsl(35 20% 78%)' }}>
      Discord Integration
    </h3>
    <p className="text-xs mt-1" style={{ color: 'hsl(35 5% 42%)' }}>
      Link a Discord channel to share session recaps via the QuiverDM bot.
      Add the bot to your server first, then paste the channel and server IDs below.
    </p>
  </div>

  {(discordGuildId || discordChannelId) && (
    <p className="text-xs" style={{ color: 'hsl(35 50% 52%)' }}>
      Currently linked — channel ID: {discordChannelId || '—'}
    </p>
  )}

  <div className="grid grid-cols-2 gap-3">
    <div>
      <Label className="text-xs">Discord Server (Guild) ID</Label>
      <Input
        value={discordGuildId}
        onChange={(e) => setDiscordGuildId(e.target.value)}
        placeholder="1234567890123456789"
        className="mt-1 h-8 text-xs font-mono"
      />
    </div>
    <div>
      <Label className="text-xs">Channel ID</Label>
      <Input
        value={discordChannelId}
        onChange={(e) => setDiscordChannelId(e.target.value)}
        placeholder="1234567890123456789"
        className="mt-1 h-8 text-xs font-mono"
      />
    </div>
  </div>

  <Button
    size="sm"
    className="h-8 text-xs"
    onClick={() =>
      linkDiscordMutation.mutate({
        campaignId,
        guildId: discordGuildId.trim(),
        channelId: discordChannelId.trim(),
      })
    }
    disabled={
      linkDiscordMutation.isPending ||
      !discordGuildId.trim() ||
      !discordChannelId.trim()
    }
  >
    {linkDiscordMutation.isPending ? 'Saving…' : 'Save Discord Channel'}
  </Button>
</div>
```

- [ ] **Step 4: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "settings/page" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/settings/page.tsx
git commit -m "feat(settings): Discord Integration section for recap channel linking"
```

---

### Task 5: Share to Discord modal on recap page + workflow spec

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`
- Modify: `tests/workflows/recapforge-editing.workflow.spec.ts`

- [ ] **Step 1: Add dialog imports**

Add to the imports at the top of recap/page.tsx:

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquare } from 'lucide-react';
```

- [ ] **Step 2: Add share state and mutation**

After `regenSectionMutation`:

```tsx
const [shareDialogOpen, setShareDialogOpen] = useState(false);

const shareToDiscordMutation = trpc.recap.shareToDiscord.useMutation({
  onSuccess: () => {
    setShareDialogOpen(false);
    toast({ title: 'Posted to Discord' });
  },
  onError: (e) => {
    setShareDialogOpen(false);
    const msg =
      e.message === 'NO_CHANNEL_LINKED'
        ? 'No Discord channel linked. Go to Campaign Settings → Discord Integration.'
        : e.message;
    toast({ title: 'Share failed', description: msg, variant: 'destructive' });
  },
});
```

- [ ] **Step 3: Add Share to Discord button to action bar**

Add alongside the Approve/Quick-fire buttons (after them):

```tsx
{activeRecap &&
  ['REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) && (
  <Button
    size="sm"
    variant="outline"
    className="h-8 gap-1.5 text-xs"
    onClick={() => setShareDialogOpen(true)}
  >
    <MessageSquare className="h-3 w-3" /> Share to Discord
  </Button>
)}
```

- [ ] **Step 4: Add share preview dialog**

Before the closing `</div>` of the page return:

```tsx
<Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle style={{ color: 'hsl(35 20% 88%)' }}>Share to Discord</DialogTitle>
      <DialogDescription style={{ color: 'hsl(35 5% 48%)' }}>
        This recap will be posted to your linked Discord channel.
      </DialogDescription>
    </DialogHeader>
    <div
      className="rounded-sm border border-border/30 px-4 py-3 max-h-48 overflow-y-auto text-xs leading-relaxed"
      style={{ background: 'hsl(240 10% 9%)', color: 'hsl(35 10% 60%)' }}
    >
      <p className="font-semibold mb-2" style={{ color: 'hsl(35 20% 78%)' }}>
        {sessionTitle}
      </p>
      {effectiveSections?.slice(0, 2).map((s) => (
        <div key={s.key} className="mb-2">
          <p className="font-semibold text-[10px] uppercase tracking-widest mb-1" style={{ color: 'hsl(35 60% 42%)' }}>
            {s.title}
          </p>
          <p className="line-clamp-3">{s.content}</p>
        </div>
      ))}
      {(effectiveSections?.length ?? 0) > 2 && (
        <p className="opacity-50 italic">+ {(effectiveSections?.length ?? 0) - 2} more sections…</p>
      )}
    </div>
    <DialogFooter>
      <Button variant="ghost" size="sm" onClick={() => setShareDialogOpen(false)}>
        Cancel
      </Button>
      <Button
        size="sm"
        onClick={() =>
          shareToDiscordMutation.mutate({
            campaignId,
            recapId: activeRecap!.id as string,
          })
        }
        disabled={shareToDiscordMutation.isPending}
      >
        {shareToDiscordMutation.isPending ? 'Posting…' : 'Post to Discord'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Add workflow spec stub**

In `tests/workflows/recapforge-editing.workflow.spec.ts`, add:

```ts
test.fixme('DM shares approved recap to Discord — success toast shown', async ({ page }) => {
  // Phase 6b — requires Discord bot token + linked channel in test campaign
  void page;
});
```

- [ ] **Step 6: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit and push**

```bash
git add src/app/\(app\)/campaigns/\[slug\]/sessions/\[sessionId\]/recap/page.tsx tests/workflows/recapforge-editing.workflow.spec.ts
git commit -m "feat(recap): Share to Discord modal with preview"
git push origin main
```
