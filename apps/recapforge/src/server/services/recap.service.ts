import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { assertCampaignOwner } from '../guards';
import { addForgeRecapJob } from '@/lib/queue';
import { renderRecapHtml } from '@/lib/render-recap';
import { RecapContentSchema, DEFAULT_THEME, type RecapContent, type RecapTheme } from '@quiverdm/shared';

export function resolveTheme(themeJson: unknown): RecapTheme {
  if (themeJson && typeof themeJson === 'object' && 'palette' in themeJson) return themeJson as RecapTheme;
  return DEFAULT_THEME;
}

async function loadMeta(prisma: PrismaClient, campaignId: string, sessionId: string) {
  const session = await prisma.gameSession.findFirst({
    where: { id: sessionId, campaignId }, select: { sessionNumber: true, campaign: { select: { name: true, theme: true } } },
  });
  return {
    campaignName: session?.campaign.name ?? 'The Chronicle',
    sessionNumber: session?.sessionNumber ?? 1,
    theme: resolveTheme(session?.campaign.theme),
  };
}

export async function enqueueRecap(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string }): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  // forgeRecap.upsert's `where` can only key on the unique `sessionId` — verify the
  // session actually belongs to the caller's campaign first, or a DM who owns SOME
  // campaign could upsert a stranger's recap row by guessing/knowing their sessionId.
  const session = await prisma.gameSession.findFirst({
    where: { id: input.sessionId, campaignId: input.campaignId }, select: { id: true },
  });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found in this campaign.' });
  await prisma.forgeRecap.upsert({
    where: { sessionId: input.sessionId },
    create: { sessionId: input.sessionId, status: 'generating' },
    update: { status: 'generating', error: null },
  });
  await addForgeRecapJob({ campaignId: input.campaignId, sessionId: input.sessionId, userId });
}

export async function getRecap(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string }) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const row = await prisma.forgeRecap.findFirst({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    select: { status: true, content: true, error: true },
  });
  if (!row) return null;
  return { status: row.status, content: (row.content as unknown as RecapContent) ?? null, error: row.error };
}

export async function updateRecap(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string; content: unknown }): Promise<void> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const parsed = RecapContentSchema.parse(input.content);
  await prisma.forgeRecap.updateMany({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    data: { content: parsed as object, status: 'ready' },
  });
}

async function loadContent(prisma: PrismaClient, campaignId: string, sessionId: string): Promise<RecapContent> {
  const row = await prisma.forgeRecap.findFirst({
    where: { sessionId, session: { campaignId } }, select: { content: true },
  });
  if (!row?.content) throw new Error('No recap content to render.');
  return row.content as unknown as RecapContent;
}

export async function renderPreview(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string }): Promise<string> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const content = await loadContent(prisma, input.campaignId, input.sessionId);
  const meta = await loadMeta(prisma, input.campaignId, input.sessionId);
  return renderRecapHtml(content, meta.theme, { campaignName: meta.campaignName, sessionNumber: meta.sessionNumber });
}

async function inlineImage(content: RecapContent): Promise<RecapContent> {
  const url = content.header.image?.url;
  if (!url || url.startsWith('data:')) return content;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const type = res.headers.get('content-type') ?? 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    const dataUri = `data:${type};base64,${buf.toString('base64')}`;
    return { ...content, header: { ...content.header, image: { ...content.header.image!, url: dataUri } } };
  } catch (e) {
    console.warn(`[recap] image inline failed, hotlinking: ${e instanceof Error ? e.message : e}`);
    return content; // hotlink fallback
  }
}

export async function renderDownload(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string }): Promise<{ filename: string; html: string }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const raw = await loadContent(prisma, input.campaignId, input.sessionId);
  const meta = await loadMeta(prisma, input.campaignId, input.sessionId);
  const content = await inlineImage(raw);
  const html = renderRecapHtml(content, meta.theme, { campaignName: meta.campaignName, sessionNumber: meta.sessionNumber });
  return { filename: `session-${meta.sessionNumber}.html`, html };
}
