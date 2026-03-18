import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';
import { showCampaignPicker } from '../../ui/campaign-picker';
import type { CampaignOption } from '../../shared/types';

async function getCampaigns(): Promise<CampaignOption[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get.campaigns' }, (res: CampaignOption[]) => {
      resolve(res ?? []);
    });
  });
}

async function doImport(ddbId: string, campaignId: string, btn: HTMLButtonElement) {
  setButtonState(btn, 'loading');
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'import.character', ddbId, campaignId },
      (res: { ok: boolean; error?: string }) => resolve(res ?? { ok: false, error: 'No response' })
    );
  });

  if (result.ok) {
    setButtonState(btn, 'success', 'Synced!');
    showToast('Character synced to QuiverDM');
  } else {
    setButtonState(btn, 'error', 'Failed — try again');
    showToast(result.error ?? 'Sync failed', 'error');
  }
}

export async function handleCharacterPage() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const ddbId = window.location.pathname.split('/')[2];
  if (!ddbId) return;

  const actionBar = document.querySelector('.character-header-desktop-menu, [class*="character-header"]');
  if (!actionBar) return;

  const btn = createImportButton('Sync to QuiverDM');
  actionBar.appendChild(btn);

  btn.addEventListener('click', async () => {
    const campaigns = await getCampaigns();
    if (campaigns.length === 0) {
      showToast('Sign in to QuiverDM first', 'error');
      return;
    }
    if (campaigns.length === 1) {
      await doImport(ddbId, campaigns[0].id, btn);
    } else {
      showCampaignPicker(btn, campaigns, async (campaignId) => {
        await doImport(ddbId, campaignId, btn);
      });
    }
  });
}
