export function getPageContext(pathname: string): string[] {
  const base = [
    'ask a question',
    'find an entity',
    'roll dice',
  ];

  if (/\/campaigns\/[^/]+\/brain/.test(pathname)) {
    return [...base, 'navigate to sessions', 'navigate to npcs', 'navigate to encounters'];
  }

  if (/\/campaigns\/[^/]+\/sessions/.test(pathname)) {
    return [...base, 'navigate to brain', 'navigate to npcs', 'navigate to encounters'];
  }

  if (/\/campaigns\/[^/]+\/npcs/.test(pathname)) {
    return [...base, 'navigate to brain', 'navigate to sessions', 'create npc'];
  }

  if (/\/campaigns\/[^/]+\/encounters/.test(pathname)) {
    return [...base, 'navigate to npcs', 'navigate to brain', 'create encounter'];
  }

  if (/\/campaigns\/[^/]+/.test(pathname)) {
    return [...base, 'navigate to brain', 'navigate to sessions', 'navigate to npcs', 'navigate to encounters'];
  }

  if (/\/campaigns/.test(pathname)) {
    return [...base, 'navigate to dashboard', 'create campaign'];
  }

  return [...base, 'navigate to campaigns', 'navigate to dashboard'];
}
