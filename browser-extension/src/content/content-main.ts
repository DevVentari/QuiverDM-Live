import { handleMonsterPage } from './pages/monster';
import { handleCharacterPage } from './pages/character';
import { handleSpellPage } from './pages/spell';
import { handleItemPage } from './pages/item';
import { handleEncounterPage } from './pages/encounter';
import { handleMapsPage } from './pages/maps';

function injectPageWorld() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/content/page-world.ts');
  script.type = 'module';
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

function routePage() {
  const path = window.location.pathname;

  if (/^\/characters\/\d+/.test(path)) { handleCharacterPage(); return; }
  if (/^\/monsters\/\d+/.test(path)) { handleMonsterPage(); return; }
  if (/^\/spells\/\d+/.test(path)) { handleSpellPage(); return; }
  if (/^\/magic-items\/\d+/.test(path)) { handleItemPage(); return; }
  if (/^\/encounters\/\d+/.test(path)) { handleEncounterPage(); return; }
  if (/^\/maps/.test(path)) { handleMapsPage(); return; }
  if (/^\/sources\//.test(path)) { handleMonsterPage(); return; }
}

// Listen for messages from page-world.ts (MAIN world → isolated world relay)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'quiverdm-page-world') return;
  // Forward intercepted network data to service worker for live bridge
  chrome.runtime.sendMessage({ type: 'network.intercept', url: event.data.url, body: event.data.body });
});

injectPageWorld();
routePage();

let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    document.querySelectorAll('[data-quiverdm-btn]').forEach(el => el.remove());
    routePage();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
