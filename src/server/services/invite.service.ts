/**
 * Invite Code Service
 * Business logic for closed beta invite system
 */

import { inviteRepository } from '../repositories/invite.repository';
import { ValidationError, NotFoundError, ConflictError } from '../errors';
import crypto from 'crypto';

export const inviteService = {
  /**
   * Generate a cryptographically secure invite code
   * Format: QDMXXXX-XXXX (QDM prefix + 8 random chars)
   */
  generateCode(): string {
    const randomBytes = crypto.randomBytes(4);
    const randomPart = randomBytes.toString('hex').toUpperCase();
    return `QDM${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`;
  },

  /**
   * Generate multiple invite codes
   */
  async generateCodes(
    count: number,
    expiresInDays?: number
  ): Promise<{ codes: string[]; created: number }> {
    if (count < 1 || count > 1000) {
      throw ValidationError.forField('count', 'Must be between 1 and 1000');
    }

    const codes: string[] = [];
    const codeSet = new Set<string>();

    // Generate unique codes
    while (codeSet.size < count) {
      codeSet.add(this.generateCode());
    }

    codes.push(...Array.from(codeSet));

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const created = await inviteRepository.createMany(codes, expiresAt);

    return { codes, created };
  },

  /**
   * Validate an invite code
   * Returns true if valid, throws error if not
   */
  async validateCode(code: string): Promise<void> {
    if (!code || code.length < 8) {
      throw ValidationError.forField('code', 'Invalid invite code format');
    }

    const invite = await inviteRepository.findByCode(code.trim().toUpperCase());

    if (!invite) {
      throw new NotFoundError('invite code', code);
    }

    if (invite.usedBy) {
      throw new ConflictError(
        `Invite code has already been used${invite.usedAt ? ` on ${invite.usedAt.toISOString().split('T')[0]}` : ''}`
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw ValidationError.forField(
        'code',
        `Invite code expired on ${invite.expiresAt.toISOString().split('T')[0]}`
      );
    }
  },

  /**
   * Redeem an invite code (mark as used)
   */
  async redeemCode(code: string, userId: string): Promise<void> {
    await this.validateCode(code);

    await inviteRepository.markAsUsed(code.trim().toUpperCase(), userId);
  },

  /**
   * Get invite code statistics
   */
  async getStats() {
    return inviteRepository.getStats();
  },

  /**
   * Get all invite codes (admin only)
   */
  async getAllCodes(limit?: number) {
    return inviteRepository.findAll(limit);
  },

  /**
   * Get unused invite codes (admin only)
   */
  async getUnusedCodes(limit?: number) {
    return inviteRepository.findUnused(limit);
  },

  /**
   * Clean up expired codes
   */
  async cleanupExpired(): Promise<number> {
    return inviteRepository.deleteExpired();
  },
};
