import type { VoiceIntent } from './intent-classifier';
import { rollDice } from '@/lib/dice';

export interface ActionResult {
  response: string;
  navigateTo?: string;
}

const ROUTE_MAP: Record<string, string> = {
  brain: '/brain',
  sessions: '/sessions',
  npcs: '/npcs',
  npc: '/npcs',
  encounters: '/encounters',
  encounter: '/encounters',
  homebrew: '/homebrew',
  players: '/players',
  dashboard: '/dashboard',
  campaigns: '/campaigns',
  settings: '/settings',
};

function resolveNavigationRoute(target: string, campaignSlug: string | null): string | undefined {
  const lower = target.toLowerCase();

  if (lower === 'dashboard' || lower === 'home') {
    return '/dashboard';
  }

  if (lower === 'campaigns') {
    return '/campaigns';
  }

  if (lower === 'settings') {
    return '/settings';
  }

  if (campaignSlug) {
    for (const [keyword, path] of Object.entries(ROUTE_MAP)) {
      if (lower.includes(keyword)) {
        return `/campaigns/${campaignSlug}${path}`;
      }
    }
    return `/campaigns/${campaignSlug}`;
  }

  return undefined;
}

function resolveDiceRoll(target: string): string {
  const notation = target.match(/\d*d\d+(?:[+-]\d+)?/i)?.[0] ?? 'd20';
  try {
    const result = rollDice(notation);
    const parts: string[] = [];
    if (result.rolls.length > 1) {
      parts.push(`Rolls: ${result.rolls.join(', ')}`);
    }
    if (result.modifier !== 0) {
      parts.push(`Modifier: ${result.modifier > 0 ? '+' : ''}${result.modifier}`);
    }
    parts.push(`Total: ${result.total}`);
    if (result.isCritical) parts.push('Critical hit!');
    if (result.isFumble) parts.push('Critical fail!');
    return `Rolling ${notation}. ${parts.join('. ')}.`;
  } catch {
    return `Could not parse dice notation "${notation}". Try something like "roll 1d20" or "roll 2d6+3".`;
  }
}

function resolveCreateRoute(target: string, campaignSlug: string | null): string | undefined {
  const lower = target.toLowerCase();
  if (!campaignSlug) return undefined;

  if (lower.includes('npc')) return `/campaigns/${campaignSlug}/npcs/new`;
  if (lower.includes('session')) return `/campaigns/${campaignSlug}/sessions/new`;
  if (lower.includes('encounter')) return `/campaigns/${campaignSlug}/encounters/new`;
  if (lower.includes('campaign')) return '/campaigns/new';

  return undefined;
}

export function routeAction(
  intent: VoiceIntent,
  campaignSlug: string | null,
): ActionResult {
  switch (intent.type) {
    case 'navigate': {
      const route = resolveNavigationRoute(intent.target, campaignSlug);
      if (route) {
        return { response: `Navigating to ${intent.target}.`, navigateTo: route };
      }
      return { response: `I don't know how to navigate to "${intent.target}".` };
    }

    case 'dice_roll': {
      return { response: resolveDiceRoll(intent.target) };
    }

    case 'create': {
      const route = resolveCreateRoute(intent.target, campaignSlug);
      if (route) {
        return { response: `Opening the create form for ${intent.target}.`, navigateTo: route };
      }
      return { response: `I'm not sure how to create "${intent.target}".` };
    }

    case 'search':
    case 'query':
    case 'unknown':
      return { response: '' };
  }
}
