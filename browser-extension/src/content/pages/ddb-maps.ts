import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';
import { showCampaignPicker } from '../../ui/campaign-picker';
import type { CampaignOption } from '../../shared/types';

// ── Embedded mode ─────────────────────────────────────────────────────────────
// When DnDB VTT is loaded inside the QuiverDM iframe (?quiver=1), hide all
// UI chrome and leave only the canvas.

const EMBED_PARAM = 'quiver';

const HIDDEN_SELECTORS = [
  // DnD Beyond VTT app chrome — covers both current and legacy layouts
  'header',
  'nav[role="navigation"]',
  '[class*="Navbar"]',
  '[class*="AppBar"]',
  '[class*="Header"]',
  '[class*="sidebar"]',
  '[class*="Sidebar"]',
  '[class*="ToolBar"]',
  '[class*="toolbar"]',
  '[class*="StatusBar"]',
  '[class*="statusbar"]',
  '[class*="SidePanel"]',
  '[class*="PlayerList"]',
  '[class*="InitiativeTracker"]',
  '.ct-navigation',
  '.site-bar',
  '.ddb-campaigns-detail-header',
].join(', ');

function injectEmbedStyles() {
  if (document.getElementById('quiver-embed-styles')) return;
  const style = document.createElement('style');
  style.id = 'quiver-embed-styles';
  style.textContent = `
    ${HIDDEN_SELECTORS} { display: none !important; }
    body { overflow: hidden !important; }
  `;
  document.head.appendChild(style);
}

// ── Standalone mode ──────────────────────────────────────────────────────────
// Inject a "Send to QuiverDM" button on maps.dndbeyond.com so the DM can
// connect the current game URL to their campaign's World Map.

async function getCampaigns(): Promise<CampaignOption[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get.campaigns' }, (res: CampaignOption[]) => {
      resolve(res ?? []);
    });
  });
}

async function sendUrlToQuiverDM(campaignId: string, url: string, btn: HTMLButtonElement) {
  setButtonState(btn, 'loading');
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'set.ddb.vtt.url', campaignId, url },
      (res: { ok: boolean; error?: string }) => resolve(res ?? { ok: false, error: 'No response' })
    );
  });

  if (result.ok) {
    setButtonState(btn, 'success', 'Linked!');
    showToast('DnD Beyond VTT linked to QuiverDM. Open the World Map to view.');
  } else {
    setButtonState(btn, 'error', 'Failed');
    showToast(result.error ?? 'Failed to link', 'error');
  }
}

function injectConnectButton() {
  if (document.querySelector('[data-quiverdm-btn="ddb-maps"]')) return;

  // Wait for the DnDB VTT top bar to render
  const anchor =
    document.querySelector('.MuiToolbar-root') ??
    document.querySelector('[class*="Toolbar"]') ??
    document.querySelector('header') ??
    document.body;

  const btn = createImportButton('Send to QuiverDM');
  btn.setAttribute('data-quiverdm-btn', 'ddb-maps');
  btn.style.cssText += 'position:fixed;top:10px;right:16px;z-index:999999;';
  anchor.appendChild(btn);

  btn.addEventListener('click', async () => {
    const campaigns = await getCampaigns();
    if (campaigns.length === 0) {
      showToast('Sign in to QuiverDM first', 'error');
      return;
    }
    const url = window.location.href;
    if (campaigns.length === 1) {
      await sendUrlToQuiverDM(campaigns[0].id, url, btn);
    } else {
      showCampaignPicker(btn, campaigns, async (campaignId) => {
        await sendUrlToQuiverDM(campaignId, url, btn);
      });
    }
  });
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function handleDdbMapsPage() {
  const params = new URLSearchParams(window.location.search);
  const embedded = params.get(EMBED_PARAM) === '1' || window.self !== window.top;

  if (embedded) {
    // Hide chrome immediately; also re-apply after DOM settles
    injectEmbedStyles();
    setTimeout(injectEmbedStyles, 1000);
    return;
  }

  // Standalone: wait for the VTT to render then inject connect button
  await new Promise(resolve => setTimeout(resolve, 1500));
  injectConnectButton();
}
