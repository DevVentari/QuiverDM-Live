import { handleDdbMapsPage } from './pages/ddb-maps';

handleDdbMapsPage();

// Re-run on SPA navigation
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    handleDdbMapsPage();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
