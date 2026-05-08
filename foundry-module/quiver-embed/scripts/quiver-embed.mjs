/**
 * QuiverDM — Embed module
 *
 * Server-side hook: removes X-Frame-Options and sets a permissive
 * frame-ancestors CSP so the Foundry canvas can be embedded in QuiverDM.
 *
 * Client-side hook: when ?quiver=1 is present in the URL, injects CSS
 * that hides all UI chrome, leaving only the canvas layer visible.
 */

// ── Server-side: strip frame-embedding restrictions ─────────────────────────
// Foundry v11+ exposes expressMiddleware so modules can intercept requests
// before headers are sent. This removes X-Frame-Options and replaces the
// default restrictive CSP frame-ancestors directive with a permissive one.
Hooks.on('expressMiddleware', (app) => {
  app.use((_req, res, next) => {
    res.removeHeader('X-Frame-Options');
    // Override any existing frame-ancestors directive
    const existing = res.getHeader('Content-Security-Policy') ?? '';
    const updated = String(existing)
      .split(';')
      .filter((d) => !d.trim().startsWith('frame-ancestors'))
      .concat("frame-ancestors *")
      .join('; ');
    res.setHeader('Content-Security-Policy', updated);
    next();
  });
});

// ── Client-side: hide UI chrome when embedded ────────────────────────────────
const EMBED_PARAM = 'quiver';
const HIDDEN_SELECTORS = [
  '#sidebar',
  '#hotbar',
  '#navigation',
  '#controls',
  '#ui-left',
  '#ui-right',
  '#players',
  '#pause',
  '#fps',
  '.filepicker',
];

function applyEmbedStyles() {
  const params = new URLSearchParams(window.location.search);
  if (params.get(EMBED_PARAM) !== '1') return;

  const style = document.createElement('style');
  style.id = 'quiver-embed-styles';
  style.textContent = `
    ${HIDDEN_SELECTORS.join(', ')} { display: none !important; }
    #board { left: 0 !important; top: 0 !important; }
    body.game { overflow: hidden; }
  `;
  document.head.appendChild(style);
}

Hooks.once('renderApplication', applyEmbedStyles);
Hooks.once('ready', applyEmbedStyles);
