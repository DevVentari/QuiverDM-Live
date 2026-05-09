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
import { generateWithOllama, isOllamaAvailable } from '@/lib/ai/ollama';
import { BadRequestError, NotFoundError } from '../errors';
import { webhookService } from './webhook.service';
import { usageService } from './usage.service';
import {
  SessionPrepDataSchema,
  emptyPrepData,
  type SessionPrepData,
} from '@/lib/prep-types';
import {
  buildStrongStartPrompt,
  buildScenesPrompt,
  buildSecretsPrompt,
  buildLooseThreadsPrompt,
  buildLooseThreadsFromBrainPrompt,
} from '@/lib/ai/prep-prompts';
import { brainRepository } from '../repositories/brain.repository';
import { WorldEntityStatus } from '@prisma/client';

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
    }
  ) {
    await authz
      .campaign(campaignId, userId)
      .requirePermission('canManageSessions');

    const sessionNumber = await sessionRepository.getNextSessionNumber(campaignId);
    const title = input.title || `Session ${sessionNumber}`;
    const status = input.status ?? 'in_progress';

    const session = await sessionRepository.create({
      campaignId,
      title,
      sessionNumber,
      quickNotes: input.quickNotes,
      status,
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

  /**
   * Create a new planning session for the Lazy DM wizard.
   * Sets status='planning', prepStatus='draft', and initializes empty prepData.
   */
  async createPrepSession(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).requirePermission('canManageSessions');

    const sessionNumber = await sessionRepository.getNextSessionNumber(campaignId);
    const title = `Session ${sessionNumber}`;

    const initialPrep = emptyPrepData();
    initialPrep.lastSavedAt = new Date().toISOString();

    return sessionRepository.create({
      campaignId,
      title,
      sessionNumber,
      status: 'planning',
      prepData: initialPrep as unknown as import('@prisma/client').Prisma.InputJsonValue,
      prepStatus: 'draft',
    });
  }

  /**
   * Save prep data (auto-save from wizard). Sets prepStatus='draft'.
   */
  async updatePrep(
    sessionId: string,
    userId: string,
    prepData: Partial<SessionPrepData>
  ) {
    await authz.session(sessionId, userId).requireManage();

    // Merge with existing data and stamp lastSavedAt
    const existing = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { prepData: true },
    });

    const parsed = existing?.prepData
      ? SessionPrepDataSchema.safeParse(existing.prepData)
      : null;
    const base = parsed?.success ? parsed.data : emptyPrepData();

    const merged: SessionPrepData = {
      ...base,
      ...prepData,
      lastSavedAt: new Date().toISOString(),
    };

    return sessionRepository.updatePrep(sessionId, {
      prepData: merged as unknown as import('@prisma/client').Prisma.InputJsonValue,
      prepStatus: 'draft',
    });
  }

  /**
   * Mark prep as complete. Session stays in 'planning' status until DM starts it.
   */
  async completePrep(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();
    return sessionRepository.updatePrep(sessionId, {
      prepData: (await prisma.gameSession.findUnique({
        where: { id: sessionId },
        select: { prepData: true },
      }))?.prepData as import('@prisma/client').Prisma.InputJsonValue,
      prepStatus: 'complete',
    });
  }

  /**
   * Fetch all context needed for the prep wizard:
   * - Campaign characters with goals
   * - Campaign NPCs
   * - Recent sessions (recaps for loose threads)
   * - Homebrew items for rewards step
   */
  async getContextForPrep(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).requirePermission('canManageSessions');

    const [characters, npcs, recentSessions, homebrewLinks] = await Promise.all([
      prisma.campaignCharacter.findMany({
        where: { campaignId },
        select: {
          character: {
            select: {
              id: true,
              name: true,
              race: true,
              class: true,
              subclass: true,
              level: true,
              background: true,
              portraitUrl: true,
            },
          },
        },
      }),
      prisma.nPC.findMany({
        where: { campaignId },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          name: true,
          role: true,
          description: true,
        },
      }),
      sessionRepository.findRecentByCampaignId(campaignId, 5),
      prisma.homebrewContent.findMany({
        where: {
          campaigns: { some: { campaignId } },
          type: { in: ['item', 'spell'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          type: true,
          data: true,
        },
      }),
    ]);

    const charactersForPrep = characters.map((entry) => entry.character);
    const npcsForPrep = npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      motivation: npc.description,
    }));

    const ctx: {
      characters: typeof charactersForPrep;
      npcs: typeof npcsForPrep;
      recentSessions: typeof recentSessions;
      homebrew: typeof homebrewLinks;
      brainHooks?: Array<{ text: string; urgency: 'low' | 'medium' | 'high' }>;
      brainThreats?: Array<{ name: string; urgency: number }>;
      npcMotivations?: Array<{ name: string; motivation?: string; fear?: string; loyalty?: string }>;
      factionTensions?: Array<{ factionA: string; factionB: string; type: string; strength: number }>;
    } = { characters: charactersForPrep, npcs: npcsForPrep, recentSessions, homebrew: homebrewLinks };

    // Enrich with Brain context if available
    try {
      const [worldState, entities, relationships] = await Promise.all([
        brainRepository.getOrCreateState(campaignId),
        brainRepository.findEntities(campaignId, { status: WorldEntityStatus.active, limit: 50 }),
        brainRepository.findRelationships(campaignId),
      ]);

      const hooks = Array.isArray(worldState.hooks)
        ? (worldState.hooks as Array<{ text: string; urgency: string; status?: string }>)
            .filter(h => h.status !== 'resolved')
            .sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return (order[a.urgency as keyof typeof order] ?? 1) - (order[b.urgency as keyof typeof order] ?? 1);
            })
            .slice(0, 8)
        : [];

      const threats = Array.isArray(worldState.threats)
        ? (worldState.threats as Array<{ name: string; urgency: number }>).slice(0, 5)
        : [];

      const npcEntities = entities.filter(e => e.type === 'NPC');
      const npcMotivations = npcEntities
        .filter(e => {
          const p = e.properties as Record<string, unknown>;
          return p.motivation || p.fear;
        })
        .map(e => {
          const p = e.properties as Record<string, string>;
          return { name: e.name, motivation: p.motivation, fear: p.fear, loyalty: p.loyalty };
        });

      const factionRelationships = relationships
        .filter(r => r.fromEntity?.type === 'FACTION' && r.toEntity?.type === 'FACTION')
        .map(r => ({
          factionA: r.fromEntity.name,
          factionB: r.toEntity.name,
          type: r.type,
          strength: r.strength,
        }));

      ctx.brainHooks = hooks.map(h => ({ text: h.text, urgency: h.urgency as 'low' | 'medium' | 'high' }));
      ctx.brainThreats = threats;
      ctx.npcMotivations = npcMotivations;
      ctx.factionTensions = factionRelationships;
    } catch {
      // Brain not yet seeded — non-fatal, prep continues without it
    }

    return ctx;
  }

  /**
   * AI: Suggest a strong start (step 2).
   */
  async aiSuggestStrongStart(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const ctx = await this.getContextForPrep(session.campaignId, userId);
    const recentRecap = ctx.recentSessions[0]?.recap ?? ctx.recentSessions[0]?.aiSummary ?? undefined;

    const available = await isOllamaAvailable();
    if (!available) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ollama is not available' });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: session.campaignId },
      select: { name: true, description: true },
    });

    const prompt = buildStrongStartPrompt({
      campaignName: campaign?.name ?? 'Unknown Campaign',
      campaignDescription: campaign?.description ?? undefined,
      recentRecap,
      characters: ctx.characters.map((c) => ({ name: c.name, class: c.class ?? undefined })),
      knownNpcs: ctx.npcs.map((n) => ({ name: n.name, role: n.role ?? undefined })),
      brainHooks: ctx.brainHooks,
      brainThreats: ctx.brainThreats,
    });

    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.8 });
    const parsed = JSON.parse(raw) as { strongStart?: string };
    return { strongStart: parsed.strongStart ?? '' };
  }

  /**
   * AI: Suggest potential scenes (step 3).
   */
  async aiSuggestScenes(sessionId: string, userId: string, strongStart: string) {
    await authz.session(sessionId, userId).requireManage();

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const available = await isOllamaAvailable();
    if (!available) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ollama is not available' });
    }

    const [campaign, ctx] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: session.campaignId },
        select: { name: true },
      }),
      this.getContextForPrep(session.campaignId, userId),
    ]);

    const recentRecap = ctx.recentSessions[0]?.recap ?? ctx.recentSessions[0]?.aiSummary ?? undefined;

    const prompt = buildScenesPrompt(
      {
        campaignName: campaign?.name ?? 'Unknown Campaign',
        recentRecap,
        characters: ctx.characters.map((c) => ({ name: c.name, class: c.class ?? undefined })),
        knownNpcs: ctx.npcs.map((n) => ({ name: n.name, role: n.role ?? undefined })),
        factionTensions: ctx.factionTensions,
      },
      strongStart
    );

    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.8 });
    const parsed = JSON.parse(raw) as { scenes?: unknown[] };
    return { scenes: parsed.scenes ?? [] };
  }

  /**
   * AI: Suggest secrets & clues (step 4).
   */
  async aiSuggestSecrets(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const available = await isOllamaAvailable();
    if (!available) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ollama is not available' });
    }

    const [campaign, ctx] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: session.campaignId },
        select: { name: true },
      }),
      this.getContextForPrep(session.campaignId, userId),
    ]);

    const recentRecap = ctx.recentSessions[0]?.recap ?? ctx.recentSessions[0]?.aiSummary ?? undefined;

    const prompt = buildSecretsPrompt({
      campaignName: campaign?.name ?? 'Unknown Campaign',
      recentRecap,
      characters: ctx.characters.map((c) => ({ name: c.name, class: c.class ?? undefined })),
      knownNpcs: ctx.npcs.map((n) => ({ name: n.name, role: n.role ?? undefined })),
      npcMotivations: ctx.npcMotivations,
    });

    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.8 });
    const parsed = JSON.parse(raw) as { secretsAndClues?: unknown[] };
    return { secretsAndClues: parsed.secretsAndClues ?? [] };
  }

  /**
   * AI: Detect loose threads from recent session recaps (step 8).
   */
  async aiDetectLooseThreads(sessionId: string, userId: string) {
    await authz.session(sessionId, userId).requireManage();

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: { campaignId: true },
    });
    if (!session) throw new NotFoundError('session', sessionId);

    const available = await isOllamaAvailable();
    if (!available) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Ollama is not available' });
    }

    // Use Brain hooks if available, otherwise fall back to scanning session recaps
    let prompt: string;
    try {
      const worldState = await brainRepository.getOrCreateState(session.campaignId);
      const brainHooks = Array.isArray(worldState.hooks)
        ? (worldState.hooks as Array<{ text: string; urgency: string; status?: string }>)
            .filter(h => h.status !== 'resolved')
            .sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return (order[a.urgency as keyof typeof order] ?? 1) - (order[b.urgency as keyof typeof order] ?? 1);
            })
        : [];

      if (brainHooks.length > 0) {
        prompt = buildLooseThreadsFromBrainPrompt(
          brainHooks.map(h => ({ text: h.text, urgency: h.urgency as 'low' | 'medium' | 'high' }))
        );
        const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.6 });
        const parsed = JSON.parse(raw) as { looseThreads?: unknown[] };
        return { looseThreads: parsed.looseThreads ?? [] };
      }
    } catch {
      // Brain unavailable — fall through to recap-based detection
    }

    const recentSessions = await sessionRepository.findRecentByCampaignId(session.campaignId, 5);

    const recapsWithText = recentSessions
      .filter((s) => s.recap || s.aiSummary)
      .map((s) => ({
        id: s.id,
        sessionNumber: s.sessionNumber,
        title: s.title ?? undefined,
        recap: (s.recap || s.aiSummary) as string,
      }));

    if (recapsWithText.length === 0) {
      return { looseThreads: [] };
    }

    prompt = buildLooseThreadsPrompt(recapsWithText);
    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.6 });
    const parsed = JSON.parse(raw) as { looseThreads?: unknown[] };
    return { looseThreads: parsed.looseThreads ?? [] };
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

    const transcriptSource = session.transcripts.some((t) => t.source === 'web_speech')
      ? 'web_speech'
      : (session.transcripts[0]?.source ?? 'upload');

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
      transcriptSource,
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

  async generateRecap(sessionId: string, userId: string): Promise<string> {
    await authz.session(sessionId, userId).requireManage();

    const session = await sessionRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundError('session', sessionId);
    }

    const transcripts = await prisma.transcript.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        correctedText: true,
        rawText: true,
      },
    });

    const transcriptText = transcripts
      .map((t) => t.correctedText || t.rawText)
      .filter(Boolean)
      .join('\n\n');

    if (!transcriptText.trim()) {
      throw new BadRequestError('No transcript text available for recap generation');
    }

    const prompt = `You are a D&D session recap writer. Summarize this session transcript into a narrative recap suitable for players. Include key events, NPC interactions, combat outcomes, and important decisions. Keep it concise (2-4 paragraphs).\n\nTranscript:\n${transcriptText}`;

    const recap = await generateWithOllama(prompt, {
      temperature: 0.7,
    });

    await sessionRepository.update(sessionId, { recap });

    void webhookService.dispatch(session.campaignId, 'summary.ready', {
      sessionId,
      summaryLength: recap.length,
    });

    return recap;
  }
}

export const sessionService = new SessionService();
