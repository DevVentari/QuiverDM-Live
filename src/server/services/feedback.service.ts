/**
 * Feedback Service
 * Business logic for beta feedback collection
 */

import { prisma } from '@/lib/prisma';
import { NotFoundError, ValidationError, ForbiddenError } from '../errors';

export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other';
export type FeedbackCategory =
  | 'transcription'
  | 'pdf'
  | 'ui'
  | 'performance'
  | 'other';
export type FeedbackStatus =
  | 'new'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix';

export const feedbackService = {
  /**
   * Submit new feedback
   */
  async create(
    userId: string,
    data: {
      type: FeedbackType;
      category?: FeedbackCategory;
      title: string;
      description: string;
      rating?: number;
      metadata?: Record<string, any>;
    }
  ) {
    // Validate rating if provided
    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw ValidationError.forField('rating', 'Rating must be between 1 and 5');
    }

    // Validate title length
    if (data.title.length < 3) {
      throw ValidationError.forField('title', 'Title must be at least 3 characters');
    }

    if (data.title.length > 200) {
      throw ValidationError.forField('title', 'Title must be less than 200 characters');
    }

    // Validate description length
    if (data.description.length < 10) {
      throw ValidationError.forField(
        'description',
        'Description must be at least 10 characters'
      );
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        type: data.type,
        category: data.category,
        title: data.title,
        description: data.description,
        rating: data.rating,
        metadata: data.metadata as any,
      },
    });

    // Fire-and-forget Discord notification (non-blocking)
    void this.notifyNewFeedback(feedback);

    return feedback;
  },

  /**
   * Get feedback by ID
   */
  async getById(feedbackId: string, userId: string) {
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundError('feedback', feedbackId);
    }

    // Users can only view their own feedback
    if (feedback.userId !== userId) {
      throw ForbiddenError.forPermission('view', 'this feedback');
    }

    return feedback;
  },

  /**
   * Get user's feedback history
   */
  async getUserFeedback(userId: string, limit: number = 50) {
    return prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  /**
   * Get all feedback (admin only)
   */
  async getAll(options?: {
    type?: FeedbackType;
    category?: FeedbackCategory;
    status?: FeedbackStatus;
    limit?: number;
  }) {
    const where: any = {};

    if (options?.type) where.type = options.type;
    if (options?.category) where.category = options.category;
    if (options?.status) where.status = options.status;

    return prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
      // TODO: Include user relation when added to Feedback model
    });
  },

  /**
   * Update feedback status (admin only)
   */
  async updateStatus(
    feedbackId: string,
    status: FeedbackStatus,
    adminNotes?: string
  ) {
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
    });

    if (!feedback) {
      throw new NotFoundError('feedback', feedbackId);
    }

    const updateData: any = {
      status,
    };

    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }

    if (status === 'resolved' && !feedback.resolvedAt) {
      updateData.resolvedAt = new Date();
    }

    return prisma.feedback.update({
      where: { id: feedbackId },
      data: updateData,
    });
  },

  /**
   * Get feedback statistics
   */
  async getStats() {
    const [total, byType, byStatus, avgRating] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.groupBy({
        by: ['type'],
        _count: true,
      }),
      prisma.feedback.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.feedback.aggregate({
        _avg: { rating: true },
        where: { rating: { not: null } },
      }),
    ]);

    return {
      total,
      byType: Object.fromEntries(
        byType.map((item) => [item.type, item._count])
      ),
      byStatus: Object.fromEntries(
        byStatus.map((item) => [item.status, item._count])
      ),
      averageRating: avgRating._avg.rating || null,
    };
  },

  /**
   * Send Discord webhook notification for new feedback (optional)
   */
  async notifyNewFeedback(feedback: any) {
    const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `New ${feedback.type} feedback`,
              description: feedback.title,
              fields: [
                {
                  name: 'Category',
                  value: feedback.category || 'N/A',
                  inline: true,
                },
                {
                  name: 'Rating',
                  value: feedback.rating ? `${feedback.rating}/5` : 'N/A',
                  inline: true,
                },
                {
                  name: 'Description',
                  value:
                    feedback.description.length > 1000
                      ? feedback.description.substring(0, 1000) + '...'
                      : feedback.description,
                },
              ],
              color: feedback.type === 'bug' ? 0xff0000 : 0x00ff00,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch (error) {
      console.error('[Feedback] Failed to send Discord notification:', error);
    }
  },

  async createReport(
    userId: string,
    userEmail: string,
    data: {
      type: 'bug' | 'feature' | 'feedback';
      description: string;
      pageUrl: string;
      userAgent: string;
      screenshotBase64: string;
      consoleLogs: { ts: number; level: string; msg: string }[];
    }
  ) {
    const dbType = data.type === 'feedback' ? 'improvement' : data.type;

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        type: dbType,
        title: `[${data.type.toUpperCase()}] ${data.pageUrl}`,
        description: data.description,
        metadata: {
          pageUrl: data.pageUrl,
          userAgent: data.userAgent,
          consoleLogs: data.consoleLogs,
          source: 'overlay',
        },
      },
    });

    void this.postDiscordThread(feedback, userEmail, data);

    return { id: feedback.id };
  },

  async postDiscordThread(
    feedback: { id: string; type: string; description: string },
    userEmail: string,
    data: {
      type: string;
      pageUrl: string;
      userAgent: string;
      screenshotBase64: string;
      consoleLogs: { ts: number; level: string; msg: string }[];
    }
  ) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_FEEDBACK_CHANNEL_ID;
    if (!botToken || !channelId) return;

    const typeColors: Record<string, number> = {
      bug: 0xff4444,
      feature: 0x5865f2,
      feedback: 0x00c853,
    };

    const color = typeColors[data.type] ?? 0x888888;

    try {
      // Build multipart form for thread creation (includes screenshot attachment if present)
      const form = new FormData();

      const embedFields = [
        { name: 'Page', value: data.pageUrl, inline: false },
        { name: 'User', value: userEmail, inline: true },
        { name: 'Feedback ID', value: feedback.id, inline: true },
        {
          name: 'Console logs',
          value: data.consoleLogs.length > 0 ? `${data.consoleLogs.length} captured` : 'None',
          inline: true,
        },
      ];

      const embed: Record<string, unknown> = {
        title: `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Report`,
        description: feedback.description,
        color,
        fields: embedFields,
        timestamp: new Date().toISOString(),
      };

      const hasScreenshot = data.screenshotBase64 && data.screenshotBase64.length > 100;
      if (hasScreenshot) {
        embed.image = { url: 'attachment://screenshot.png' };
        const raw = data.screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(raw, 'base64');
        form.append('files[0]', new Blob([buffer], { type: 'image/png' }), 'screenshot.png');
      }

      const pathname = (() => {
        try { return new URL(data.pageUrl).pathname; } catch { return data.pageUrl; }
      })();
      const threadTitle = `[${data.type.toUpperCase()}] ${pathname} — ${new Date().toLocaleDateString()}`;

      form.append(
        'payload_json',
        JSON.stringify({
          name: threadTitle.slice(0, 100),
          message: { embeds: [embed] },
        })
      );

      const threadRes = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/threads`,
        {
          method: 'POST',
          headers: { Authorization: `Bot ${botToken}` },
          body: form,
        }
      );

      if (!threadRes.ok) {
        console.error('[Feedback] Discord thread creation failed:', await threadRes.text());
        return;
      }

      const thread = (await threadRes.json()) as { id: string };

      if (data.consoleLogs.length > 0) {
        const logText = data.consoleLogs
          .slice(-20)
          .map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()}: ${l.msg}`)
          .join('\n');

        await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: `\`\`\`\n${logText.slice(0, 1900)}\n\`\`\``,
          }),
        });
      }

      const triage = await this.triageWithClaude(
        data.type,
        feedback.description,
        data.pageUrl,
        data.consoleLogs
      );

      if (triage) {
        const severityColors: Record<string, number> = {
          critical: 0xff0000,
          high: 0xff8c00,
          medium: 0xffd700,
          low: 0x00c853,
        };
        await fetch(`https://discord.com/api/v10/channels/${thread.id}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [
              {
                title: `Claude Triage — ${(triage.severity ?? 'UNKNOWN').toUpperCase()} severity`,
                color: severityColors[triage.severity ?? 'medium'] ?? 0xffd700,
                fields: [
                  { name: 'Likely cause', value: triage.likely_cause ?? 'Unknown', inline: false },
                  {
                    name: 'Affected files',
                    value: (triage.affected_files ?? []).join('\n') || 'Unknown',
                    inline: true,
                  },
                  { name: 'Suggested fix', value: triage.suggested_fix ?? 'See description', inline: false },
                  ...(triage.reproduction_steps
                    ? [{ name: 'Reproduction', value: triage.reproduction_steps, inline: false }]
                    : []),
                ],
                footer: { text: 'Powered by Claude haiku' },
              },
            ],
          }),
        });
      }
    } catch (err) {
      console.error('[Feedback] Discord post failed:', err);
    }
  },

  async triageWithClaude(
    type: string,
    description: string,
    pageUrl: string,
    consoleLogs: { ts: number; level: string; msg: string }[]
  ): Promise<{
    severity: string;
    likely_cause: string;
    affected_files: string[];
    suggested_fix: string;
    reproduction_steps?: string;
  } | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const logSummary = consoleLogs
        .slice(-20)
        .map((l) => `${l.level.toUpperCase()}: ${l.msg}`)
        .join('\n');

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:
          'You are a bug triage agent for QuiverDM, an AI-powered D&D session management web app built with Next.js 15, tRPC, Prisma, and PostgreSQL. Analyze the report and respond with JSON ONLY — no markdown, no explanation.',
        messages: [
          {
            role: 'user',
            content: `Type: ${type}
Page: ${pageUrl}
Description: ${description}

Console logs (last 20):
${logSummary || 'None'}

Respond with this JSON schema:
{
  "severity": "low" | "medium" | "high" | "critical",
  "likely_cause": "1-2 sentence explanation",
  "affected_files": ["array of likely source file paths"],
  "suggested_fix": "concrete action to fix this",
  "reproduction_steps": "optional steps to reproduce"
}`,
          },
        ],
      });

      const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
      return JSON.parse(text) as {
        severity: string;
        likely_cause: string;
        affected_files: string[];
        suggested_fix: string;
        reproduction_steps?: string;
      };
    } catch (err) {
      console.error('[Feedback] Claude triage failed:', err);
      return null;
    }
  },
};
