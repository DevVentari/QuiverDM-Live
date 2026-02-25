/**
 * Homebrew D&D Beyond Service
 *
 * Business logic for D&D Beyond import/export operations.
 */

import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { homebrewDndbeyondRepository } from '../repositories/homebrew-dndbeyond.repository';
import { prisma } from '../db';
import { authz } from './authorization.service';
import { detectCustomSections } from '@/lib/ai/detect-custom-sections';
import { parseHomebrewDescription } from '@/lib/ai/parse-homebrew-description';

// =============================================================================
// Service Class
// =============================================================================

export class HomebrewDndbeyondService {
  /**
   * Test if D&D Beyond API is accessible with the given Cobalt token
   */
  async testConnection(cobaltToken: string) {
    try {
      const response = await fetch(
        'https://character-service.dndbeyond.com/character/v5/characters',
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `CobaltSession=${cobaltToken}`,
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
  }

  /**
   * Import homebrew content from D&D Beyond
   */
  async importFromDDB(
    userId: string,
    input: {
      cobaltToken: string;
      contentType: string;
      dndBeyondId: string;
      addToCampaignId?: string;
    }
  ) {
    try {
      const apiUrl = this.getApiUrl(input.contentType, input.dndBeyondId);

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
      const transformedData = this.transformDDBToQuiverDM(input.contentType, ddbData);

      const content = await homebrewDndbeyondRepository.createFromImport({
        userId,
        type: input.contentType,
        name: transformedData.name,
        data: transformedData.data,
        images: transformedData.images,
        tags: transformedData.tags,
        searchText: this.generateSearchText(transformedData.name, transformedData.data),
        dndBeyondId: input.dndBeyondId,
        dndBeyondUrl: `https://www.dndbeyond.com/${this.getContentTypePath(input.contentType)}/${input.dndBeyondId}`,
      });

      // Fire-and-forget: detect custom sections from non-standard DDB fields
      const ddbPayload = transformedData.data as Record<string, unknown>;
      detectCustomSections(input.contentType, ddbPayload).then(async (customSections) => {
        if (customSections.length === 0) return;
        const merged = { ...ddbPayload, customSections };
        await prisma.homebrewContent.update({
          where: { id: content.id },
          data: {
            data: merged as unknown as Prisma.InputJsonValue,
            searchText: this.generateSearchText(transformedData.name, merged),
          },
        });
      }).catch(() => {});

      // Fire-and-forget: parse description into lore + structured effects (items only)
      if (input.contentType === 'item') {
        const rawDesc = (ddbPayload.description || ddbPayload.text || '') as string;
        if (rawDesc.trim()) {
          parseHomebrewDescription({ name: transformedData.name, type: 'item', rawDescription: rawDesc })
            .then(async (parsed) => {
              if (parsed.effects.length === 0 && parsed.lore === rawDesc) return;
              const current = await prisma.homebrewContent.findUnique({
                where: { id: content.id }, select: { data: true }
              });
              if (!current) return;
              const merged = { ...(current.data as Record<string, unknown>), lore: parsed.lore, effects: parsed.effects };
              await prisma.homebrewContent.update({
                where: { id: content.id },
                data: { data: merged as unknown as Prisma.InputJsonValue },
              });
            }).catch(() => {});
        }
      }

      if (input.addToCampaignId) {
        await homebrewDndbeyondRepository.addToCampaign(content.id, input.addToCampaignId);
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
  }

  /**
   * Export homebrew content to D&D Beyond compatible format
   */
  async exportToDnDBeyondFormat(
    homebrewId: string,
    userId: string,
    format: 'json' | 'markdown' | 'plain' = 'markdown'
  ) {
    await authz.homebrew(homebrewId, userId).verify();

    const content = await homebrewDndbeyondRepository.findById(homebrewId);

    if (!content) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Homebrew content not found',
      });
    }

    const exportedContent = this.formatContent(content, format);

    return {
      success: true,
      content: exportedContent,
      instructions: this.getExportInstructions(content.type),
    };
  }

  /**
   * Bulk export multiple homebrew items
   */
  async exportMultiple(
    homebrewIds: string[],
    userId: string,
    format: 'json' | 'markdown' | 'plain' = 'markdown'
  ) {
    // Verify all homebrew items belong to user
    for (const homebrewId of homebrewIds) {
      await authz.homebrew(homebrewId, userId).verify();
    }

    const contents = await homebrewDndbeyondRepository.findByIds(homebrewIds);

    if (contents.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No homebrew content found',
      });
    }

