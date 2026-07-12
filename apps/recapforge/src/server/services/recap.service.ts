import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { lookup } from 'node:dns/promises';
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
  try {
    await addForgeRecapJob({ campaignId: input.campaignId, sessionId: input.sessionId, userId });
  } catch (e) {
    // Queue add failed (e.g. Redis down — enableOfflineQueue:false fails fast). Without
    // this, the row is stuck 'generating' forever and the /recap poller never terminates.
    await prisma.forgeRecap.updateMany({
      where: { sessionId: input.sessionId },
      data: { status: 'failed', error: 'Could not queue recap generation.' },
    });
    throw e;
  }
}

export async function getRecap(prisma: PrismaClient, userId: string, input: { campaignId: string; sessionId: string }) {
  await assertCampaignOwner(prisma, input.campaignId, userId);
  const row = await prisma.forgeRecap.findFirst({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    select: { status: true, content: true, error: true, publishedAt: true, publishedUrl: true, publishError: true },
  });
  const campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId }, select: { publishConfig: true } });
  const canPublish = campaign?.publishConfig != null;
  if (!row) return null;
  return {
    status: row.status,
    content: (row.content as unknown as RecapContent) ?? null,
    error: row.error,
    publishedAt: row.publishedAt,
    publishedUrl: row.publishedUrl,
    publishError: row.publishError,
    canPublish,
  };
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

const MAX_INLINE_IMAGE_BYTES = 5_000_000;

/** IPv4 dotted-quad check (no octal/hex tricks — good enough for this best-effort guard). */
function isIPv4Literal(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** Pragmatic private/loopback/link-local block for IPv4 and IPv6 literals. */
function isBlockedIp(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, '');
  if (isIPv4Literal(addr)) {
    const parts = addr.split('.').map(Number);
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true; // malformed → block
    const [a, b] = parts;
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }
  // IPv6
  const lower = addr.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 ULA
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10
  return false;
}

/** Blocks localhost, private/loopback/link-local IPs (literal or DNS-resolved). Best-effort SSRF guard. */
async function isBlockedHost(hostname: string): Promise<boolean> {
  const host = hostname.toLowerCase();
  if (host === 'localhost') return true;
  if (isIPv4Literal(host) || host.includes(':')) return isBlockedIp(host);
  try {
    const { address } = await lookup(host);
    return isBlockedIp(address);
  } catch {
    return true; // DNS failed — don't inline, just don't crash
  }
}

export async function inlineImage(content: RecapContent): Promise<RecapContent> {
  const url = content.header.image?.url;
  if (!url || url.startsWith('data:')) return content;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`blocked scheme ${u.protocol}`);
    if (await isBlockedHost(u.hostname)) throw new Error(`blocked host ${u.hostname}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_INLINE_IMAGE_BYTES) throw new Error('image too large');
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
