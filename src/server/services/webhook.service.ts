import { randomBytes } from 'crypto';
import { prisma } from '../db';
import { addWebhookJob } from '@/lib/queue/webhooks-queue';

export const WEBHOOK_EVENTS = [
  'session.started',
  'session.ended',
  'summary.ready',
  'encounter.logged',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class WebhookService {
  /**
   * Dispatch a webhook event to all active endpoints for a campaign.
   * Fire-and-forget and never throws to caller.
   */
  async dispatch(
    campaignId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { campaignId, active: true },
      });

      for (const endpoint of endpoints) {
        const events = Array.isArray(endpoint.events)
          ? endpoint.events
          : [];
        if (!events.includes(event)) {
          continue;
        }

        addWebhookJob({
          endpointId: endpoint.id,
          url: endpoint.url,
          secret: endpoint.secret,
          event,
          payload,
        }).catch((error) => {
          console.error(
            `[WebhookService] Failed to enqueue for endpoint ${endpoint.id}:`,
            error
          );
        });
      }
    } catch (error) {
      console.error('[WebhookService] Failed to dispatch webhook event:', error);
    }
  }

  async create(
    campaignId: string,
    data: { url: string; events: WebhookEvent[] }
  ) {
    const secret = randomBytes(32).toString('hex');
    return prisma.webhookEndpoint.create({
      data: {
        campaignId,
        url: data.url,
        secret,
        events: data.events,
        active: true,
      },
      select: {
        id: true,
        campaignId: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async list(campaignId: string) {
    return prisma.webhookEndpoint.findMany({
      where: { campaignId },
      select: {
        id: true,
        campaignId: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(endpointId: string) {
    return prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: {
        id: true,
        campaignId: true,
        url: true,
        secret: true,
        events: true,
        active: true,
      },
    });
  }

  async delete(endpointId: string) {
    return prisma.webhookEndpoint.delete({
      where: { id: endpointId },
      select: { id: true },
    });
  }

  async sendTestPing(endpointId: string) {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });
    if (!endpoint) {
      throw new Error('Endpoint not found');
    }

    await addWebhookJob({
      endpointId: endpoint.id,
      url: endpoint.url,
      secret: endpoint.secret,
      event: 'ping',
      payload: { message: 'Test ping from QuiverDM' },
    });

    return { queued: true };
  }
}

export const webhookService = new WebhookService();

