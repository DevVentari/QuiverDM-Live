/**
 * Session Service
 * Business logic for session operations.
 */

import { TRPCError } from '@trpc/server';
import { randomBytes } from 'crypto';
import { addAiSummaryJob } from '@/lib/queue/ai-summary-queue';
import { sessionRepository } from '../repositories/session.repository';
import { authz } from './authorization.service';
import { prisma } from '../db';
import { generateWithOllama } from '@/lib/ai/ollama';
import { BadRequestError, NotFoundError } from '../errors';
import { webhookService } from './webhook.service';
import { usageService } from './usage.service';

export class SessionService {
  async getById(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('session', sessionId);
    }

    const member = await prisma.campaignMember.findFirst({
      where: { campaignId: session.campaign.id, userId },
      select: { role: true },
    });

    const isDM = member?.role === 'OWNER' || member?.role === 'CO_DM';
    if (isDM) return session;

    const visibility =
      (session.playerVisibility as 'dm-only' | 'summary-only' | 'public' | null) ??
      'dm-only';

    if (visibility === 'dm-only') {
      return {
        id: session.id,
        title: session.title,
        sessionNumber: session.sessionNumber,
        date: session.date,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        status: session.status,
        playerVisibility: visibility,
        recordings: [],
        transcripts: [],
        aiSummary: null,
        aiHighlights: null,
        quickNotes: null,
        recap: null,
      };
    }

    if (visibility === 'summary-only') {
      return {
        ...session,
        transcripts: [],
        recordings: [],
        quickNotes: null,
      };
    }

