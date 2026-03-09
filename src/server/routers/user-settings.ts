import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';
import { ValidationError, BadRequestError } from '../errors';

export const userSettingsRouter = router({
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.user.id },
      select: { name: true, displayName: true, bio: true, email: true, image: true, platformRole: true },
    });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const data: Record<string, string | null> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.displayName !== undefined) data.displayName = input.displayName;
      if (input.bio !== undefined) data.bio = input.bio || null;

      return prisma.user.update({ where: { id: userId }, data });
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, 'New password must be at least 8 characters'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const account = await prisma.account.findFirst({
        where: { userId, provider: 'credentials' },
      });

      if (!account || !account.password) {
        throw new BadRequestError('No password set on this account. Use "Forgot password" to set one.');
      }

      const valid = await bcrypt.compare(input.currentPassword, account.password);
      if (!valid) {
        throw ValidationError.forField('currentPassword', 'Current password is incorrect');
      }

      const hashed = await bcrypt.hash(input.newPassword, 12);
      await prisma.account.update({
        where: { id: account.id },
        data: { password: hashed },
      });

      return { success: true };
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }),

  // Get user settings (with masked API keys)
  getSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      let settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      // Create settings if they don't exist
      if (!settings) {
        settings = await prisma.userSettings.create({
          data: { userId },
        });
      }

      // Return with masked keys for display
      return {
        id: settings.id,
        userId: settings.userId,
        hasOpenaiApiKey: !!settings.openaiApiKey,
        hasAnthropicApiKey: !!settings.anthropicApiKey,
        hasHuggingfaceToken: !!settings.huggingfaceToken,
        hasDndBeyondCobaltCookie: !!settings.dndBeyondCobaltCookie,
        maskedOpenaiApiKey: settings.openaiApiKey ? (() => { try { return maskApiKey(decrypt(settings.openaiApiKey!)); } catch { return null; } })() : null,
        maskedAnthropicApiKey: settings.anthropicApiKey ? (() => { try { return maskApiKey(decrypt(settings.anthropicApiKey!)); } catch { return null; } })() : null,
        maskedHuggingfaceToken: settings.huggingfaceToken ? (() => { try { return maskApiKey(decrypt(settings.huggingfaceToken!)); } catch { return null; } })() : null,
        maskedDndBeyondCobaltCookie: settings.dndBeyondCobaltCookie ? (() => { try { return maskApiKey(decrypt(settings.dndBeyondCobaltCookie!)); } catch { return null; } })() : null,
        hasGeminiApiKey: !!settings.geminiApiKey,
        maskedGeminiApiKey: settings.geminiApiKey ? (() => { try { return maskApiKey(decrypt(settings.geminiApiKey!)); } catch { return null; } })() : null,
        videoBackground: settings.videoBackground,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      };
    }),

  // Get decrypted API key (for actual use)
  getDecryptedKey: protectedProcedure
    .input(
      z.object({
        keyName: z.enum(['openaiApiKey', 'anthropicApiKey', 'huggingfaceToken', 'dndBeyondCobaltCookie', 'geminiApiKey']),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });

      if (!settings) {
        return null;
      }

      const encryptedValue = settings[input.keyName];
      if (!encryptedValue) {
        return null;
      }

      return decrypt(encryptedValue);
    }),

  // Update API keys
  updateApiKeys: protectedProcedure
    .input(
      z.object({
        openaiApiKey: z.string().optional(),
        anthropicApiKey: z.string().optional(),
        huggingfaceToken: z.string().optional(),
        dndBeyondCobaltCookie: z.string().optional(),
        geminiApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const keys = input;

      // Encrypt provided keys
      const encryptedData: any = {};
      if (keys.openaiApiKey !== undefined) {
        encryptedData.openaiApiKey = keys.openaiApiKey ? encrypt(keys.openaiApiKey) : null;
      }
      if (keys.anthropicApiKey !== undefined) {
        encryptedData.anthropicApiKey = keys.anthropicApiKey ? encrypt(keys.anthropicApiKey) : null;
      }
      if (keys.huggingfaceToken !== undefined) {
        encryptedData.huggingfaceToken = keys.huggingfaceToken ? encrypt(keys.huggingfaceToken) : null;
      }
      if (keys.dndBeyondCobaltCookie !== undefined) {
        encryptedData.dndBeyondCobaltCookie = keys.dndBeyondCobaltCookie
          ? encrypt(keys.dndBeyondCobaltCookie)
          : null;
      }
      if (keys.geminiApiKey !== undefined) {
        encryptedData.geminiApiKey = keys.geminiApiKey ? encrypt(keys.geminiApiKey) : null;
      }

      // Upsert settings
      const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...encryptedData,
        },
        update: encryptedData,
      });

      return {
        success: true,
        hasOpenaiApiKey: !!settings.openaiApiKey,
        hasAnthropicApiKey: !!settings.anthropicApiKey,
        hasHuggingfaceToken: !!settings.huggingfaceToken,
        hasDndBeyondCobaltCookie: !!settings.dndBeyondCobaltCookie,
        hasGeminiApiKey: !!settings.geminiApiKey,
      };
    }),

  // Update display preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        videoBackground: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });
      return { success: true };
    }),

  // Delete specific API key
  deleteApiKey: protectedProcedure
    .input(
      z.object({
        keyName: z.enum(['openaiApiKey', 'anthropicApiKey', 'huggingfaceToken', 'dndBeyondCobaltCookie', 'geminiApiKey']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await prisma.userSettings.update({
        where: { userId },
        data: {
          [input.keyName]: null,
        },
      });

      return { success: true };
    }),
});
