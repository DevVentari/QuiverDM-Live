import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkImageGenerationLimit } from '../services/usage-tracking.service';
import { addImageGenerationJob } from '@/lib/queue/image-generation-queue';
import { NotFoundError } from '../errors';
import { TRPCError } from '@trpc/server';

const PROMPT_TEMPLATES: Record<string, string> = {
  npc: 'Fantasy character portrait, detailed face, dramatic lighting, oil painting style, D&D 5e aesthetic',
  location: 'Fantasy environment concept art, wide establishing shot, atmospheric lighting, detailed architecture',
  handout: 'Aged parchment document, fantasy script, decorative border, sepia tones, prop design',
  item: 'Fantasy item product shot, magical glow, dark background, detailed textures, treasure art style',
  creature: 'Monster illustration, full body, dramatic pose, dark fantasy style, detailed anatomy',
  spell: 'Magical spell effect, ethereal energy, colorful particle effects, dynamic composition',
};

export const homebrewImageRouter = router({
  /**
   * Queue an image generation job for a homebrew item
   */
  generateImage: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        prompt: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const homebrew = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
        select: { userId: true, type: true, name: true, data: true },
      });
      if (!homebrew) throw new NotFoundError('homebrew content', input.homebrewId);
      if (homebrew.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not own this content' });
      }

      // Check tier limits
      const { allowed, remaining, limit } = await checkImageGenerationLimit(userId);
      if (!allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Image generation limit reached (${limit}/month). Upgrade your plan for more.`,
        });
      }

      // Create DB job record
      const homebrewData = homebrew.data as Record<string, unknown>;
      const description = homebrewData?.description as string | undefined;
      const imagePromptHint = homebrewData?.imagePromptHint as string | undefined;
      const job = await prisma.imageGenerationJob.create({
        data: {
          homebrewId: input.homebrewId,
          userId,
          prompt: input.prompt || PROMPT_TEMPLATES[homebrew.type] || '',
          provider: 'auto',
          status: 'queued',
        },
      });

      await prisma.homebrewContent.update({
        where: { id: input.homebrewId },
        data: { imageJobId: job.id },
      });

      // Enqueue BullMQ job
      await addImageGenerationJob({
        jobId: job.id,
        homebrewId: input.homebrewId,
        userId,
        type: homebrew.type,
        name: homebrew.name,
        description,
        imagePromptHint,
        customPrompt: input.prompt,
      });

      return { jobId: job.id, remaining: remaining - 1, limit };
    }),

  generateForNpc: protectedProcedure
    .input(
      z.object({
        npcId: z.string(),
        prompt: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const npc = await prisma.nPC.findUnique({
        where: { id: input.npcId },
        include: { campaign: { select: { userId: true } } },
      });
      if (!npc) throw new NotFoundError('npc', input.npcId);

      const member = await prisma.campaignMember.findFirst({
        where: { campaignId: npc.campaignId, userId, role: { in: ['OWNER', 'CO_DM'] } },
      });
      if (!member && npc.campaign.userId !== userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only DMs can generate NPC images' });
      }

      const { allowed, remaining, limit } = await checkImageGenerationLimit(userId);
      if (!allowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Image generation limit reached (${limit}/month).`,
        });
      }

      const finalPrompt = input.prompt || PROMPT_TEMPLATES.npc;
      const job = await prisma.imageGenerationJob.create({
        data: {
          npcId: input.npcId,
          userId,
          prompt: finalPrompt,
          provider: 'auto',
          status: 'queued',
        },
      });

      await addImageGenerationJob({
        jobId: job.id,
        npcId: input.npcId,
        userId,
        type: 'npc',
        name: npc.name,
        description: npc.description ?? undefined,
        imagePromptHint: finalPrompt,
        customPrompt: input.prompt,
      });

      await prisma.nPC.update({
        where: { id: npc.id },
        data: { imageJobId: job.id },
      });

      return { jobId: job.id, remaining: remaining - 1, limit };
    }),

  /**
   * Poll job status for progress display
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await prisma.imageGenerationJob.findUnique({
        where: { id: input.jobId },
        select: {
          id: true,
          userId: true,
          status: true,
          progress: true,
          resultUrl: true,
          errorMessage: true,
          provider: true,
          createdAt: true,
          completedAt: true,
        },
      });
      if (!job) throw new NotFoundError('generation job', input.jobId);
      if (job.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this job' });
      }
      const { userId: _, ...safeJob } = job;
      return safeJob;
    }),

  /**
   * Get remaining generation quota for current user
   */
  getQuota: protectedProcedure.query(({ ctx }) => checkImageGenerationLimit(ctx.session.user.id)),
});
