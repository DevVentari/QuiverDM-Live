/**
 * Campaigns Router
 *
 * Thin wrapper around CampaignService for campaign CRUD operations.
 * All business logic lives in the service layer.
 */

import { router, protectedProcedure, campaignOwnerProcedure, campaignMemberProcedure, campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { campaignService } from '../services/campaign.service';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { serverTrack } from '@/lib/analytics.server';
import { EVENTS } from '@/lib/analytics-events';
import { extractEntitiesFromMarkdown } from '../services/markdown-extraction.service';
import { parseJsonFile, buildPreview } from '../services/json-import.service';
import { brainRepository } from '../repositories/brain.repository';
import { emptyPrepData } from '@/lib/prep-types';

// =============================================================================
// Input Schemas
// =============================================================================

const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  settings: z.object({
    gameSystem: z.string().optional(),
    settingName: z.string().optional(),
    playerCount: z.number().min(1).max(20).optional(),
    startingLevel: z.number().min(1).max(20).optional(),
    schedule: z.object({
      day: z.string().optional(),
      time: z.string().optional(),
      frequency: z.string().optional(),
    }).optional(),
    houseRules: z.string().optional(),
    themes: z.array(z.string()).optional(),
  }).optional(),
  players: z.array(
    z.object({
      name: z.string().max(100),
      characterName: z.string().max(100),
    }).refine(
      (r) => r.name.trim() !== '' || r.characterName.trim() !== '',
      { message: 'Player row must have at least a name or character name' }
    )
  ).optional(),
});

const UpdateCampaignSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Campaign name is required').optional(),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'archived']).optional(),
  glossary: z.record(z.string()).optional(),
});

// =============================================================================
// Router
// =============================================================================

