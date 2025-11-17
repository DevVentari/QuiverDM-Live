import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { encrypt, decrypt, maskApiKey } from '@/lib/encryption';

export const userSettingsRouter = router({
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
        maskedOpenaiApiKey: settings.openaiApiKey ? maskApiKey(decrypt(settings.openaiApiKey)) : null,
        maskedAnthropicApiKey: settings.anthropicApiKey ? maskApiKey(decrypt(settings.anthropicApiKey)) : null,
        maskedHuggingfaceToken: settings.huggingfaceToken ? maskApiKey(decrypt(settings.huggingfaceToken)) : null,
        maskedDndBeyondCobaltCookie: settings.dndBeyondCobaltCookie ? maskApiKey(decrypt(settings.dndBeyondCobaltCookie)) : null,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      };
    }),

  // Get decrypted API key (for actual use)
  getDecryptedKey: protectedProcedure
    .input(
      z.object({
        keyName: z.enum(['openaiApiKey', 'anthropicApiKey', 'huggingfaceToken', 'dndBeyondCobaltCookie']),
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
      };
    }),

  // Delete specific API key
  deleteApiKey: protectedProcedure
    .input(
      z.object({
        keyName: z.enum(['openaiApiKey', 'anthropicApiKey', 'huggingfaceToken', 'dndBeyondCobaltCookie']),
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
