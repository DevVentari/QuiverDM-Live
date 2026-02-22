/**
 * Session Service
 * Business logic for session operations.
 */

import { TRPCError } from '@trpc/server';
import { sessionRepository } from '../repositories/session.repository';
import { authz } from './authorization.service';
import { prisma } from '../db';
import { generateWithOllama } from '@/lib/ai/ollama';
import { BadRequestError, NotFoundError } from '../errors';
import { webhookService } from './webhook.service';

export class SessionService {
  async getById(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).verify();
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
    }

    return session;
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
    }
  ) {
    await authz
      .campaign(campaignId, userId)
      .requirePermission('canManageSessions');

    const sessionNumber = await sessionRepository.getNextSessionNumber(
      campaignId
    );

    const title = input.title || `Session ${sessionNumber}`;

    const session = await sessionRepository.create({
      campaignId,
      title,
      sessionNumber,
      quickNotes: input.quickNotes,
      status: 'in_progress',
    });

    void webhookService.dispatch(campaignId, 'session.started', {
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
