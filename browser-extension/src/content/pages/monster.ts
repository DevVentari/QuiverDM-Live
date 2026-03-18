import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';
import { showCampaignPicker } from '../../ui/campaign-picker';
import type { DdbMonsterImportPayload } from '../../shared/extension-types';
import type { CampaignOption } from '../../shared/types';

function extractMonsterFromJsonLd(): DdbMonsterImportPayload | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '') as Record<string, unknown>;
      if (data['@type'] === 'Monster' || data['name']) {
        const ddbId = window.location.pathname.split('/').pop() ?? '';
        return {
          ddbId,
          name: String(data['name'] ?? 'Unknown'),
          type: String(data['monsterType'] ?? 'unknown'),
          alignment: String(data['alignment'] ?? 'unaligned'),
          ac: Number(data['armorClass'] ?? 10),
          hp: Number(data['hitPoints'] ?? 1),
          speed: { walk: Number(data['speed'] ?? 30) },
          abilityScores: {
            str: Number(data['strength'] ?? 10),
            dex: Number(data['dexterity'] ?? 10),
            con: Number(data['constitution'] ?? 10),
            int: Number(data['intelligence'] ?? 10),
            wis: Number(data['wisdom'] ?? 10),
            cha: Number(data['charisma'] ?? 10),
          },
          savingThrows: {},
          skills: {},
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          senses: {},
          languages: String(data['languages'] ?? '—'),
          cr: String(data['challengeRating'] ?? '0'),
          xp: Number(data['xpValue'] ?? 0),
          actions: [],
          sourceUrl: window.location.href,
        };
      }
    } catch { /* ignore */ }
  }
  return null;
}

async function getCampaigns(): Promise<CampaignOption[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get.campaigns' }, (res: CampaignOption[]) => {
      resolve(res ?? []);
    });
  });
}

async function doImport(payload: DdbMonsterImportPayload, campaignId: string, btn: HTMLButtonElement) {
  setButtonState(btn, 'loading');
  const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'import.monster', payload, campaignId },
      (res: { ok: boolean; error?: string }) => resolve(res ?? { ok: false, error: 'No response' })
    );
  });

  if (result.ok) {
    setButtonState(btn, 'success', 'Added to QuiverDM!');
    showToast(`${payload.name} added to QuiverDM`);
  } else {
    setButtonState(btn, 'error', 'Failed — try again');
    showToast(result.error ?? 'Import failed', 'error');
  }
}

export async function handleMonsterPage() {
  await new Promise(resolve => setTimeout(resolve, 500));

  const actionBar = document.querySelector('.mon-stat-block__actions, .detail-top-content-middle, [class*="action-bar"]');
  if (!actionBar) return;

  const payload = extractMonsterFromJsonLd();
  if (!payload) return;

  const btn = createImportButton('Add to QuiverDM');
  actionBar.appendChild(btn);

  btn.addEventListener('click', async () => {
    const campaigns = await getCampaigns();
    if (campaigns.length === 0) {
      showToast('Sign in to QuiverDM first', 'error');
      return;
    }
    if (campaigns.length === 1) {
      await doImport(payload, campaigns[0].id, btn);
    } else {
      showCampaignPicker(btn, campaigns, async (campaignId) => {
        await doImport(payload, campaignId, btn);
      });
    }
  });
}
