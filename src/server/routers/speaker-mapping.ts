// src/server/routers/speaker-mapping.ts
import { router } from '../trpc';
import { campaignDMProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '../errors';
import {
  applyMappingsToTranscriptData,
  type SpeakerEntry,
  type TimestampEntry,
} from '@/lib/recap/speaker-mapping-utils';

export const speakerMappingRouter = router({
  getByCampaign: campaignDMProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input }) => {
      return prisma.speakerMapping.findMany({
        where: { campaignId: input.campaignId },
        orderBy: { speakerLabel: 'asc' },
      });
    }),

  upsert: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        speakerLabel: z.string().min(1).max(100),
        characterId: z.string().optional(),
        characterName: z.string().min(1).max(100),
        isDM: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.speakerMapping.upsert({
        where: {
          campaignId_speakerLabel: {
            campaignId: input.campaignId,
            speakerLabel: input.speakerLabel,
          },
        },
        create: {
          campaignId: input.campaignId,
          speakerLabel: input.speakerLabel,
          characterId: input.characterId ?? null,
          characterName: input.characterName,
          isDM: input.isDM,
        },
        update: {
          characterId: input.characterId ?? null,
          characterName: input.characterName,
          isDM: input.isDM,
        },
      });
    }),

  applyToTranscript: campaignDMProcedure
    .input(
      z.object({
        campaignId: z.string(),
        transcriptId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Security: verify the transcript belongs to a session in this campaign
      const transcript = await prisma.transcript.findFirst({
        where: {
          id: input.transcriptId,
          session: { campaignId: input.campaignId },
        },
        select: { id: true, speakers: true, timestamps: true },
      });

      if (!transcript) {
        throw new NotFoundError('transcript', input.transcriptId);
      }

      // No speakers/timestamps to patch
      if (!Array.isArray(transcript.speakers) || !Array.isArray(transcript.timestamps)) {
        return { updated: false };
      }

      const mappingRows = await prisma.speakerMapping.findMany({
        where: { campaignId: input.campaignId },
        select: { speakerLabel: true, characterName: true },
      });

      const lookup = new Map(mappingRows.map((m) => [m.speakerLabel, m.characterName]));

      const { speakers, timestamps } = applyMappingsToTranscriptData(
        transcript.speakers as SpeakerEntry[],
        transcript.timestamps as TimestampEntry[],
        lookup
      );

      await prisma.transcript.update({
        where: { id: input.transcriptId },
        data: { speakers, timestamps },
      });

      return { updated: true };
    }),
});
