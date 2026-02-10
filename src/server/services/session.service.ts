/**
 * Session Service
 * Business logic for session operations.
 */

import { TRPCError } from '@trpc/server';
import { sessionRepository } from '../repositories/session.repository';
import { authz } from './authorization.service';

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

    return sessionRepository.create({
      campaignId,
      title,
      sessionNumber,
      quickNotes: input.quickNotes,
      status: 'in_progress',
    });
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
    return sessionRepository.update(sessionId, input);
  }

  async complete(
    sessionId: string,
    userId: string,
    input: { recap?: string }
  ) {
    await authz.session(sessionId, userId).requireManage();
    return sessionRepository.update(sessionId, {
      status: 'completed',
      recap: input.recap,
    });
  }

  async delete(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();
    await sessionRepository.remove(sessionId);
    return { success: true };
  }
}

export const sessionService = new SessionService();
