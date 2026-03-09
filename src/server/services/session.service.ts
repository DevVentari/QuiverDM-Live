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
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors';
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
} from '@/lib/ai/prep-prompts';

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
              class: true,
              background: true,
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

    return { characters: charactersForPrep, npcs: npcsForPrep, recentSessions, homebrew: homebrewLinks };
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

    const prompt = buildLooseThreadsPrompt(recapsWithText);
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

  async generateQuickNpc(sessionId: string, userId: string, hint?: string): Promise<{
    name: string;
    role: string;
    trait: string;
    secret: string;
    voiceQuirk: string;
  }> {
    const access = await authz.session(sessionId, userId).verify();
    if (!access.isDM) throw ForbiddenError.forPermission('manage', 'session');

    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('session', sessionId);

    const prompt = `Generate a quick D&D NPC for an active session.
Campaign: ${session.campaign?.name ?? 'Unknown'}
${hint ? `DM hint: ${hint}` : ''}

Respond ONLY with valid JSON:
{
  "name": "Full Name",
  "role": "Brief role (e.g. 'tavern keeper', 'city guard')",
  "trait": "One distinctive personality trait",
  "secret": "One secret they're hiding",
  "voiceQuirk": "How they speak (e.g. 'speaks in rhymes', 'overly formal')"
}`;

    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.9 });
    let text = raw.trim();
    if (text.startsWith('```')) text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text) as Record<string, string>;
    return {
      name: String(parsed.name ?? 'Unknown'),
      role: String(parsed.role ?? ''),
      trait: String(parsed.trait ?? ''),
      secret: String(parsed.secret ?? ''),
      voiceQuirk: String(parsed.voiceQuirk ?? ''),
    };
  }

  async suggestTwist(sessionId: string, userId: string, hint?: string): Promise<{ twists: string[] }> {
    const access = await authz.session(sessionId, userId).verify();
    if (!access.isDM) throw ForbiddenError.forPermission('manage', 'session');

    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('session', sessionId);

    const notes = (session.quickNotes ?? '').slice(-300);
    const prompt = `You are a D&D Dungeon Master assistant. Suggest 3 short plot twists or complications for an active session.
Campaign: ${session.campaign?.name ?? 'Unknown'}
Recent notes: ${notes || '(none)'}
${hint ? `DM request: ${hint}` : ''}

Respond ONLY with valid JSON:
{
  "twists": [
    "Twist 1 (one sentence)",
    "Twist 2 (one sentence)",
    "Twist 3 (one sentence)"
  ]
}`;

    const raw = await generateWithOllama(prompt, { format: 'json', temperature: 0.9 });
    let text = raw.trim();
    if (text.startsWith('```')) text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const twists = Array.isArray(parsed.twists) ? parsed.twists.map(String) : [];
    return { twists: twists.slice(0, 3) };
  }
}

export const sessionService = new SessionService();
