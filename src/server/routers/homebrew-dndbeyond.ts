import { router, publicProcedure, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { HomebrewType } from './homebrew';

/**
 * D&D Beyond Homebrew Integration Router
 *
 * Handles import/export of homebrew content to/from D&D Beyond
 * Note: D&D Beyond API is READ-ONLY - no official write endpoints exist
 */
export const homebrewDndBeyondRouter = router({
  /**
   * Test if D&D Beyond API is accessible with the given Cobalt token
   */
  testConnection: protectedProcedure
    .input(
      z.object({
        cobaltToken: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      try {
        // Test with a simple API call (e.g., user profile or a known character)
        const response = await fetch(
          'https://character-service.dndbeyond.com/character/v5/characters',
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Cookie: `CobaltSession=${input.cobaltToken}`,
            },
          }
        );

        if (!response.ok) {
          return {
            success: false,
            message:
              response.status === 403 || response.status === 401
                ? 'Invalid or expired Cobalt token'
                : `API error: ${response.statusText}`,
          };
        }

        return {
          success: true,
          message: 'Successfully connected to D&D Beyond API',
        };
      } catch (error) {
        return {
          success: false,
          message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }),

  /**
   * Attempt to import homebrew content from D&D Beyond
import { verifyHomebrewOwnership } from '../lib/ownership';
   * NOTE: This endpoint is experimental and may not work if D&D Beyond doesn't expose homebrew via API
   */
  importHomebrewFromDDB: protectedProcedure
    .input(
      z.object({
        
        cobaltToken: z.string(),
        contentType: HomebrewType,
        dndBeyondId: z.string(), // ID of the homebrew item on D&D Beyond
        addToCampaignId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      try {
        // Construct API endpoint based on content type
        // NOTE: These endpoints are speculative and need testing
        let apiUrl = '';
        switch (input.contentType) {
          case 'spell':
            apiUrl = `https://character-service.dndbeyond.com/character/v5/spells/${input.dndBeyondId}`;
            break;
          case 'item':
            apiUrl = `https://character-service.dndbeyond.com/character/v5/items/${input.dndBeyondId}`;
            break;
          case 'feat':
            apiUrl = `https://character-service.dndbeyond.com/character/v5/feats/${input.dndBeyondId}`;
            break;
          case 'creature':
            apiUrl = `https://character-service.dndbeyond.com/character/v5/monsters/${input.dndBeyondId}`;
            break;
          default:
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Content type ${input.contentType} is not supported for D&D Beyond import`,
            });
        }

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `CobaltSession=${input.cobaltToken}`,
          },
        });

        if (!response.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Failed to fetch from D&D Beyond: ${response.statusText}`,
          });
        }

        const ddbData = await response.json();

        // Transform D&D Beyond data to our format
        const transformedData = transformDDBToQuiverDM(
          input.contentType,
          ddbData
        );

        // Create homebrew content in our database
        const content = await prisma.homebrewContent.create({
          data: {
            userId,
            type: input.contentType,
            name: transformedData.name,
            data: transformedData.data,
            images: transformedData.images || [],
            tags: transformedData.tags || [],
            searchText: generateSearchText(
              transformedData.name,
              transformedData.data
            ),
            dndBeyondId: input.dndBeyondId,
            dndBeyondUrl: `https://www.dndbeyond.com/${getContentTypePath(input.contentType)}/${input.dndBeyondId}`,
            sourceType: 'dndbeyond_import',
          },
        });

        // Add to campaign if specified
        if (input.addToCampaignId) {
          await prisma.campaignHomebrewContent.create({
            data: {
              campaignId: input.addToCampaignId,
              homebrewId: content.id,
            },
          });
        }

        return {
          success: true,
          content,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  /**
   * Export homebrew content to D&D Beyond compatible format
   * Since D&D Beyond has no write API, this generates formats for manual entry
   */
  exportToDnDBeyondFormat: protectedProcedure
    .input(
      z.object({
        homebrewId: z.string(),
        format: z.enum(['json', 'markdown', 'plain']).default('markdown'),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      await verifyHomebrewOwnership(input.homebrewId, userId);
      const content = await prisma.homebrewContent.findUnique({
        where: { id: input.homebrewId },
      });

      if (!content) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Homebrew content not found',
        });
      }

      let exportedContent = '';

      switch (input.format) {
        case 'json':
          exportedContent = JSON.stringify(
            {
              name: content.name,
              type: content.type,
              data: content.data,
              tags: content.tags,
            },
            null,
            2
          );
          break;

        case 'markdown':
          exportedContent = formatAsMarkdown(content);
          break;

        case 'plain':
          exportedContent = formatAsPlainText(content);
          break;
      }

      return {
        success: true,
        content: exportedContent,
        instructions: getExportInstructions(content.type),
      };
    }),

  /**
   * Bulk export multiple homebrew items
   */
  exportMultipleToDnDBeyond: protectedProcedure
    .input(
      z.object({
        homebrewIds: z.array(z.string()),
        format: z.enum(['json', 'markdown', 'plain']).default('markdown'),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      // Verify all homebrew items belong to user
      for (const homebrewId of input.homebrewIds) {
        await verifyHomebrewOwnership(homebrewId, userId);
      }
      const contents = await prisma.homebrewContent.findMany({
        where: {
          id: { in: input.homebrewIds },
        },
        orderBy: { type: 'asc' },
      });

      if (contents.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No homebrew content found',
        });
      }

      const exports = contents.map((content) => {
        let exportedContent = '';

        switch (input.format) {
          case 'json':
            exportedContent = JSON.stringify(
              {
                name: content.name,
                type: content.type,
                data: content.data,
                tags: content.tags,
              },
              null,
              2
            );
            break;

          case 'markdown':
            exportedContent = formatAsMarkdown(content);
            break;

          case 'plain':
            exportedContent = formatAsPlainText(content);
            break;
        }

        return {
          id: content.id,
          name: content.name,
          type: content.type,
          content: exportedContent,
        };
      });

      return {
        success: true,
        exports,
        instructions: 'Manually copy each item into D&D Beyond\'s homebrew creator.',
      };
    }),

  /**
   * Check if homebrew content already exists in database (by D&D Beyond ID)
   */
  checkDuplicateByDnDBeyondId: protectedProcedure
    .input(
      z.object({
        
        dndBeyondId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await prisma.homebrewContent.findFirst({
        where: {
          userId,
          dndBeyondId: input.dndBeyondId,
        },
      });

      return {
        exists: !!existing,
        content: existing || null,
      };
    }),
});

// ========== Helper Functions ==========

/**
 * Transform D&D Beyond data to QuiverDM format
 * NOTE: This is a placeholder - actual implementation depends on D&D Beyond API response structure
 */
function transformDDBToQuiverDM(
  contentType: string,
  ddbData: any
): {
  name: string;
  data: any;
  images?: string[];
  tags?: string[];
} {
  // This needs to be implemented based on actual D&D Beyond API responses
  // For now, return a basic structure
  return {
    name: ddbData.name || 'Imported Item',
    data: ddbData,
    images: [],
    tags: ['imported', 'dndbeyond'],
  };
}

/**
 * Generate searchable text from content
 */
function generateSearchText(name: string, data: any): string {
  const parts = [name];

  if (typeof data === 'object' && data !== null) {
    const extractText = (obj: any): void => {
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') {
          parts.push(value);
        } else if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === 'string') {
              parts.push(item);
            } else if (typeof item === 'object') {
              extractText(item);
            }
          });
        } else if (typeof value === 'object' && value !== null) {
          extractText(value);
        }
      }
    };

    extractText(data);
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Get D&D Beyond content type path for URL construction
 */
