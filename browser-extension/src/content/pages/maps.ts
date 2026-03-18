import type { ExtCombatStartMessage, ExtCombatEndMessage } from '../../shared/extension-types';

let combatActive = false;

function getSessionId(): string | null {
  return null; // placeholder — implement session association flow
}

export function handleMapsPage() {
  const observer = new MutationObserver(() => {
    const initiativePanel = document.querySelector('[class*="initiative-tracker"], [data-testid="initiative"]');
    const inCombat = !!initiativePanel;

    if (inCombat && !combatActive) {
      combatActive = true;
      const sessionId = getSessionId();
      if (!sessionId) return;

      const event: ExtCombatStartMessage = {
        type: 'ext.combat.start',
        sessionId,
        initiativeOrder: [],
      };
      chrome.runtime.sendMessage({ type: 'live.event', extMessage: event });
    }

    if (!inCombat && combatActive) {
      combatActive = false;
      const sessionId = getSessionId();
      if (!sessionId) return;

      const event: ExtCombatEndMessage = { type: 'ext.combat.end', sessionId };
      chrome.runtime.sendMessage({ type: 'live.event', extMessage: event });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
