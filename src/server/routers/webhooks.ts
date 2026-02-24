import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { authz } from '../services/authorization.service';
import {
  WEBHOOK_EVENTS,
  webhookService,
} from '../services/webhook.service';

const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);
const MAX_WEBHOOKS_PER_CAMPAIGN = 10;

export const webhooksRouter = router({
  list: protectedProcedure
    .input(z.object({ campaignId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await authz
        .campaign(input.campaignId, ctx.session.user.id)
        .requirePermission('canManageSessions');

      return webhookService.list(input.campaignId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        url: z.string().url().refine((value) => value.startsWith('https://'), {
          message: 'Webhook URL must use HTTPS',
        }),
        events: z.array(WebhookEventSchema).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await authz
        .campaign(input.campaignId, ctx.session.user.id)
        .requirePermission('canManageSessions');

      const existing = await webhookService.list(input.campaignId);
      if (existing.length >= MAX_WEBHOOKS_PER_CAMPAIGN) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A campaign can have at most ${MAX_WEBHOOKS_PER_CAMPAIGN} webhooks`,
        });
      }

      return webhookService.create(input.campaignId, {
        url: input.url,
        events: input.events,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ endpointId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const endpoint = await webhookService.getById(input.endpointId);
      if (!endpoint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Endpoint not found' });
      }

      await authz
        .campaign(endpoint.campaignId, ctx.session.user.id)
        .requirePermission('canManageSessions');

      return webhookService.delete(input.endpointId);
    }),

  testPing: protectedProcedure
    .input(z.object({ endpointId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const endpoint = await webhookService.getById(input.endpointId);
      if (!endpoint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Endpoint not found' });
      }

      await authz
        .campaign(endpoint.campaignId, ctx.session.user.id)
        .requirePermission('canManageSessions');

      return webhookService.sendTestPing(input.endpointId);
    }),
});
