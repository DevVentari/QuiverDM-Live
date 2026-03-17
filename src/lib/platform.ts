import { PlatformRole } from '@prisma/client';

export const PLATFORM_ROLE_HIERARCHY: Record<PlatformRole, number> = {
  [PlatformRole.ADVENTURER]: 1,
  [PlatformRole.DUNGEON_MASTER]: 2,
  [PlatformRole.WARDEN]: 3,
  [PlatformRole.MYTHKEEPER]: 4,
};

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  [PlatformRole.ADVENTURER]: 'Adventurer',
  [PlatformRole.DUNGEON_MASTER]: 'Dungeon Master',
  [PlatformRole.WARDEN]: 'Warden',
  [PlatformRole.MYTHKEEPER]: 'Mythkeeper',
};

export const PLAN_LABELS: Record<string, string> = {
  free: 'Wanderer',
  pro: 'Hero',
  alpha: 'Alpha',
  team: 'Fellowship',
};

export function hasMinimumRole(userRole: PlatformRole, requiredRole: PlatformRole): boolean {
  return PLATFORM_ROLE_HIERARCHY[userRole] >= PLATFORM_ROLE_HIERARCHY[requiredRole];
}

export function canPromoteTo(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  if (targetRole === PlatformRole.WARDEN || targetRole === PlatformRole.MYTHKEEPER) {
    return actorRole === PlatformRole.MYTHKEEPER;
  }
  return hasMinimumRole(actorRole, PlatformRole.WARDEN);
}

export function canDemoteFrom(actorRole: PlatformRole, targetRole: PlatformRole): boolean {
  if (targetRole === PlatformRole.WARDEN || targetRole === PlatformRole.MYTHKEEPER) {
    return actorRole === PlatformRole.MYTHKEEPER;
  }
  return hasMinimumRole(actorRole, PlatformRole.WARDEN);
}