    const exports = contents.map((content) => ({
      id: content.id,
      name: content.name,
      type: content.type,
      content: this.formatContent(content, format),
    }));

    return {
      success: true,
      exports,
      instructions: "Manually copy each item into D&D Beyond's homebrew creator.",
    };
  }

  /**
   * Check if homebrew content already exists by D&D Beyond ID
   */
  async checkDuplicate(userId: string, dndBeyondId: string) {
    const existing = await homebrewDndbeyondRepository.findByDnDBeyondId(
      userId,
      dndBeyondId
    );

    return {
      exists: !!existing,
      content: existing || null,
    };
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  private getApiUrl(contentType: string, dndBeyondId: string): string {
    const baseUrl = 'https://character-service.dndbeyond.com/character/v5';

    switch (contentType) {
      case 'spell':
        return `${baseUrl}/spells/${dndBeyondId}`;
      case 'item':
        return `${baseUrl}/items/${dndBeyondId}`;
      case 'feat':
        return `${baseUrl}/feats/${dndBeyondId}`;
      case 'creature':
        return `${baseUrl}/monsters/${dndBeyondId}`;
      default:
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Content type ${contentType} is not supported for D&D Beyond import`,
        });
    }
  }

  private transformDDBToQuiverDM(
    contentType: string,
    ddbData: any
  ): {
    name: string;
    data: any;
    images?: string[];
    tags?: string[];
  } {
    return {
      name: ddbData.name || 'Imported Item',
      data: ddbData,
      images: [],
      tags: ['imported', 'dndbeyond'],
    };
  }

  private generateSearchText(name: string, data: any): string {
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

  private getContentTypePath(contentType: string): string {
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

  private formatContent(
    content: any,
    format: 'json' | 'markdown' | 'plain'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(
          {
            name: content.name,
            type: content.type,
            data: content.data,
            tags: content.tags,
          },
          null,
          2
        );

      case 'markdown':
        return this.formatAsMarkdown(content);

      case 'plain':
        return this.formatAsPlainText(content);
    }
  }

  private formatAsMarkdown(content: any): string {
    const data = content.data;
    let markdown = `# ${content.name}\n\n`;
    markdown += `**Type:** ${content.type}\n\n`;

    if (content.tags && content.tags.length > 0) {
      markdown += `**Tags:** ${content.tags.join(', ')}\n\n`;
    }

    markdown += '---\n\n';

    switch (content.type) {
      case 'spell':
        if (data.level !== undefined) markdown += `**Level:** ${data.level}\n`;
        if (data.school) markdown += `**School:** ${data.school}\n`;
        if (data.castingTime) markdown += `**Casting Time:** ${data.castingTime}\n`;
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
        if (data.challengeRating) markdown += `**CR:** ${data.challengeRating}\n`;
        break;

      default:
        markdown += JSON.stringify(data, null, 2);
    }

    return markdown;
  }

  private formatAsPlainText(content: any): string {
    const data = content.data;
    let text = `${content.name}\n`;
    text += `${'='.repeat(content.name.length)}\n\n`;
    text += `Type: ${content.type}\n\n`;

    if (content.tags && content.tags.length > 0) {
      text += `Tags: ${content.tags.join(', ')}\n\n`;
    }

    text += JSON.stringify(data, null, 2);

    return text;
  }

  private getExportInstructions(contentType: string): string {
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
}

export const homebrewDndbeyondService = new HomebrewDndbeyondService();
