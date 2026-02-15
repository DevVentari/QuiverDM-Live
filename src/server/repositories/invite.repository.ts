/**
 * Invite Code Repository
 * Database operations for invite-only beta system
 */

import { prisma } from '@/lib/prisma';
import type { InviteCode } from '@prisma/client';

export const inviteRepository = {
  /**
   * Create a new invite code
   */
  async create(code: string, expiresAt?: Date): Promise<InviteCode> {
    return prisma.inviteCode.create({
      data: {
        code,
        expiresAt,
      },
    });
  },

  /**
   * Create multiple invite codes (batch)
   */
  async createMany(codes: string[], expiresAt?: Date): Promise<number> {
    const result = await prisma.inviteCode.createMany({
      data: codes.map((code) => ({
        code,
        expiresAt,
      })),
      skipDuplicates: true,
    });
    return result.count;
  },

  /**
   * Find invite code by code string
   */
  async findByCode(code: string): Promise<InviteCode | null> {
    return prisma.inviteCode.findUnique({
      where: { code },
    });
  },

  /**
   * Mark invite code as used
   */
  async markAsUsed(code: string, userId: string): Promise<InviteCode> {
    return prisma.inviteCode.update({
      where: { code },
      data: {
        usedBy: userId,
        usedAt: new Date(),
      },
    });
  },

  /**
   * Get all invite codes (for admin)
   */
  async findAll(limit: number = 100): Promise<InviteCode[]> {
    return prisma.inviteCode.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get unused invite codes
   */
  async findUnused(limit: number = 100): Promise<InviteCode[]> {
    return prisma.inviteCode.findMany({
      where: { usedBy: null },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get usage statistics
   */
  async getStats(): Promise<{
    total: number;
    used: number;
    unused: number;
    expired: number;
  }> {
    const now = new Date();

    const [total, used, expired] = await Promise.all([
      prisma.inviteCode.count(),
      prisma.inviteCode.count({ where: { usedBy: { not: null } } }),
      prisma.inviteCode.count({
        where: {
          expiresAt: { lt: now },
          usedBy: null,
        },
      }),
    ]);

    return {
      total,
      used,
      unused: total - used,
      expired,
    };
  },

  /**
   * Delete expired unused codes
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.inviteCode.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        usedBy: null,
      },
    });
    return result.count;
  },
};
