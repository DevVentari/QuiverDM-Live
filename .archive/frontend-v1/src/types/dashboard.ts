import { CampaignRole } from '@prisma/client';

/**
 * Dashboard types for the unified player/DM dashboard
 */

export interface DashboardCampaignPermissions {
  canViewNPCSecrets: boolean;
  canEditNPCs: boolean;
  canManageSessions: boolean;
  canInviteMembers: boolean;
}

export interface DashboardCampaignSession {
  id: string;
  date: Date | string;  // Can be string when serialized over tRPC
  title: string | null;
  sessionNumber: number;
}

export interface DashboardCampaignCharacter {
  id: string;
  name: string;
  class: string | null;
  level: number;
  portraitUrl: string | null;
}

export interface DashboardCampaign {
  id: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: CampaignRole;
  permissions: DashboardCampaignPermissions;
  sessionCount: number;
  memberCount: number;
  nextSession: DashboardCampaignSession | null;
  lastSessionDate: Date | string | null;
  myCharacter: DashboardCampaignCharacter | null;
  updatedAt: Date | string;
}

export interface DashboardCharacterCampaign {
  campaign: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface DashboardCharacter {
  id: string;
  name: string;
  race: string | null;
  class: string | null;
  level: number;
  portraitUrl: string | null;
  campaignCharacters: DashboardCharacterCampaign[];
}

export interface DashboardPendingInvite {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignBannerUrl: string | null;
  role: CampaignRole;
  message: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Role display helpers
 */
export const ROLE_BADGES: Record<CampaignRole, { emoji: string; label: string }> = {
  OWNER: { emoji: '👑', label: 'DM' },
  CO_DM: { emoji: '👥', label: 'Co-DM' },
  PLAYER: { emoji: '🎭', label: 'Player' },
  SPECTATOR: { emoji: '👁️', label: 'Spectator' },
};

export function isDMRole(role: CampaignRole): boolean {
  return role === 'OWNER' || role === 'CO_DM';
}
