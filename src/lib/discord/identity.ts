/**
 * Discord voice → player → character identity resolver.
 *
 * The payoff of Discord auth: every voice stream is keyed by a Discord user id,
 * and that id already maps (via the NextAuth `Account` table) to a QuiverDM user,
 * whose active `CampaignCharacter` gives us a real character name. So a recorded
 * track can be labelled "Kira" instead of "Speaker 0" — automatic, correct
 * diarization with zero DM bookkeeping.
 *
 * Resolution precedence for (campaignId, discordUserId):
 *   1. An existing SpeakerMapping for this label — the DM may have overridden it; honour it.
 *   2. Account(provider='discord') → QuiverDM user.
 *      a. CampaignMember role → is this person the DM?
 *      b. Active CampaignCharacter for that user → character name.
 *   3. Unknown Discord user → the caller's fallback label ("Speaker N").
 *
 * On a successful identity resolution we upsert the SpeakerMapping so the existing
 * merge/recap path (speaker-mapping-utils.ts) already keys off it downstream.
 *
 * The DB surface is injected (defaulting to the real prisma client) so the
 * precedence logic is unit-testable without a live database.
 */

import { prisma } from '@/lib/prisma';

const DM_ROLES = new Set(['OWNER', 'CO_DM']);

export interface ResolvedSpeaker {
  /** Stable key for this speaker — the Discord user id. */
  speakerLabel: string;
  characterId: string | null;
  /** Resolved character name, the DM's display name, or the fallback label. */
  characterName: string;
  /** QuiverDM user id, or null when the Discord user isn't linked. */
  userId: string | null;
  isDM: boolean;
}

/** Minimal slice of the prisma client this resolver needs — injectable for tests. */
export interface IdentityDb {
  speakerMapping: {
    findUnique(args: {
      where: { campaignId_speakerLabel: { campaignId: string; speakerLabel: string } };
    }): Promise<{ characterId: string | null; characterName: string; isDM: boolean } | null>;
    upsert(args: {
      where: { campaignId_speakerLabel: { campaignId: string; speakerLabel: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  account: {
    findUnique(args: {
      where: { provider_providerAccountId: { provider: string; providerAccountId: string } };
      include: { user: true };
    }): Promise<{ userId: string; user: { name: string | null } | null } | null>;
  };
  campaignMember: {
    findUnique(args: {
      where: { campaignId_userId: { campaignId: string; userId: string } };
    }): Promise<{ role: string } | null>;
  };
  campaignCharacter: {
    findFirst(args: {
      where: { campaignId: string; status: 'ACTIVE'; character: { userId: string } };
      select: { character: { select: { id: true; name: true } } };
    }): Promise<{ character: { id: string; name: string } } | null>;
  };
}

export interface ResolveOptions {
  /** Label to use when the Discord user can't be resolved (e.g. "Speaker 2"). */
  fallbackLabel?: string;
  /** Persist a SpeakerMapping on successful resolution (default true). */
  persist?: boolean;
}

export async function resolveDiscordVoiceToCharacter(
  campaignId: string,
  discordUserId: string,
  options: ResolveOptions = {},
  db: IdentityDb = prisma as unknown as IdentityDb
): Promise<ResolvedSpeaker> {
  const speakerLabel = discordUserId;
  const fallbackName = options.fallbackLabel ?? `Speaker ${discordUserId}`;
  const persist = options.persist ?? true;

  // 1. Honour an existing (possibly DM-overridden) mapping.
  const existing = await db.speakerMapping.findUnique({
    where: { campaignId_speakerLabel: { campaignId, speakerLabel } },
  });
  if (existing) {
    return {
      speakerLabel,
      characterId: existing.characterId,
      characterName: existing.characterName,
      userId: null,
      isDM: existing.isDM,
    };
  }

  // 2. Resolve the Discord user → QuiverDM user.
  const account = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: 'discord', providerAccountId: discordUserId } },
    include: { user: true },
  });

  // 3. Unknown Discord user — return the fallback, don't pollute the mapping table.
  if (!account) {
    return { speakerLabel, characterId: null, characterName: fallbackName, userId: null, isDM: false };
  }

  const member = await db.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId: account.userId } },
  });
  const isDM = member ? DM_ROLES.has(member.role) : false;

  const active = await db.campaignCharacter.findFirst({
    where: { campaignId, status: 'ACTIVE', character: { userId: account.userId } },
    select: { character: { select: { id: true, name: true } } },
  });

  const characterId = active?.character.id ?? null;
  const characterName =
    active?.character.name ?? account.user?.name ?? (isDM ? 'DM' : fallbackName);

  if (persist) {
    await db.speakerMapping.upsert({
      where: { campaignId_speakerLabel: { campaignId, speakerLabel } },
      create: { campaignId, speakerLabel, characterId, characterName, isDM },
      update: { characterId, characterName, isDM },
    });
  }

  return { speakerLabel, characterId, characterName, userId: account.userId, isDM };
}
