export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const existing = document.querySelector('[data-quiverdm-toast]');
  existing?.remove();

  const toast = document.createElement('div');
  toast.dataset.quiverdmToast = 'true';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 99999;
    background: ${type === 'success' ? '#15803d' : '#b91c1c'};
    color: white; padding: 10px 16px; border-radius: 6px;
    font-size: 13px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: quiverdm-fadein 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `@keyframes quiverdm-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`;
  document.head.appendChild(style);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