export const campaignsRouter = router({
  /**
   * Get all campaigns where user is a member (any role)
   */
  getAll: protectedProcedure.query(({ ctx }) =>
    campaignService.getAll(ctx.session.user.id)
  ),

  /**
   * Get single campaign by ID (with membership verification)
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getById(input.id, ctx.session.user.id)
    ),

  /**
   * Get single campaign by slug (with membership verification)
   */
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getBySlug(input.slug, ctx.session.user.id)
    ),

  /**
   * Create new campaign for authenticated user
   */
  create: protectedProcedure
    .input(CreateCampaignSchema)
    .mutation(async ({ input, ctx }) => {
      const campaign = await campaignService.create(ctx.session.user.id, input);
      void serverTrack(ctx.session.user.id, EVENTS.CAMPAIGN_CREATED, { campaign_id: campaign.id });
      // Always create Session 0 so the hero card shows on the sessions page.
      // If a DDB sourcebook is later linked, its prep gets upgraded to sourcebook-seeded.
      // Awaited (not fire-and-forget): linkSourcebookToCampaign only enqueues the
      // seed job when a sessionNumber:0 session already exists, so the client's
      // follow-up link call would race a void insert and silently skip seeding.
      await prisma.gameSession.create({
        data: {
          campaignId: campaign.id,
          title: 'Session 0',
          sessionNumber: 0,
          status: 'planning',
          prepData: emptyPrepData() as unknown as Prisma.InputJsonValue,
          prepStatus: 'complete',
        },
      });
      return campaign;
    }),

  /**
   * Update campaign (requires owner access)
   */
  update: protectedProcedure
    .input(UpdateCampaignSchema)
    .mutation(({ input, ctx }) => {
      const { id, ...data } = input;
      return campaignService.update(id, ctx.session.user.id, data);
    }),

  /**
   * Delete campaign (requires owner access)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input, ctx }) =>
      campaignService.delete(input.id, ctx.session.user.id)
    ),

  /**
   * Get campaign stats
   */
  getStats: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(({ input, ctx }) =>
      campaignService.getStats(input.campaignId, ctx.session.user.id)
    ),

  /**
   * Get all campaigns for dashboard (optimized query)
   */
  getMyMemberships: protectedProcedure.query(({ ctx }) =>
    campaignService.getDashboardCampaigns(ctx.session.user.id)
  ),

  /**
   * Get the user's active campaign (persisted in UserSettings, with
   * auto-derive fallback). Returns null when the user has no campaigns.
   */
  getActive: protectedProcedure.query(({ ctx }) =>
    campaignService.getActiveCampaign(ctx.session.user.id)
  ),

  /**
   * Get pending campaign invites for current user
   */
  getPendingInvites: protectedProcedure.query(({ ctx }) =>
    campaignService.getPendingInvites(ctx.session.user.email)
  ),

  /**
   * Accept a campaign invite
   */
  acceptInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) =>
      campaignService.acceptInvite(
        input.inviteId,
        ctx.session.user.id,
        ctx.session.user.email
      )
    ),

  /**
   * Decline a campaign invite
   */
  declineInvite: protectedProcedure
    .input(z.object({ inviteId: z.string() }))
    .mutation(({ ctx, input }) =>
      campaignService.declineInvite(input.inviteId, ctx.session.user.email)
    ),

  getDdbCampaignUrl: campaignMemberProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { dndBeyondCampaignUrl: true },
      });
      return { url: campaign?.dndBeyondCampaignUrl ?? null };
    }),

  setDdbCampaignUrl: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      url: z.string().regex(/dndbeyond\.com\/campaigns\/\d+/).nullable(),
    }))
    .mutation(async ({ input }) => {
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: { dndBeyondCampaignUrl: input.url },
      });
      return { url: input.url };
    }),

  /**
   * Update campaign settings JSON (sourcebook, discordWebhookUrl, etc.)
   */
  updateSettings: campaignOwnerProcedure
    .input(z.object({
      campaignId: z.string(),
      sourcebook: z.string().optional(),
      discordWebhookUrl: z.string().optional(),
      foundryUrl: z.string().url().optional().or(z.literal('')),
    }))
    .mutation(async ({ input }) => {
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { settings: true },
      });
      const current = (campaign?.settings ?? {}) as Record<string, unknown>;
      await prisma.campaign.update({
        where: { id: input.campaignId },
        data: {
          settings: {
            ...current,
            ...(input.sourcebook !== undefined && { sourcebook: input.sourcebook }),
            ...(input.discordWebhookUrl !== undefined && { discordWebhookUrl: input.discordWebhookUrl }),
            ...(input.foundryUrl !== undefined && { foundryUrl: input.foundryUrl || null }),
          },
        },
      });
    }),

  seedFromWorldSourcebook: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      sourceSlug: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const target = await prisma.campaign.findFirst({
        where: { id: input.campaignId, members: { some: { userId, role: { in: ['OWNER', 'CO_DM'] } } } },
      });
      if (!target) throw new Error('Campaign not found or insufficient permissions');

      const source = await prisma.campaign.findUnique({
        where: { slug: input.sourceSlug },
        include: {
          npcs: true,
          documents: true,
          homebrewContent: { include: { homebrew: true } },
        },
      });
      if (!source) throw new Error(`World sourcebook "${input.sourceSlug}" not found`);

      // Copy campaign documents (lore, factions, locations, timelines)
      for (const doc of source.documents) {
        const existing = await prisma.campaignDocument.findUnique({
          where: { campaignId_slug: { campaignId: target.id, slug: doc.slug } },
        });
        if (existing) continue;
        await prisma.campaignDocument.create({
          data: {
            campaignId: target.id,
            title: doc.title,
            slug: doc.slug,
            type: doc.type,
            content: doc.content,
            data: doc.data ?? undefined,
            tags: doc.tags,
            sourceFile: doc.sourceFile ?? undefined,
            searchText: doc.searchText,
            brainIngestStatus: 'none',
          },
        });
      }

      // Copy NPCs
      for (const npc of source.npcs) {
        const existing = await prisma.nPC.findFirst({
          where: { campaignId: target.id, name: npc.name },
        });
        if (existing) continue;
        await prisma.nPC.create({
          data: {
            campaignId: target.id,
            name: npc.name,
            description: npc.description ?? undefined,
            role: npc.role ?? undefined,
            stats: npc.stats ?? undefined,
            tags: npc.tags,
          },
        });
      }

      // Clone homebrew content (items, creatures, races) to the importing user
      let homebrewCount = 0;
      for (const link of source.homebrewContent) {
        const hb = link.homebrew;
        let targetHb = await prisma.homebrewContent.findFirst({
          where: { userId, name: hb.name, type: hb.type },
        });
        if (!targetHb) {
          targetHb = await prisma.homebrewContent.create({
            data: {
              userId,
              type: hb.type,
              name: hb.name,
              data: hb.data ?? Prisma.JsonNull,
              tags: hb.tags,
              searchText: hb.searchText,
              sourceType: 'manual',
            },
          });
          homebrewCount++;
        }
        await prisma.campaignHomebrewContent.upsert({
          where: { campaignId_homebrewId: { campaignId: target.id, homebrewId: targetHb.id } },
          update: {},
          create: { campaignId: target.id, homebrewId: targetHb.id },
        });
      }

      return {
        docCount: source.documents.length,
        npcCount: source.npcs.length,
        homebrewCount,
      };
    }),

  getWorldDocuments: campaignDMProcedure
    .query(async ({ input }) => {
      return prisma.campaignDocument.findMany({
        where: { campaignId: input.campaignId },
        orderBy: [{ type: 'asc' }, { title: 'asc' }],
        select: { id: true, title: true, slug: true, type: true, content: true, tags: true },
      });
    }),

  regenerateBanner: campaignDMProcedure
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Visual asset regeneration is dev-only');
      }
      const { enqueueVisualAsset } = await import('@/lib/queue/visual-asset-queue');
      const campaign = await prisma.campaign.findUnique({
        where: { id: input.campaignId },
        select: { description: true },
      });
      await enqueueVisualAsset({
        kind: 'campaign-banner',
        campaignId: input.campaignId,
        userId: ctx.session.user.id,
        promptHint: campaign?.description ?? undefined,
      });
      return { queued: true };
    }),

  regenerateEmblem: campaignDMProcedure
    .mutation(async ({ ctx, input }) => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Visual asset regeneration is dev-only');
      }
      const { enqueueVisualAsset } = await import('@/lib/queue/visual-asset-queue');
      await enqueueVisualAsset({
        kind: 'campaign-emblem',
        campaignId: input.campaignId,
        userId: ctx.session.user.id,
      });
      return { queued: true };
    }),

  getWorldHomebrew: campaignDMProcedure
    .query(async ({ input }) => {
      const links = await prisma.campaignHomebrewContent.findMany({
        where: { campaignId: input.campaignId },
        include: {
          homebrew: {
            select: { id: true, name: true, type: true, data: true, tags: true, imageUrl: true, ddbChapterId: true },
          },
        },
        orderBy: { homebrew: { name: 'asc' } },
      });
      return links.map((l) => l.homebrew);
    }),

  importFromMarkdown: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      content: z.string().max(55_000),
      hint: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return extractEntitiesFromMarkdown({
        content: input.content,
        hint: input.hint,
      });
    }),

  confirmImport: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      entities: z.array(z.object({
        type: z.enum(['location', 'npc', 'item', 'creature', 'faction', 'lore', 'timeline', 'spell', 'race']),
        name: z.string(),
        description: z.string().optional(),
        data: z.record(z.unknown()).optional(),
        tags: z.array(z.string()).optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const { campaignId, entities } = input;
      const userId = ctx.session.user.id;

      const saved = await prisma.$transaction(async (tx) => {
        let count = 0;

        for (const entity of entities) {
          const tags = entity.tags ?? [];
          const data = entity.data ?? {};

          if (entity.type === 'npc') {
            await tx.nPC.create({
              data: {
                campaignId,
                name: entity.name,
                description: entity.description ?? null,
                role: (data.role as string) ?? null,
                tags,
              },
            });
            count++;
            continue;
          }

          if (['location', 'faction', 'lore', 'timeline'].includes(entity.type)) {
            const slug = entity.name
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
              || entity.name.toLowerCase().replace(/\s+/g, '-').slice(0, 40);

            const existing = await tx.campaignDocument.findUnique({
              where: { campaignId_slug: { campaignId, slug } },
            });
            if (!existing) {
              await tx.campaignDocument.create({
                data: {
                  campaignId,
                  title: entity.name,
                  slug,
                  type: entity.type,
                  content: entity.description ?? '',
                  tags,
                  searchText: [entity.name, ...tags, entity.description ?? ''].join(' '),
                  brainIngestStatus: 'none',
                },
              });
              count++;
            }
            continue;
          }

          // item, creature, spell, race → HomebrewContent linked to campaign
          let hb = await tx.homebrewContent.findFirst({
            where: { userId, name: entity.name, type: entity.type },
          });
          if (!hb) {
            hb = await tx.homebrewContent.create({
              data: {
                userId,
                type: entity.type,
                name: entity.name,
                data: { description: entity.description ?? '', ...data },
                tags,
                searchText: [entity.name, ...tags, entity.description ?? ''].join(' '),
                sourceType: 'manual',
              },
            });
          }
          await tx.campaignHomebrewContent.upsert({
            where: { campaignId_homebrewId: { campaignId, homebrewId: hb.id } },
            update: {},
            create: { campaignId, homebrewId: hb.id },
          });
          count++;
        }

        return count;
      });

      return { saved };
    }),

  importFromJson: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      files: z.array(z.object({
        filename: z.string(),
        content: z.string().max(250_000),
      })).max(50),
    }))
    .mutation(async ({ input }) => {
      const previews = buildPreview(input.files);
      return { previews };
    }),

  confirmJsonImport: campaignDMProcedure
    .input(z.object({
      campaignId: z.string(),
      files: z.array(z.object({
        filename: z.string(),
        content: z.string().max(250_000),
      })).max(50),
      selectedSlugs: z.array(z.string()).max(50),
    }))
    .mutation(async ({ input, ctx }) => {
      const { campaignId, files, selectedSlugs } = input;
      const userId = ctx.session.user.id;
      const slugSet = new Set(selectedSlugs);

      let docsCreated = 0;
      let entitiesCreated = 0;
      let homebrewCreated = 0;
      let jobsQueued = 0;

      const { addBrainIngestionJob } = await import('@/lib/queue/brain-ingestion-queue');

      for (const file of files) {
        const parsed = parseJsonFile(file.filename, file.content);
        if (!parsed || !slugSet.has(parsed.document.slug)) continue;

        // Atomic Prisma writes for this file
        await prisma.$transaction(async (tx) => {
          // 1 — CampaignDocument (upsert by slug)
          await tx.campaignDocument.upsert({
            where: { campaignId_slug: { campaignId, slug: parsed.document.slug } },
            create: {
              campaignId,
              title: parsed.document.title,
              slug: parsed.document.slug,
              type: parsed.document.type,
              content: parsed.document.content,
              data: parsed.document.data as Prisma.InputJsonValue,
              tags: parsed.document.tags,
              sourceFile: parsed.document.sourceFile,
              searchText: parsed.document.searchText,
              brainIngestStatus: 'pending',
            },
            update: {
              title: parsed.document.title,
              content: parsed.document.content,
              data: parsed.document.data as Prisma.InputJsonValue,
              tags: parsed.document.tags,
              brainIngestStatus: 'pending',
            },
          });

          // 2 — NPC records
          for (const npc of parsed.npcs) {
            const existingNpc = await tx.nPC.findFirst({
              where: { campaignId, name: npc.name },
            });
            if (!existingNpc) {
              await tx.nPC.create({
                data: {
                  campaignId,
                  name: npc.name,
                  description: npc.description ?? undefined,
                  role: npc.role ?? undefined,
                  stats: npc.stats as Prisma.InputJsonValue,
                  tags: npc.tags,
                },
              });
              entitiesCreated++;
            }
          }

          // 3 — Homebrew records (item, creature, race)
          for (const hb of parsed.homebrew) {
            let existing = await tx.homebrewContent.findFirst({
              where: { userId, name: hb.name, type: hb.type },
            });
            if (!existing) {
              existing = await tx.homebrewContent.create({
                data: {
                  userId,
                  type: hb.type,
                  name: hb.name,
                  data: hb.data as Prisma.InputJsonValue,
                  tags: hb.tags,
                  searchText: hb.searchText,
                  sourceType: 'json_import',
                },
              });
              homebrewCreated++;
            }
            await tx.campaignHomebrewContent.upsert({
              where: { campaignId_homebrewId: { campaignId, homebrewId: existing.id } },
              update: {},
              create: { campaignId, homebrewId: existing.id },
            });
          }
        });
        docsCreated++;

        // 4 — WorldEntity records (Brain) — outside transaction, uses module-level prisma
        for (const entity of parsed.entities) {
          await brainRepository.upsertEntity(campaignId, {
            type: entity.type,
            name: entity.name,
            description: entity.description,
            properties: entity.properties,
            sourceType: 'json_import',
          });
          entitiesCreated++;
        }

        // 5 — Queue brain ingestion job
        const docText = [parsed.document.title, ...parsed.document.tags, parsed.document.content.slice(0, 2000)].join(' ');
        await addBrainIngestionJob({
          sessionId: null,
          campaignId,
          summary: docText,
          source: parsed.document.sourceFile,
        });
        jobsQueued++;
      }

      return { docsCreated, entitiesCreated, homebrewCreated, jobsQueued };
    }),
});