    return { ...session, quickNotes: null };
  }

  async getByCampaignId(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    return sessionRepository.findByCampaignId(campaignId);
  }

  async getActiveByCampaignId(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    return sessionRepository.findActiveByCampaignId(campaignId);
  }

  async create(
    campaignId: string,
    userId: string,
    input: {
      title?: string;
      quickNotes?: string;
      status?: 'planning' | 'in_progress';
      prepStrongStart?: string;
      prepSceneOutline?: unknown;
      prepSecrets?: unknown;
      prepLocations?: unknown;
      prepNpcs?: unknown;
      prepEncounters?: unknown;
      prepRewards?: unknown;
      prepSessionArc?: string;
    }
  ) {
    await authz
      .campaign(campaignId, userId)
      .requirePermission('canManageSessions');

    const sessionNumber = await sessionRepository.getNextSessionNumber(
      campaignId
    );

    const title = input.title || `Session ${sessionNumber}`;
    const status = input.status ?? 'in_progress';

    const session = await sessionRepository.create({
      campaignId,
      title,
      sessionNumber,
      quickNotes: input.quickNotes,
      status,
      prepStrongStart: input.prepStrongStart,
      prepSceneOutline: input.prepSceneOutline as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepSecrets: input.prepSecrets as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepLocations: input.prepLocations as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepNpcs: input.prepNpcs as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepEncounters: input.prepEncounters as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepRewards: input.prepRewards as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepSessionArc: input.prepSessionArc,
    });

    if (status === 'in_progress') {
      void webhookService.dispatch(campaignId, 'session.started', {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        title: session.title,
      });
    }

    return session;
  }

  async updatePrep(
    sessionId: string,
    userId: string,
    input: {
      prepStrongStart?: string;
      prepSceneOutline?: unknown;
      prepSecrets?: unknown;
      prepLocations?: unknown;
      prepNpcs?: unknown;
      prepEncounters?: unknown;
      prepRewards?: unknown;
      prepSessionArc?: string;
    }
  ) {
    await authz.session(sessionId, userId).requireManage();
    return sessionRepository.update(sessionId, {
      prepStrongStart: input.prepStrongStart,
      prepSceneOutline: input.prepSceneOutline as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepSecrets: input.prepSecrets as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepLocations: input.prepLocations as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepNpcs: input.prepNpcs as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepEncounters: input.prepEncounters as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepRewards: input.prepRewards as import('@prisma/client').Prisma.InputJsonValue | undefined,
      prepSessionArc: input.prepSessionArc,
    });
  }

  async startSession(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();
    const session = await sessionRepository.update(sessionId, { status: 'in_progress' });
    void webhookService.dispatch(session.campaignId, 'session.started', {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
    });
    return session;
  }

  async update(
    sessionId: string,
    userId: string,
    input: {
      title?: string;
      quickNotes?: string;
      recap?: string;
      status?: 'planning' | 'in_progress' | 'completed';
    }
  ) {
    await authz.session(sessionId, userId).requireManage();
    const session = await sessionRepository.update(sessionId, input);

    if (input.status === 'completed') {
      void webhookService.dispatch(session.campaignId, 'session.ended', {
        sessionId: session.id,
        sessionNumber: session.sessionNumber,
        title: session.title,
      });
    }

    return session;
  }

  async complete(
    sessionId: string,
    userId: string,
    input: { recap?: string }
  ) {
    await authz.session(sessionId, userId).requireManage();
    const session = await sessionRepository.update(sessionId, {
      status: 'completed',
      recap: input.recap,
    });

    void webhookService.dispatch(session.campaignId, 'session.ended', {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      title: session.title,
    });

    return session;
  }

  async delete(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();
    await sessionRepository.remove(sessionId);
    return { success: true };
  }

  async generateSummary(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();

    const canRecap = await usageService.canGenerateRecap(userId);
    if (!canRecap) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'AI recap limit reached for your tier. Upgrade to Pro for more recaps.',
      });
    }

    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError('session', sessionId);
    }

    const transcriptText = session.transcripts
      .map((t) => t.correctedText || t.rawText)
      .filter((text): text is string => Boolean(text))
      .join('\n\n---\n\n');

    if (!transcriptText.trim()) {
      throw new BadRequestError('No transcript available to summarize');
    }

    await usageService.incrementAiRecaps(userId);

    await sessionRepository.updateSummaryStatus(sessionId, {
      aiSummaryStatus: 'pending',
      aiSummaryError: null,
    });

    await addAiSummaryJob({
      jobId: sessionId,
      sessionId,
      userId,
      transcriptText,
      sessionTitle: session.title || `Session ${session.sessionNumber}`,
      sessionNumber: session.sessionNumber,
    });

    return { status: 'pending' as const };
  }

  async getSummaryStatus(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        aiSummaryStatus: true,
        aiSummary: true,
        aiHighlights: true,
        aiSummaryError: true,
        aiSummaryAt: true,
        shareToken: true,
      },
    });

    if (!session) {
      throw new NotFoundError('session', sessionId);
    }
    return session;
  }

  async createShareToken(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();
    const token = randomBytes(16).toString('hex');
    await sessionRepository.setShareToken(sessionId, token);
    return { shareToken: token };
  }

  async getByShareToken(shareToken: string) {
    const session = await sessionRepository.findByShareToken(shareToken);
    if (!session) {
      throw new NotFoundError('session share', shareToken);
    }

    return {
      id: session.id,
      title: session.title,
      sessionNumber: session.sessionNumber,
      date: session.date,
      campaignName: session.campaign.name,
      aiSummary: session.aiSummary,
      aiHighlights: session.aiHighlights,
    };
  }

  async getSessionsWithSummaries(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    return sessionRepository.findByCampaignIdWithSummaries(campaignId);
  }

  /**
   * Generate an AI recap from session transcripts.
   * Requires DM-level access on the session's campaign.
   */
  async generateRecap(sessionId: string, userId: string): Promise<string> {
    // Verify user has manage permission on the session
    await authz.session(sessionId, userId).requireManage();

    // Fetch the session to ensure it exists
    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError('session', sessionId);
    }

    // Fetch all transcripts for this session
    const transcripts = await prisma.transcript.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        correctedText: true,
        rawText: true,
      },
    });

    // Concatenate transcript text (prefer correctedText, fall back to rawText)
    const transcriptText = transcripts
      .map((t) => t.correctedText || t.rawText)
      .filter(Boolean)
      .join('\n\n');

    if (!transcriptText.trim()) {
      throw new BadRequestError('No transcript text available for recap generation');
    }

    // Generate recap with AI
    const prompt = `You are a D&D session recap writer. Summarize this session transcript into a narrative recap suitable for players. Include key events, NPC interactions, combat outcomes, and important decisions. Keep it concise (2-4 paragraphs).\n\nTranscript:\n${transcriptText}`;

    const recap = await generateWithOllama(prompt, {
      temperature: 0.7,
    });

    // Save recap to the session record
    await sessionRepository.update(sessionId, { recap });

    void webhookService.dispatch(session.campaignId, 'summary.ready', {
      sessionId,
      summaryLength: recap.length,
    });

    return recap;
  }
}

export const sessionService = new SessionService();
