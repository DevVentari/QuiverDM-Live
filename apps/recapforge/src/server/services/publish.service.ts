import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { assertCampaignOwner } from '../guards';
import { renderDownload } from './recap.service';
import { sshPublish } from '@/lib/ssh-publish';

type PublishConfig = { host: string; user: string; urlBase: string };

function readConfig(raw: unknown): PublishConfig | null {
  if (raw && typeof raw === 'object' && 'host' in raw && 'user' in raw && 'urlBase' in raw) return raw as PublishConfig;
  return null;
}

export async function publishRecap(
  prisma: PrismaClient,
  userId: string,
  input: { campaignId: string; sessionId: string },
): Promise<{ url: string }> {
  await assertCampaignOwner(prisma, input.campaignId, userId);

  const campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId }, select: { publishConfig: true } });
  const config = readConfig(campaign?.publishConfig);
  if (!config) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This campaign has no wiki configured.' });

  const session = await prisma.gameSession.findFirst({
    where: { id: input.sessionId, campaignId: input.campaignId },
    select: { sessionNumber: true },
  });
  if (!session) throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found in this campaign.' });
  const n = session.sessionNumber ?? 1;

  const privateKey = process.env.RECAP_PUBLISH_SSH_KEY;
  if (!privateKey) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Publishing is not configured on the server.' });

  const { html } = await renderDownload(prisma, userId, input);
  const url = `${config.urlBase}/session-${n}`;

  try {
    await sshPublish({ host: config.host, user: config.user, sessionNumber: n, html, privateKey, knownHosts: process.env.RECAP_PUBLISH_KNOWN_HOSTS });
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'publish failed';
    await prisma.forgeRecap.updateMany({
      where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
      data: { publishError: reason.slice(0, 500) },
    });
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Could not publish: ${reason}` });
  }

  await prisma.forgeRecap.updateMany({
    where: { sessionId: input.sessionId, session: { campaignId: input.campaignId } },
    data: { publishedAt: new Date(), publishedUrl: url, publishError: null },
  });
  return { url };
}
