export type ButtonState = 'idle' | 'loading' | 'success' | 'error';

export function createImportButton(label = 'Add to QuiverDM'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.dataset.quiverdmBtn = 'true';
  btn.textContent = label;
  btn.style.cssText = `
    background: #000; color: #fff; border: 2px solid #c53030; border-radius: 0;
    padding: 8px 16px; cursor: pointer; font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; font-family: inherit;
    display: inline-flex; align-items: center; gap: 6px;
    transition: background 0.15s, border-color 0.15s;
  `;
  return btn;
}

export function setButtonState(btn: HTMLButtonElement, state: ButtonState, message?: string) {
  switch (state) {
    case 'idle':
      btn.disabled = false;
      btn.textContent = message ?? 'Add to QuiverDM';
      btn.style.opacity = '1';
      break;
    case 'loading':
      btn.disabled = true;
      btn.textContent = 'Adding...';
      btn.style.opacity = '0.7';
      break;
    case 'success':
      btn.disabled = true;
      btn.textContent = message ?? 'Added!';
      btn.style.background = '#15803d';
      setTimeout(() => {
        setButtonState(btn, 'idle');
        btn.style.background = '#b45309';
      }, 2000);
      break;
    case 'error':
      btn.disabled = false;
      btn.textContent = message ?? 'Error — try again';
      btn.style.background = '#b91c1c';
      setTimeout(() => {
        setButtonState(btn, 'idle');
        btn.style.background = '#b45309';
      }, 3000);
      break;
  }
}