function getContentTypePath(contentType: string): string {
  const pathMap: { [key: string]: string } = {
    spell: 'spells',
    item: 'magic-items',
    creature: 'monsters',
    feat: 'feats',
    class: 'classes',
    subclass: 'subclasses',
    race: 'races',
    background: 'backgrounds',
  };

  return pathMap[contentType] || contentType;
}

/**
 * Format homebrew content as markdown for D&D Beyond manual entry
 */
function formatAsMarkdown(content: any): string {
  const data = content.data;
  let markdown = `# ${content.name}\n\n`;
  markdown += `**Type:** ${content.type}\n\n`;

  if (content.tags && content.tags.length > 0) {
    markdown += `**Tags:** ${content.tags.join(', ')}\n\n`;
  }

  markdown += '---\n\n';

  // Format based on content type
  switch (content.type) {
    case 'spell':
      if (data.level !== undefined)
        markdown += `**Level:** ${data.level}\n`;
      if (data.school) markdown += `**School:** ${data.school}\n`;
      if (data.castingTime)
        markdown += `**Casting Time:** ${data.castingTime}\n`;
      if (data.range) markdown += `**Range:** ${data.range}\n`;
      if (data.duration) markdown += `**Duration:** ${data.duration}\n`;
      if (data.description) markdown += `\n${data.description}\n`;
      break;

    case 'item':
      if (data.rarity) markdown += `**Rarity:** ${data.rarity}\n`;
      if (data.requiresAttunement)
        markdown += `**Attunement:** ${data.attunementRequirements || 'Required'}\n`;
      if (data.description) markdown += `\n${data.description}\n`;
      break;

    case 'creature':
      if (data.size) markdown += `**Size:** ${data.size}\n`;
      if (data.type) markdown += `**Type:** ${data.type}\n`;
      if (data.alignment) markdown += `**Alignment:** ${data.alignment}\n`;
      if (data.challengeRating)
        markdown += `**CR:** ${data.challengeRating}\n`;
      // Add more creature-specific formatting
      break;

    default:
      // Generic formatting for other types
      markdown += JSON.stringify(data, null, 2);
  }

  return markdown;
}

