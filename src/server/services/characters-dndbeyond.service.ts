/**
 * Characters D&D Beyond Service
 *
 * Business logic for importing and syncing D&D Beyond characters
 * into the Character model. Includes homebrew content extraction.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { fetchCharacterFromDDB } from '@/lib/dndbeyond-api';
import {
  mapDnDBeyondToCharacter,
  detectHomebrew,
  extractCharacterIdFromUrl,
} from '@/lib/dndbeyond-character-mapper';
import { charactersDndbeyondRepository } from '../repositories/characters-dndbeyond.repository';
import { characterRepository } from '../repositories/character.repository';
import { homebrewDndbeyondRepository } from '../repositories/homebrew-dndbeyond.repository';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  InternalError,
} from '../errors';

// =============================================================================
// Types
// =============================================================================

interface ImportInput {
  url?: string;
  characterId?: string;
  cobaltToken?: string;
  campaignId?: string;
}

interface HomebrewResult {
  name: string;
  type: string;
  isNew: boolean;
}

interface ImportResult {
  character: any;
  created: boolean;
  homebrew: HomebrewResult[];
}

// =============================================================================
// Service
// =============================================================================

class CharactersDndbeyondService {
  /**
   * Import a character from D&D Beyond.
   * Creates or updates a Character record and extracts homebrew content.
   */
  async importCharacter(userId: string, input: ImportInput): Promise<ImportResult> {
    // 1. Resolve DDB character ID
    const ddbCharacterId = this.resolveCharacterId(input);

    // 2. Resolve Cobalt token
    const cobaltToken = await this.resolveCobaltToken(userId, input.cobaltToken);

    // 3. Fetch from D&D Beyond API
    const ddbResponse = await this.fetchFromDDB(ddbCharacterId, cobaltToken);

    // 4. Map to our Character model
    const mapped = mapDnDBeyondToCharacter(ddbResponse);

    // 5. Check for existing character (dedup)
    const existing = await charactersDndbeyondRepository.findByDndBeyondId(mapped.dndBeyondId);

    let character;
    let created: boolean;

    if (existing) {
      // Verify ownership
      if (existing.userId !== userId) {
        throw new ForbiddenError('This D&D Beyond character belongs to another user');
      }
      // Update existing character
      character = await charactersDndbeyondRepository.updateFromSync(existing.id, mapped);
      created = false;
    } else {
      // Create new character
      character = await charactersDndbeyondRepository.createFromImport(userId, mapped);
      created = true;
    }

    // 6. Add to campaign if requested
    if (input.campaignId) {
      await this.ensureCampaignAssociation(character.id, input.campaignId);
    }

    // 7. Extract homebrew content
    const homebrew = await this.extractHomebrew(
      userId,
      ddbResponse,
      input.campaignId
    );

    return { character, created, homebrew };
  }

  /**
   * Re-sync an existing character from D&D Beyond.
   */
  async syncCharacter(userId: string, characterId: string): Promise<ImportResult> {
    const character = await characterRepository.findById(characterId);
    if (!character) {
      throw new NotFoundError('Character', characterId);
    }
    if (character.userId !== userId) {
      throw new ForbiddenError('You do not own this character');
    }
    if (!character.dndBeyondId) {
      throw new BadRequestError('This character is not linked to D&D Beyond');
    }

    // Resolve Cobalt token from user settings
    const cobaltToken = await this.resolveCobaltToken(userId);

    // Fetch fresh data
    const ddbResponse = await this.fetchFromDDB(character.dndBeyondId, cobaltToken);
    const mapped = mapDnDBeyondToCharacter(ddbResponse);

    // Update character
    const updated = await charactersDndbeyondRepository.updateFromSync(
      characterId,
      mapped
    );

    // Re-extract homebrew
    const campaignId = character.campaignCharacters?.[0]?.campaign?.id;
    const homebrew = await this.extractHomebrew(userId, ddbResponse, campaignId);

    return { character: updated, created: false, homebrew };
  }

  /**
   * Check if a D&D Beyond character has already been imported.
   */
  async checkDuplicate(userId: string, input: { url?: string; characterId?: string }) {
    const ddbId = input.characterId || (input.url ? extractCharacterIdFromUrl(input.url) : null);
    if (!ddbId) {
      throw new BadRequestError('Provide either a D&D Beyond URL or character ID');
    }

    const existing = await charactersDndbeyondRepository.findByDndBeyondId(ddbId);
    return {
      exists: !!existing,
      isOwned: existing?.userId === userId,
      character: existing?.userId === userId ? existing : null,
    };
  }

  /**
   * List all D&D Beyond-linked characters for a user.
   */
  async getLinkedCharacters(userId: string) {
    return charactersDndbeyondRepository.findDndBeyondLinked(userId);
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private resolveCharacterId(input: ImportInput): string {
    if (input.characterId) {
      return input.characterId;
    }
    if (input.url) {
      const id = extractCharacterIdFromUrl(input.url);
      if (!id) {
        throw new BadRequestError(
          'Could not extract character ID from URL. Expected format: https://www.dndbeyond.com/characters/12345678'
        );
      }
      return id;
    }
    throw new BadRequestError('Provide either a D&D Beyond URL or character ID');
  }

  private async resolveCobaltToken(
    userId: string,
    inputToken?: string
  ): Promise<string> {
    // Use explicitly provided token first
    if (inputToken) return inputToken;

    // Try user settings
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { dndBeyondCobaltCookie: true },
    });

    if (settings?.dndBeyondCobaltCookie) {
      return decrypt(settings.dndBeyondCobaltCookie);
    }

    throw new BadRequestError(
      'No D&D Beyond Cobalt token provided. Set it in Settings or provide it directly.'
    );
  }

  private async fetchFromDDB(characterId: string, cobaltToken: string) {
    const response = await fetchCharacterFromDDB(characterId, cobaltToken);

    if (!response.success || !response.data) {
      throw new BadRequestError(
        response.message || 'Failed to fetch character from D&D Beyond'
      );
    }

    return response.data;
  }

  private async ensureCampaignAssociation(
    characterId: string,
    campaignId: string
  ) {
    const existing = await characterRepository.findCampaignCharacterByIds(
      campaignId,
      characterId
    );
    if (!existing) {
      await characterRepository.addToCampaign(campaignId, characterId);
    }
  }

  private async extractHomebrew(
    userId: string,
    ddbResponse: any,
    campaignId?: string
  ): Promise<HomebrewResult[]> {
    const detected = detectHomebrew(ddbResponse);
    const results: HomebrewResult[] = [];

    const processItems = async (
      items: { name: string; dndBeyondId: number | null; data: any }[],
      type: string
    ) => {
      for (const item of items) {
        const ddbId = item.dndBeyondId != null ? String(item.dndBeyondId) : null;
        let isNew = true;

        // Check for existing homebrew
        if (ddbId) {
          const existing = await homebrewDndbeyondRepository.findByDnDBeyondId(
            userId,
            ddbId
          );
          if (existing) {
            isNew = false;
            results.push({ name: item.name, type, isNew: false });
            continue;
          }
        }

        // Create new homebrew content
        const searchText = this.generateSearchText(item.name, item.data);
        const content = await homebrewDndbeyondRepository.createFromImport({
          userId,
          type,
          name: item.name,
          data: item.data,
          tags: ['imported', 'dndbeyond', 'character-import'],
          searchText,
          dndBeyondId: ddbId || `char-${type}-${item.name}`,
          dndBeyondUrl: '',
        });

        // Link to campaign if specified
        if (campaignId && content) {
          try {
            await homebrewDndbeyondRepository.addToCampaign(
              content.id,
              campaignId
            );
          } catch {
            // Ignore duplicate campaign association
          }
        }

        results.push({ name: item.name, type, isNew });
      }
    };

    await processItems(detected.items, 'item');
    await processItems(detected.spells, 'spell');
    await processItems(detected.feats, 'feat');

    return results;
  }

  private generateSearchText(name: string, data: any): string {
    const parts = [name];

    if (typeof data === 'object' && data !== null) {
      if (data.description) parts.push(data.description);
      if (data.snippet) parts.push(data.snippet);
      if (data.name && data.name !== name) parts.push(data.name);
    }

    return parts.join(' ').toLowerCase().slice(0, 5000);
  }
}

export const charactersDndbeyondService = new CharactersDndbeyondService();
