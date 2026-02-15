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
      throw new ValidationError.forField('rating', 'Rating must be between 1 and 5');
    }

    // Validate title length
    if (data.title.length < 3) {
      throw new ValidationError.forField('title', 'Title must be at least 3 characters');
    }

    if (data.title.length > 200) {
      throw new ValidationError.forField('title', 'Title must be less than 200 characters');
    }

    // Validate description length
    if (data.description.length < 10) {
      throw new ValidationError.forField(
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

    // TODO: Send Discord webhook notification for new feedback
    // await this.notifyNewFeedback(feedback);

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
      throw new ForbiddenError.forPermission('view', 'this feedback');
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
      include: {
        // Include user info for admin view
        // Note: This requires adding user relation to Feedback model
      },
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
};