/**
 * Format homebrew content as plain text
 */
function formatAsPlainText(content: any): string {
  const data = content.data;
  let text = `${content.name}\n`;
  text += `${'='.repeat(content.name.length)}\n\n`;
  text += `Type: ${content.type}\n\n`;

  if (content.tags && content.tags.length > 0) {
    text += `Tags: ${content.tags.join(', ')}\n\n`;
  }

  // Simple JSON dump for now
  text += JSON.stringify(data, null, 2);

  return text;
}

/**
 * Get instructions for manually entering content into D&D Beyond
 */
function getExportInstructions(contentType: string): string {
  const baseUrl = 'https://www.dndbeyond.com';

  const instructions: { [key: string]: string } = {
    spell: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Spell"
3. Copy the exported data and fill in the form fields
4. Save your homebrew spell`,

    item: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Magic Item"
3. Copy the exported data and fill in the form fields
4. Save your homebrew item`,

    creature: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Monster"
3. Copy the exported data and fill in the stat block
4. Save your homebrew creature`,

    feat: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Feat"
3. Copy the exported data and fill in the form fields
4. Save your homebrew feat`,

    class: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Class"
3. Copy the exported data and fill in the form fields
4. This is a complex process - consider using D&D Beyond's class builder`,

    race: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Race"
3. Copy the exported data and fill in the form fields
4. Save your homebrew race`,

    background: `1. Go to ${baseUrl}/homebrew/creations
2. Click "Create Background"
3. Copy the exported data and fill in the form fields
4. Save your homebrew background`,
  };

  return (
    instructions[contentType] ||
    `1. Go to ${baseUrl}/homebrew/creations
2. Find the appropriate creation type
3. Manually enter the exported data
4. Save your homebrew content`
  );
}

export type HomebrewDndBeyondRouter = typeof homebrewDndBeyondRouter;
