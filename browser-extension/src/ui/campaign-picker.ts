import type { CampaignOption } from '../shared/types';

export function showCampaignPicker(
  anchor: HTMLElement,
  campaigns: CampaignOption[],
  onSelect: (campaignId: string) => void
) {
  const existing = document.querySelector('[data-quiverdm-picker]');
  existing?.remove();

  const picker = document.createElement('div');
  picker.dataset.quiverdmPicker = 'true';
  picker.style.cssText = `
    position: absolute; z-index: 99998; background: #1e1b2e; border: 1px solid #4c3d8a;
    border-radius: 6px; padding: 8px; min-width: 200px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4); font-size: 13px;
  `;

  const label = document.createElement('p');
  label.textContent = 'Add to which campaign?';
  label.style.cssText = 'color: #9ca3af; margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;';
  picker.appendChild(label);

  for (const campaign of campaigns) {
    const option = document.createElement('button');
    option.textContent = campaign.name;
    option.style.cssText = `
      display: block; width: 100%; text-align: left; padding: 6px 8px;
      background: none; border: none; color: white; cursor: pointer; border-radius: 4px;
    `;
    option.onmouseover = () => { option.style.background = '#2d2454'; };
    option.onmouseout = () => { option.style.background = 'none'; };
    option.onclick = () => {
      picker.remove();
      onSelect(campaign.id);
    };
    picker.appendChild(option);
  }

  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.bottom + window.scrollY + 4}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(picker);

  const close = (e: MouseEvent) => {
    if (!picker.contains(e.target as Node)) {
      picker.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}
