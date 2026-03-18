import { createImportButton, setButtonState } from '../../ui/button';
import { showToast } from '../../ui/toast';
import { showCampaignPicker } from '../../ui/campaign-picker';
import type { DdbMonsterImportPayload } from '../../shared/extension-types';
import type { CampaignOption } from '../../shared/types';

function extractMonsterFromDom(): DdbMonsterImportPayload | null {
  const nameEl = document.querySelector('.mon-stat-block__name-link, .mon-stat-block__name');
  if (!nameEl) return null;
  const name = nameEl.textContent?.trim() ?? '';
  if (!name) return null;

  const meta = document.querySelector('.mon-stat-block__meta')?.textContent?.trim() ?? '';
  const lastComma = meta.lastIndexOf(',');
  const type = lastComma >= 0 ? meta.slice(0, lastComma).trim() : meta;
  const alignment = lastComma >= 0 ? meta.slice(lastComma + 1).trim() : 'unaligned';

  function getAttr(label: string): string {
    for (const el of document.querySelectorAll('.mon-stat-block__attribute')) {
      const lbl = el.querySelector('.mon-stat-block__attribute-label')?.textContent?.trim();
      if (lbl === label) {
        return el.querySelector('.mon-stat-block__attribute-data-value, .mon-stat-block__attribute-value')?.textContent?.trim() ?? '';
      }
    }
    return '';
  }

  function getTidbit(label: string): string {
    for (const el of document.querySelectorAll('.mon-stat-block__tidbit')) {
      const lbl = el.querySelector('.mon-stat-block__tidbit-label')?.textContent?.trim();
      if (lbl === label) {
        return el.querySelector('.mon-stat-block__tidbit-data')?.textContent?.trim() ?? '';
      }
    }
    return '';
  }

  function getAbility(ab: string): number {
    const el = document.querySelector(`.ability-block__stat--${ab}`);
    return parseInt(el?.querySelector('.ability-block__score')?.textContent ?? '10', 10) || 10;
  }

  const challengeText = getTidbit('Challenge');
  const crMatch = challengeText.match(/^([\d/]+)\s*\((\d+)\s*XP\)/i);

  return {
    ddbId: window.location.pathname.split('/').pop() ?? '',
    name,
    type,
    alignment,
    ac: parseInt(getAttr('Armor Class'), 10) || 10,
    hp: parseInt(getAttr('Hit Points'), 10) || 1,
    speed: { walk: parseInt(getAttr('Speed'), 10) || 30 },
    abilityScores: {
      str: getAbility('str'),
      dex: getAbility('dex'),
      con: getAbility('con'),
      int: getAbility('int'),
      wis: getAbility('wis'),
      cha: getAbility('cha'),
    },
    savingThrows: {},
    skills: {},
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    senses: {},
    languages: getTidbit('Languages') || '—',
    cr: crMatch?.[1] ?? '0',
    xp: parseInt(crMatch?.[2] ?? '0', 10),
    actions: [],
    sourceUrl: window.location.href,
  };
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

  const actionBar = document.querySelector(
    '.page-heading__actions, .page-header__action-bar, .page-header__actions, .page-heading__suffix, .page-header__primary'
  );
  if (!actionBar) return;

  const payload = extractMonsterFromDom();
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
