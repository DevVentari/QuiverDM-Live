/**
 * Campaign Service
 *
 * Business logic layer for campaign operations.
 * Handles authorization, data transformation, and orchestrates repositories.
 */

import { TRPCError } from '@trpc/server';
import { NotFoundError, ValidationError } from '../errors';
import { CampaignRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { campaignRepository } from '../repositories/campaign.repository';
import { authz, type CampaignAccess } from './authorization.service';
import { generateUniqueSlug } from '@/lib/utils/slugify';
import { usageService } from './usage.service';

// =============================================================================
// Types
// =============================================================================

export interface CreateCampaignInput {
  name: string;
  description?: string;
  bannerUrl?: string;
  settings?: {
    gameSystem?: string;
    settingName?: string;
    playerCount?: number;
    startingLevel?: number;
    schedule?: {
      day?: string;
      time?: string;
      frequency?: string;
    };
    houseRules?: string;
    themes?: string[];
  };
  players?: Array<{ name: string; characterName: string }>;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  bannerUrl?: string;
  status?: 'planning' | 'active' | 'completed' | 'archived';
  glossary?: Record<string, string>;
}

export interface CampaignListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  myRole: CampaignRole | null;
  myPermissions: {
    role: CampaignRole;
    canViewNPCSecrets: boolean;
    canEditNPCs: boolean;
    canManageSessions: boolean;
    canInviteMembers: boolean;
  } | null;
  _count: {
    gameSessions: number;
    npcs: number;
    players: number;
    members: number;
  };
}

export interface DashboardCampaign {
  id: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: CampaignRole;
  permissions: {
    canViewNPCSecrets: boolean;
    canEditNPCs: boolean;
    canManageSessions: boolean;
    canInviteMembers: boolean;
  };
  sessionCount: number;
  memberCount: number;
  npcCount: number;
  locationCount: number;
  itemCount: number;
  nextSession: {
    id: string;
    date: Date;
    title: string | null;
    sessionNumber: number | null;
  } | null;
  lastSessionDate: Date | null;
  myCharacter: {
    id: string;
    name: string;
    class: string | null;
    level: number;
    portraitUrl: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Service Class
// =============================================================================

export class CampaignService {
  /**
   * Get all campaigns for a user
   */
  async getAll(userId: string): Promise<CampaignListItem[]> {
    const campaigns = await campaignRepository.findByUser(userId);

    return campaigns.map((campaign) => ({
      ...campaign,
      myRole:
        campaign.members[0]?.role ||
        (campaign.userId === userId ? CampaignRole.OWNER : null),
      myPermissions: campaign.members[0] || null,
    }));
  }

  /**
   * Get a campaign by ID with authorization check
   */
  async getById(campaignId: string, userId: string) {
    const access = await authz.campaign(campaignId, userId).verify();
    const canViewSecrets =
      access.isDM || access.member?.permissions.canViewNPCSecrets || false;

    const campaign = await campaignRepository.findWithDetails(
      campaignId,
      canViewSecrets
    );

    if (!campaign) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      });
    }

