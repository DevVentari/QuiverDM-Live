import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';

export async function handleCharacterPage() {
  await new Promise(resolve => setTimeout(resolve, 800));

  const ddbId = window.location.pathname.split('/')[2];
  if (!ddbId) return;

  const actionBar = document.querySelector('.character-header-desktop-menu, [class*="character-header"]');
  if (!actionBar) return;

  const btn = createImportButton('Sync to QuiverDM');
  actionBar.appendChild(btn);

  btn.addEventListener('click', async () => {
    setButtonState(btn, 'loading');
    const result = await new Promise<{ ok: boolean; error?: string }>(resolve => {
      chrome.runtime.sendMessage({ type: 'import.character', ddbId, campaignId: '' }, resolve);
    });
    if (result.ok) {
      setButtonState(btn, 'success');
      showToast('Character synced to QuiverDM');
    } else {
      setButtonState(btn, 'error');
      showToast(result.error ?? 'Sync failed', 'error');
    }
  });
}
