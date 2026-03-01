/**
 * Character Service
 *
 * Business logic for character management.
 * Uses authorization service and character repository.
 */

import { TRPCError } from '@trpc/server';
import { CharacterStatus } from '@prisma/client';
import {
  characterRepository,
  CreateCharacterInput,
  UpdateCharacterInput,
} from '../repositories/character.repository';
import { authz } from './authorization.service';
import { prisma } from '../db';
import { NotFoundError, ForbiddenError } from '../errors';

export class CharacterService {
  // ===========================================================================
  // CHARACTER QUERIES
  // ===========================================================================

  /**
   * Get all characters owned by a user
   */
  async getMyCharacters(userId: string) {
    return characterRepository.findByUserId(userId);
  }

  /**
   * Get a character by ID (owner only)
   */
  async getById(characterId: string, userId: string) {
    const character = await characterRepository.findById(characterId);

    if (!character) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found',
      });
    }

    if (character.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this character',
      });
    }

    return character;
  }

  /**
   * Get characters in a campaign (filtered by role)
   */
  async getCampaignCharacters(
    campaignId: string,
    userId: string,
    membership: { isOwner: boolean; isCoOwner: boolean }
  ) {
    const campaignCharacters = await characterRepository.findByCampaignId(campaignId);
    const isDM = membership.isOwner || membership.isCoOwner;

    return campaignCharacters
      .map((cc) => ({
        ...cc,
        // Hide DM notes from players
        dmNotes: isDM ? cc.dmNotes : null,
        // Mark pending characters that should be hidden from other players
        ...(cc.status === CharacterStatus.PENDING &&
        !isDM &&
        cc.character.userId !== userId
          ? { hidden: true }
          : {}),
      }))
      .filter((cc) => !('hidden' in cc));
  }

  // ===========================================================================
  // CHARACTER MUTATIONS
  // ===========================================================================

  /**
   * Create a new character
   */
  async create(userId: string, input: Omit<CreateCharacterInput, 'userId'>) {
    return characterRepository.create({ ...input, userId });
  }

  /**
   * Update a character (owner only)
   */
  async update(characterId: string, userId: string, input: UpdateCharacterInput) {
    const existing = await characterRepository.findOwnership(characterId);

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found',
      });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only edit your own characters',
      });
    }

    return characterRepository.update(characterId, input);
  }

  /**
   * Delete a character (owner only)
   */
  async delete(characterId: string, userId: string) {
    const existing = await characterRepository.findOwnership(characterId);

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found',
      });
    }

    if (existing.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only delete your own characters',
      });
    }

    await characterRepository.remove(characterId);
    return { success: true };
  }

  // ===========================================================================
  // CAMPAIGN CHARACTER MANAGEMENT
  // ===========================================================================

  /**
   * Add a character to a campaign (pending approval)
   */
  async addToCampaign(characterId: string, campaignId: string, userId: string) {
    // Verify user owns the character
    const character = await characterRepository.findOwnership(characterId);

    if (!character) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found',
      });
    }

    if (character.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only add your own characters to campaigns',
      });
    }

    // Verify user is a member of the campaign
    await authz.campaign(campaignId, userId).verify();

    // Check if character is already in this campaign
    const existing = await characterRepository.findCampaignCharacterByIds(
      campaignId,
      characterId
    );

    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Character is already in this campaign',
      });
    }

    // If character is not portable, check if it's in another campaign
    if (!character.isPortable) {
      const otherCampaign = await characterRepository.findActiveInOtherCampaign(characterId);

      if (otherCampaign) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This character is locked to another campaign and cannot be added here',
        });
      }
    }

    return characterRepository.addToCampaign(campaignId, characterId);
  }

  /**
   * Approve a character in a campaign (DM only)
   */
  async approveCharacter(campaignCharacterId: string, campaignId: string) {
    const campaignCharacter = await characterRepository.findCampaignCharacter(
      campaignCharacterId
    );

    if (!campaignCharacter || campaignCharacter.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found in this campaign',
      });
    }

    if (campaignCharacter.status !== CharacterStatus.PENDING) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Character is not pending approval',
      });
    }

    return characterRepository.updateCampaignCharacter(campaignCharacterId, {
      status: CharacterStatus.ACTIVE,
    });
  }

  /**
   * Update campaign character status (DM only)
   */
  async updateCampaignStatus(
    campaignCharacterId: string,
    campaignId: string,
    status: CharacterStatus,
    dmNotes?: string
  ) {
    const campaignCharacter = await characterRepository.findCampaignCharacter(
      campaignCharacterId
    );

    if (!campaignCharacter || campaignCharacter.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found in this campaign',
      });
    }

    return characterRepository.updateCampaignCharacter(campaignCharacterId, {
      status,
      dmNotes,
      isActive: status === CharacterStatus.ACTIVE,
    });
  }

  /**
   * Remove a character from a campaign (DM or character owner)
   */
  async removeFromCampaign(campaignCharacterId: string, userId: string) {
    const campaignCharacter = await characterRepository.findCampaignCharacter(
      campaignCharacterId
    );

    if (!campaignCharacter) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Campaign character not found',
      });
    }

    // Check if user is DM or character owner
    const access = await authz
      .campaign(campaignCharacter.campaignId, userId)
      .verify();

    const isCharacterOwner = campaignCharacter.character.userId === userId;

    if (!access.isDM && !isCharacterOwner) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to remove this character',
      });
    }

    await characterRepository.removeFromCampaign(campaignCharacterId);
    return { success: true };
  }

  /**
   * Update DM notes for a campaign character (DM only)
   */
  async updateDMNotes(
    campaignCharacterId: string,
    campaignId: string,
    dmNotes: string
  ) {
    const campaignCharacter = await characterRepository.findCampaignCharacter(
      campaignCharacterId
    );

    if (!campaignCharacter || campaignCharacter.campaignId !== campaignId) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Character not found in this campaign',
      });
    }

    return characterRepository.updateCampaignCharacter(campaignCharacterId, {
      dmNotes,
    });
  }

  // ===========================================================================
  // HOMEBREW EFFECTS
  // ===========================================================================

  /**
   * Get all equipped homebrew item effects for a character
   */
  async getEquippedEffects(characterId: string, userId: string) {
    const character = await prisma.character.findUnique({
      where: { id: characterId }, select: { userId: true }
    });
    if (!character) throw new NotFoundError('character', characterId);
    if (character.userId !== userId) throw ForbiddenError.forPermission('view', 'Character');

    const items = await prisma.characterItem.findMany({
      where: { characterId, equipped: true },
      include: { homebrew: { select: { id: true, name: true, data: true } } },
    });

    return items.map((ci) => {
      const data = ci.homebrew.data as Record<string, unknown>;
      const raw = data.effects;
      const effects = Array.isArray(raw)
        ? (raw as unknown[]).filter(
            (e): e is { name: string; description: string } =>
              typeof (e as any)?.name === 'string' && typeof (e as any)?.description === 'string'
          )
        : [];
      return { itemName: ci.homebrew.name, itemId: ci.homebrew.id, equipped: ci.equipped, attuned: ci.attuned, effects };
    });
  }

  async getResolvedEffectSources(characterId: string, userId: string): Promise<import('@/server/services/effect-resolver').RawEffectSource[]> {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    if (!character) throw new NotFoundError('character', characterId);
    if (character.userId !== userId) throw ForbiddenError.forPermission('view', 'Character');

    const [items, spells, feats] = await Promise.all([
      prisma.characterItem.findMany({
        where: { characterId, equipped: true },
        include: { homebrew: { select: { id: true, name: true, data: true } } },
      }),
      prisma.characterSpell.findMany({
        where: { characterId },
        include: { homebrew: { select: { id: true, name: true, data: true } } },
      }),
      prisma.characterFeat.findMany({
        where: { characterId },
        include: { homebrew: { select: { id: true, name: true, data: true } } },
      }),
    ]);

    const toSource = (
      type: 'item' | 'spell' | 'feat',
      id: string,
      name: string,
      data: Record<string, unknown>,
      active: boolean
    ): import('@/server/services/effect-resolver').RawEffectSource => ({
      sourceId: id,
      sourceName: name,
      sourceType: type,
      active,
      effects: Array.isArray(data.effects)
        ? (data.effects as unknown[]).filter(
            (e): e is import('@/lib/dnd-schemas').ItemEffect =>
              typeof e === 'object' && e !== null && typeof (e as any)?.mechanic === 'string'
          )
        : [],
    });

    return [
      ...items.map((ci) =>
        toSource('item', ci.homebrew.id, ci.homebrew.name, ci.homebrew.data as Record<string, unknown>, ci.equipped)
      ),
      ...spells.map((cs) =>
        toSource('spell', cs.homebrew.id, cs.homebrew.name, cs.homebrew.data as Record<string, unknown>, true)
      ),
      ...feats.map((cf) =>
        toSource('feat', cf.homebrew.id, cf.homebrew.name, cf.homebrew.data as Record<string, unknown>, true)
      ),
    ];
  }
}

export const characterService = new CharacterService();