    return {
      ...campaign,
      myRole:
        access.member?.role || (access.isOwner ? CampaignRole.OWNER : null),
      myPermissions: access.member,
    };
  }

  /**
   * Get a campaign by slug with authorization check
   */
  async getBySlug(slug: string, userId: string) {
    const campaignBasic = await campaignRepository.findBySlug(slug);

    if (!campaignBasic) {
      throw new NotFoundError('campaign', slug);
    }

    return this.getById(campaignBasic.id, userId);
  }

  /**
   * Create a new campaign
   */
  async create(userId: string, input: CreateCampaignInput) {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw ValidationError.forField('name', 'Campaign name is required');
    }

    // Check usage limits before creating campaign
    await usageService.incrementCampaigns(userId);

    // Generate unique slug
    const slug = await generateUniqueSlug(normalizedName, async (slug) => {
      return campaignRepository.slugExists(slug);
    });

    try {
      const campaign = await campaignRepository.create({
        name: normalizedName,
        slug,
        description: input.description,
        bannerUrl: input.bannerUrl,
        userId,
        settings: input.settings ?? undefined,
        players: input.players,
      });

      return campaign;
    } catch (error) {
      // If campaign creation fails, decrement the usage count
      await usageService.decrementCampaigns(userId);
      throw error;
    }
  }

  /**
   * Update a campaign (requires owner access)
   */
  async update(campaignId: string, userId: string, input: UpdateCampaignInput) {
    await authz.campaign(campaignId, userId).requireOwner();

    const updateData: Record<string, any> = { ...input };

    if ('bannerUrl' in updateData) {
      updateData.bannerUrl = updateData.bannerUrl || null;
    }

    // If name is being updated, regenerate slug
    if (input.name) {
      updateData.slug = await generateUniqueSlug(input.name, async (slug) => {
        return campaignRepository.slugExists(slug, campaignId);
      });
    }

    return campaignRepository.update(campaignId, updateData);
  }

  /**
   * Delete a campaign (requires owner access)
   */
  async delete(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).requireOwner();
    await campaignRepository.remove(campaignId);

    // Decrement usage count when campaign is deleted
    await usageService.decrementCampaigns(userId);

    return { success: true };
  }

  /**
   * Get campaign statistics
   */
  async getStats(campaignId: string, userId: string) {
    await authz.campaign(campaignId, userId).verify();
    return campaignRepository.getStats(campaignId);
  }

  /**
   * Get dashboard-optimized campaign data for user
   */
  async getDashboardCampaigns(userId: string): Promise<DashboardCampaign[]> {
    const memberships = await campaignRepository.getUserMemberships(userId);
    const campaignIds = memberships.map((m) => m.campaignId);

    const [characters, lastSessions, entityCounts, knownNpcCounts] = await Promise.all([
      campaignRepository.getUserCharactersInCampaigns(userId, campaignIds),
      campaignRepository.getLastSessionDates(campaignIds),
      // Count only "known" entities: DM-created (no DDB chapter source) OR
      // entities the party has actually encountered in a session. This filters
      // out the flood of sourcebook entities that ingestion creates but the
      // campaign hasn't touched yet.
      campaignIds.length === 0
        ? Promise.resolve([] as Array<{ campaignId: string; type: string; _count: { _all: number } }>)
        : prisma.worldEntity.groupBy({
            by: ['campaignId', 'type'],
            where: {
              campaignId: { in: campaignIds },
              OR: [
                { ddbChapterId: null },
                { firstSeenSessionId: { not: null } },
              ],
            },
            _count: { _all: true },
          }),
      campaignIds.length === 0
        ? Promise.resolve([] as Array<{ campaignId: string; _count: { _all: number } }>)
        : prisma.worldEntity.groupBy({
            by: ['campaignId'],
            where: {
              campaignId: { in: campaignIds },
              type: 'NPC',
              OR: [
                { ddbChapterId: null },
                { firstSeenSessionId: { not: null } },
              ],
            },
            _count: { _all: true },
          }),
    ]);

    const charMap = new Map(
      characters.map((cc) => [cc.campaignId, cc.character])
    );
    const lastSessionMap = new Map(
      lastSessions.map((s) => [s.campaignId, s.date])
    );
    const locationMap = new Map<string, number>();
    const itemMap = new Map<string, number>();
    for (const row of entityCounts) {
      if (row.type === 'LOCATION') locationMap.set(row.campaignId, row._count._all);
      else if (row.type === 'ITEM') itemMap.set(row.campaignId, row._count._all);
    }
    // NPC count = NPC table rows + "known" WorldEntity NPCs (DDB-imported NPCs
    // that the party has encountered, or DM-created NPC entities).
    const knownNpcEntityMap = new Map<string, number>();
    for (const row of knownNpcCounts) {
      knownNpcEntityMap.set(row.campaignId, row._count._all);
    }

    return memberships.map((m) => ({
      id: m.campaign.id,
      name: m.campaign.name,
      slug: m.campaign.slug,
      bannerUrl: m.campaign.bannerUrl,
      role: m.role,
      permissions: {
        canViewNPCSecrets: m.canViewNPCSecrets,
        canEditNPCs: m.canEditNPCs,
        canManageSessions: m.canManageSessions,
        canInviteMembers: m.canInviteMembers,
      },
      sessionCount: m.campaign._count.gameSessions,
      memberCount: m.campaign._count.members,
      npcCount: m.campaign._count.npcs + (knownNpcEntityMap.get(m.campaignId) ?? 0),
      locationCount: locationMap.get(m.campaignId) ?? 0,
      itemCount: itemMap.get(m.campaignId) ?? 0,
      nextSession: m.campaign.gameSessions[0] ?? null,
      lastSessionDate: lastSessionMap.get(m.campaignId) ?? null,
      myCharacter: charMap.get(m.campaignId) ?? null,
      createdAt: m.campaign.createdAt,
      updatedAt: m.campaign.updatedAt,
    }));
  }

  /**
   * Resolve the active campaign for a user.
   *
   * Priority:
   *   1. UserSettings.activeCampaignId, if set AND user is still a member of that campaign
   *   2. Most-recent-activity auto-derive (lastSessionDate ?? updatedAt)
   *   3. null when the user has no campaigns
   *
   * Returns the same DashboardCampaign shape as getDashboardCampaigns so the
   * client doesn't need to map between two types.
   */
  async getActiveCampaign(userId: string): Promise<DashboardCampaign | null> {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { activeCampaignId: true },
    });

    const dashboard = await this.getDashboardCampaigns(userId);
    if (dashboard.length === 0) return null;

    const explicitId = settings?.activeCampaignId ?? null;
    if (explicitId) {
      const explicit = dashboard.find((c) => c.id === explicitId);
      if (explicit) return explicit;
      // Stored id is stale (left/removed). Fall through to auto-derive.
    }

    return dashboard
      .slice()
      .sort((a, b) => {
        const aDate = a.lastSessionDate ?? a.updatedAt;
        const bDate = b.lastSessionDate ?? b.updatedAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })[0];
  }

  /**
   * Get pending campaign invites for a user
   */
  async getPendingInvites(userEmail: string | null | undefined) {
    if (!userEmail) {
      return [];
    }

    const invites = await campaignRepository.getPendingInvites(userEmail);

    return invites.map((invite) => ({
      id: invite.id,
      campaignId: invite.campaign.id,
      campaignName: invite.campaign.name,
      campaignSlug: invite.campaign.slug,
      campaignBannerUrl: invite.campaign.bannerUrl,
      role: invite.role,
      message: invite.message,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    }));
  }

  /**
   * Accept a campaign invite
   */
  async acceptInvite(inviteId: string, userId: string, userEmail: string | null | undefined) {
    if (!userEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User email not found',
      });
    }

    // Find the invite
    const invite = await campaignRepository.findValidInvite(inviteId, userEmail);

    if (!invite) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invite not found or expired',
      });
    }

    // Check if already a member
    const existingMember = await campaignRepository.findMembership(invite.campaignId, userId);

    if (existingMember) {
      // Mark invite as used
      await campaignRepository.markInviteUsed(invite.id, userId);

      throw new TRPCError({
        code: 'CONFLICT',
        message: 'You are already a member of this campaign',
      });
    }

    // Create membership and mark invite as used
    await campaignRepository.acceptInvite(invite.id, invite.campaignId, userId, invite.role);

    return { success: true, campaignId: invite.campaignId };
  }

  /**
   * Decline a campaign invite
   */
  async declineInvite(inviteId: string, userEmail: string | null | undefined) {
    if (!userEmail) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User email not found',
      });
    }

    // Find the invite
    const invite = await campaignRepository.findInvite(inviteId, userEmail);

    if (!invite) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Invite not found',
      });
    }

    // Delete the invite
    await campaignRepository.deleteInvite(invite.id);

    return { success: true };
  }
}

// Singleton instance
export const campaignService = new CampaignService();

