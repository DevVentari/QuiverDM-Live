import { TRPCError } from '@trpc/server';
import { prisma } from '../db';

/**
 * Verify that a campaign belongs to the specified user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyCampaignOwnership(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
  });

  if (!campaign) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this campaign',
    });
  }

  return campaign;
}

/**
 * Verify that a session belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifySessionOwnership(sessionId: string, userId: string) {
  const session = await prisma.gameSession.findFirst({
    where: {
      id: sessionId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!session) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this session',
    });
  }

  return session;
}

/**
 * Verify that an NPC belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyNPCOwnership(npcId: string, userId: string) {
  const npc = await prisma.nPC.findFirst({
    where: {
      id: npcId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!npc) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this NPC',
    });
  }

  return npc;
}

/**
 * Verify that a player belongs to a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyPlayerOwnership(playerId: string, userId: string) {
  const player = await prisma.player.findFirst({
    where: {
      id: playerId,
      campaign: { userId },
    },
    include: { campaign: true },
  });

  if (!player) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this player',
    });
  }

  return player;
}

/**
 * Verify that a recording belongs to a session in a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyRecordingOwnership(recordingId: string, userId: string) {
  const recording = await prisma.sessionRecording.findFirst({
    where: {
      id: recordingId,
      session: {
        campaign: { userId },
      },
    },
    include: {
      session: { include: { campaign: true } },
    },
  });

  if (!recording) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this recording',
    });
  }

  return recording;
}

/**
 * Verify that homebrew content belongs to the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyHomebrewOwnership(homebrewId: string, userId: string) {
  const homebrew = await prisma.homebrewContent.findFirst({
    where: {
      id: homebrewId,
      userId,
    },
  });

  if (!homebrew) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this homebrew content',
    });
  }

  return homebrew;
}

/**
 * Verify that a PDF belongs to the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyPDFOwnership(pdfId: string, userId: string) {
  const pdf = await prisma.homebrewPDF.findFirst({
    where: {
      id: pdfId,
      userId,
    },
  });

  if (!pdf) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this PDF',
    });
  }

  return pdf;
}

/**
 * Verify that a transcript belongs to a session in a campaign owned by the user
 * @throws TRPCError with code FORBIDDEN if not owned by user
 */
export async function verifyTranscriptOwnership(transcriptId: string, userId: string) {
  const transcript = await prisma.transcript.findFirst({
    where: {
      id: transcriptId,
      session: {
        campaign: { userId },
      },
    },
    include: {
      session: { include: { campaign: true } },
    },
  });

  if (!transcript) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this transcript',
    });
  }

  return transcript;
}
