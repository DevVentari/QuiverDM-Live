import { PANEL_KEYS, defaultLabel, type RecapContent, type RecapTheme, type PanelKey } from '@quiverdm/shared';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function label(theme: RecapTheme, key: PanelKey): string {
  return theme.labels?.[key] ?? defaultLabel(key);
}

const markerClass: Record<string, string> = { reveal: 'reveal', flag: 'flag', win: 'win', normal: '' };

// Palette values are color tokens; strip anything that could break out of the CSS context.
const cssColor = (v: string) => v.replace(/[^#a-zA-Z0-9(),.%\s-]/g, '');

function paletteVars(theme: RecapTheme): string {
  return Object.entries(theme.palette).map(([k, v]) => `--${k}:${cssColor(v)};`).join('');
}

function statusPill(s: string): string {
  const cap = s ? s[0].toUpperCase() + s.slice(1) : s;
  return `<span class="status ${esc(s)}">${esc(cap)}</span>`;
}

function renderPanel(theme: RecapTheme, key: PanelKey, content: RecapContent): string {
  const p = content.panels;
  const head = (extra = '') => `<div class="panel-head ${extra}">${esc(label(theme, key))}</div>`;
  switch (key) {
    case 'party':
      if (!p.party.length) return '';
      return `<div class="panel">${head('blood')}<table><thead><tr><th>Character</th><th>Notes</th><th style="text-align:right">Status</th></tr></thead><tbody>${
        p.party.map((m) => `<tr><td><span class="nm">${esc(m.name)}</span>${m.role ? `<span class="cls">${esc(m.role)}</span>` : ''}</td><td class="role">${esc(m.note ?? '')}</td><td style="text-align:right">${statusPill(m.status)}</td></tr>`).join('')
      }</tbody></table></div>`;
    case 'timeline':
      if (!p.timeline.length) return '';
      return `<div class="panel">${head()}${
        p.timeline.map((b) => `<div class="beat ${markerClass[b.marker] ?? ''}"><div class="b-head"><h4>${esc(b.title)}</h4>${b.tag ? `<span class="tag">${esc(b.tag)}</span>` : ''}</div><p>${esc(b.body)}</p></div>`).join('')
      }</div>`;
    case 'npcs':
      if (!p.npcs.length) return '';
      return `<div class="panel">${head('gold')}${
        p.npcs.map((n) => `<div class="beat"><div class="b-head"><h4>${esc(n.name)}</h4><span class="tag">${esc(n.disposition)}</span></div>${n.note ? `<p>${esc(n.note)}</p>` : ''}</div>`).join('')
      }</div>`;
    case 'locations':
      if (!p.locations.length) return '';
      return `<div class="panel">${head('frost')}${
        p.locations.map((l) => `<div class="beat"><div class="b-head"><h4>${esc(l.name)}</h4></div>${l.note ? `<p>${esc(l.note)}</p>` : ''}</div>`).join('')
      }</div>`;
    case 'adversaries':
      if (!p.adversaries.length) return '';
      return `<div class="panel">${head('blood')}${
        p.adversaries.map((a) => `<div class="beat flag"><div class="b-head"><h4>${esc(a.name)}</h4>${a.status ? statusPill(a.status) : ''}</div>${a.note ? `<p>${esc(a.note)}</p>` : ''}</div>`).join('')
      }</div>`;
    case 'threads':
      if (!p.threads.length) return '';
      return `<div class="panel">${head()}${
        p.threads.map((t) => `<div class="beat ${markerClass[t.marker] ?? ''}"><div class="b-head"><h4>${esc(t.title)}</h4></div>${t.body ? `<p>${esc(t.body)}</p>` : ''}</div>`).join('')
      }</div>`;
    case 'whereWeLeftOff':
      if (!content.panels.whereWeLeftOff.trim()) return '';
      return `<div class="panel cliff">${head('blood')}<p class="cliff-text">${esc(content.panels.whereWeLeftOff)}</p></div>`;
    default:
      return '';
  }
}

const CSS = (theme: RecapTheme) => `
:root{${paletteVars(theme)}}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:radial-gradient(150% 70% at 50% -10%, var(--pelt-2) 0%, var(--pelt) 58%), var(--pelt);
  color:var(--bone);font-family:${theme.fonts.body};min-height:100vh;line-height:1.6;
  padding:48px 20px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:820px;margin:0 auto;}
header{border-bottom:2px solid var(--blood);padding-bottom:18px;margin-bottom:26px;
  display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap;}
.eyebrow{font-family:${theme.fonts.condensed};letter-spacing:.4em;text-transform:uppercase;
  font-size:.72rem;color:var(--blood-bright);font-weight:600;margin-bottom:8px;}
h1{font-family:${theme.fonts.display};font-weight:600;font-size:2.6rem;line-height:1.05;color:var(--bone);}
h1 em{display:block;font-style:italic;color:var(--bone-dim);font-weight:500;font-size:.34em;margin-top:8px;}
.statline{font-family:${theme.fonts.condensed};text-align:right;color:var(--bone-dim);font-size:.92rem;letter-spacing:.03em;line-height:1.5;}
.statline b{color:var(--bone);}
.hero{width:100%;border:1px solid var(--line);margin:0 0 26px;border-radius:2px;display:block;}
.recap{font-family:${theme.fonts.display};font-size:1.18rem;line-height:1.5;color:var(--bone-dim);
  font-style:italic;border-left:2px solid var(--blood);padding-left:18px;margin-bottom:30px;}
.panel{margin-bottom:30px;}
.panel-head{font-family:${theme.fonts.condensed};font-weight:700;letter-spacing:.18em;text-transform:uppercase;
  font-size:.84rem;color:var(--ember);display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.panel-head::after{content:"";flex:1;height:1px;background:var(--line);}
.panel-head.blood{color:var(--blood-bright);}.panel-head.gold{color:var(--gold);}.panel-head.frost{color:var(--frost);}
table{width:100%;border-collapse:collapse;}
th{font-family:${theme.fonts.condensed};letter-spacing:.08em;text-transform:uppercase;font-size:.72rem;
  color:var(--bone-faint);text-align:left;padding:5px 8px;font-weight:600;border-bottom:1px solid var(--line);}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top;}
td .nm{color:var(--bone);font-weight:500;font-family:${theme.fonts.display};font-size:1.05rem;display:block;}
td .cls{font-family:${theme.fonts.condensed};letter-spacing:.04em;font-size:.72rem;color:var(--bone-faint);text-transform:uppercase;}
td.role{color:var(--bone-dim);font-size:.9rem;}
.status{display:inline-block;font-family:${theme.fonts.condensed};font-size:.66rem;letter-spacing:.08em;
  text-transform:uppercase;padding:2px 8px;border-radius:2px;border:1px solid var(--line);color:var(--bone-dim);}
.status.dead{color:var(--blood-bright);border-color:#4a2020;background:#211313;}
.status.alive{color:var(--green);border-color:#2e3a22;}
.beat{position:relative;padding:0 0 16px 22px;}
.beat::before{content:"";position:absolute;left:0;top:7px;width:9px;height:9px;border-radius:50%;
  background:var(--ash);border:1px solid var(--bone-faint);}
.beat.flag::before{background:var(--blood);border-color:var(--blood-bright);box-shadow:0 0 6px var(--blood);}
.beat.reveal::before{background:var(--gold);border-color:var(--gold);}
.beat.win::before{background:var(--green);border-color:var(--green);}
.b-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:3px;}
.beat h4{font-family:${theme.fonts.display};font-weight:600;font-size:1.15rem;color:var(--bone);}
.beat .tag{font-family:${theme.fonts.condensed};font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ember);}
.beat p{font-size:.95rem;color:var(--bone-dim);}
.cliff{border:1px solid var(--line);background:var(--panel);padding:20px;border-radius:2px;}
.cliff-text{font-family:${theme.fonts.display};font-style:italic;font-size:1.15rem;color:var(--bone);}
.folio{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);text-align:center;
  font-family:${theme.fonts.condensed};letter-spacing:.2em;text-transform:uppercase;font-size:.7rem;color:var(--bone-faint);}
@media (max-width:480px){
  body{padding:28px 14px;}
  h1{font-size:2rem;}
  header{flex-direction:column;align-items:flex-start;}
  .statline{text-align:left;}
  table,thead,tbody,tr,td,th{display:block;}
  thead{display:none;}
  td{border:none;padding:2px 0;}
  tr{border-bottom:1px solid var(--line);padding:8px 0;}
}
`;

/**
 * Render a self-contained recap HTML document.
 *
 * IMPORTANT: theme (RecapTheme) MUST be a developer-trusted constant, never user-supplied.
 * theme.fonts.* and theme.fonts.importUrl are interpolated into <style> without escaping
 * by design (P4 has no theme editor; see spec §7). Palette values are sanitized via cssColor().
 */
export function renderRecapHtml(
  content: RecapContent,
  theme: RecapTheme,
  meta: { campaignName: string; sessionNumber: number },
): string {
  const stat = content.statline.map((s) => `${esc(s.label)} <b>${esc(s.value)}</b>`).join('<br>');
  const hero = content.header.image?.url
    ? `<img class="hero" src="${esc(content.header.image.url)}" alt="${esc(content.header.image.alt ?? '')}">`
    : '';
  const panels = PANEL_KEYS.map((k) => renderPanel(theme, k, content)).join('\n');
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.campaignName)} · ${esc(content.header.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>@import url('${theme.fonts.importUrl}');${CSS(theme)}</style>
</head><body><div class="wrap">
${hero}
<header>
  <div class="titleblock"><div class="eyebrow">${esc(content.header.eyebrow)}</div>
  <h1>${esc(content.header.title)}${content.header.subtitle ? `<em>${esc(content.header.subtitle)}</em>` : ''}</h1></div>
  <div class="statline">${stat}</div>
</header>
<p class="recap">${esc(content.lede)}</p>
${panels}
<div class="folio">${esc(meta.campaignName)} · Session ${meta.sessionNumber} · the chronicle stands</div>
</div></body></html>`;
}
