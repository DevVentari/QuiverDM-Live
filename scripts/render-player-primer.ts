/**
 * Render a player-primer.json as a beautifully formatted PDF.
 *
 * Usage:
 *   npx tsx scripts/render-player-primer.ts [docs/Jordan-New-Campaign]
 */

import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright';
import type { PlayerPrimer } from './extract-player-primer';

const dir      = process.argv[2] ?? 'docs/Jordan-New-Campaign';
const jsonPath = path.resolve(process.cwd(), dir, 'player-primer.json');
const pdfPath  = path.resolve(process.cwd(), dir, 'player-primer.pdf');

if (!fs.existsSync(jsonPath)) {
  console.error('player-primer.json not found:', jsonPath);
  process.exit(1);
}

const data: PlayerPrimer = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prose(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('');
}

const FACTION_CLASS: Record<string, string> = {
  ally: 'ally', neutral: 'neutral', antagonist: 'antagonist', unknown: 'unknown',
};

const MECHANIC_LABEL: Record<string, string> = {
  house_rule: 'House Rule', custom_mechanic: 'Custom Mechanic', variant_rule: 'Variant Rule', advice: 'Advice',
};

// ─── HTML ─────────────────────────────────────────────────────────────────────

function buildHtml(d: PlayerPrimer): string {
  const dateStr = new Date(d.generatedAt).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const knowHtml = d.whatYouKnow.map(k => `
    <div class="knowledge-item">
      <div class="knowledge-topic">
        ${esc(k.topic)}
        <span class="badge badge-${k.confidence}">${k.confidence}</span>
      </div>
      <div class="knowledge-detail">${esc(k.detail)}</div>
    </div>`).join('');

  const factionHtml = d.factions.map(f => `
    <div class="faction-card ${FACTION_CLASS[f.playerRelationship] ?? 'unknown'}">
      <div class="faction-header">
        <span class="faction-name">${esc(f.name)}</span>
        <span class="faction-rel">${f.playerRelationship}</span>
      </div>
      <div class="faction-desc">${esc(f.description)}</div>
      ${f.notes ? `<div class="faction-notes">${esc(f.notes)}</div>` : ''}
    </div>`).join('');

  const locationHtml = d.locations.map(l => `
    <div class="location-card">
      <div class="location-name">${esc(l.name)}</div>
      <div class="location-desc">${esc(l.description)}</div>
      <div class="location-sig">${esc(l.significance)}</div>
    </div>`).join('');

  const classHtml = d.characterGuide.recommendedClasses.map(c => `
    <tr>
      <td class="bold">${esc(c.class)}</td>
      <td>${esc(c.why)}</td>
    </tr>`).join('');

  const bgHtml = d.characterGuide.recommendedBackgrounds.map(b => `
    <tr>
      <td class="bold">${esc(b.background)}</td>
      <td>${esc(b.why)}</td>
    </tr>`).join('');

  const themesHtml = d.characterGuide.themes.map(t =>
    `<span class="theme-tag">${esc(t)}</span>`).join('');

  const warningsHtml = d.characterGuide.warnings.map(w =>
    `<div class="warning-item">${esc(w)}</div>`).join('');

  const mechanicsHtml = d.mechanics.map(m => `
    <div class="mechanic-item ${m.type}">
      <div class="mechanic-header">
        <span class="mechanic-name">${esc(m.name)}</span>
        <span class="mechanic-type">${MECHANIC_LABEL[m.type] ?? m.type}</span>
      </div>
      <div class="mechanic-desc">${esc(m.description)}</div>
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Crimson Text',Georgia,serif;background:#0f0e17;color:#e8e0d0;font-size:13px;line-height:1.6;padding:48px 56px}

/* ── Header ── */
.doc-header{border-bottom:1px solid #f59e0b44;padding-bottom:24px;margin-bottom:36px}
.doc-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.2em;color:#f59e0b99;text-transform:uppercase;margin-bottom:8px}
.doc-title{font-family:'Cinzel',serif;font-size:28px;font-weight:700;color:#fcd34d;margin-bottom:8px}
.doc-tagline{color:#b8b0a0;font-style:italic;font-size:14px;margin-bottom:8px}
.doc-meta{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;color:#6b7280}
.tone-badge{display:inline-block;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.12em;color:#f59e0b99;border:1px solid #f59e0b33;padding:2px 8px;text-transform:uppercase;margin-top:6px}

/* ── Sections ── */
.section{margin-bottom:36px}
.section-heading{font-family:'Cinzel',serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#f59e0b;border-bottom:1px solid #f59e0b33;padding-bottom:6px;margin-bottom:16px}

/* ── World prose ── */
.prose p{color:#b8b0a0;margin-bottom:10px;font-size:13px}

/* ── What You Know ── */
.knowledge-item{background:#161420;border:1px solid #2d2b3a;border-left:3px solid #f59e0b55;border-radius:4px;padding:12px 14px;margin-bottom:10px}
.knowledge-topic{font-family:'Cinzel',serif;font-size:12px;font-weight:600;color:#e8e0d0;margin-bottom:4px;display:flex;align-items:center;gap:10px}
.knowledge-detail{color:#9ca3af;font-size:12px;line-height:1.6}
.badge{display:inline-block;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;padding:2px 7px;border-radius:3px;border:1px solid;font-weight:600;text-transform:uppercase}
.badge-established{background:#f59e0b22;color:#f59e0b;border-color:#f59e0b44}
.badge-rumored{background:#6b728022;color:#6b7280;border-color:#6b728044}

/* ── Factions ── */
.faction-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.faction-card{background:#161420;border:1px solid #2d2b3a;border-radius:6px;padding:14px;border-left-width:3px}
.faction-card.ally{border-left-color:#16a34a}
.faction-card.neutral{border-left-color:#6b7280}
.faction-card.antagonist{border-left-color:#dc2626}
.faction-card.unknown{border-left-color:#7c3aed}
.faction-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
.faction-name{font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:#e8e0d0}
.faction-rel{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.faction-desc{color:#9ca3af;font-size:12px;margin-bottom:4px;line-height:1.6}
.faction-notes{color:#b8b0a0;font-size:12px;font-style:italic}

/* ── Locations ── */
.location-card{background:#161420;border:1px solid #2d2b3a;border-left:3px solid #f59e0b55;border-radius:4px;padding:12px 14px;margin-bottom:10px}
.location-name{font-family:'Cinzel',serif;font-size:12px;color:#fcd34d;margin-bottom:4px}
.location-desc{color:#d1c9b8;margin-bottom:4px;font-size:12px}
.location-sig{color:#9ca3af;font-size:12px;font-style:italic}

/* ── Character Guide ── */
.guide-overview{color:#b8b0a0;font-style:italic;font-size:14px;margin-bottom:16px}
.guide-group-label{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.18em;color:#f59e0b99;text-transform:uppercase;margin-bottom:8px;margin-top:16px}
table{width:100%;border-collapse:collapse}
th{font-family:'Cinzel',serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;text-align:left;padding:6px 10px;border-bottom:1px solid #374151}
td{padding:8px 10px;border-bottom:1px solid #1f2937;vertical-align:top;color:#d1c9b8;font-size:12px}
tr:last-child td{border-bottom:none}
td.bold{font-family:'Cinzel',serif;font-size:12px;font-weight:600;color:#e8e0d0;width:160px}
.themes-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.theme-tag{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.1em;color:#f59e0b;border:1px solid #f59e0b44;padding:2px 8px;border-radius:3px;text-transform:uppercase;background:#f59e0b0d}
.warnings-box{background:#1a0a0a;border:1px solid #7f1d1d55;border-left:3px solid #dc262655;border-radius:4px;padding:12px 16px;margin-top:16px}
.warning-item{color:#fca5a5;font-size:12px;padding-left:14px;position:relative;margin-bottom:6px;line-height:1.6}
.warning-item::before{content:'✦';position:absolute;left:0;color:#dc2626;font-size:9px;top:3px}
.warning-item:last-child{margin-bottom:0}

/* ── Mechanics ── */
.mechanic-item{border-left:3px solid;padding:10px 14px;margin-bottom:10px;background:#161420;border-radius:0 4px 4px 0}
.mechanic-item.house_rule{border-left-color:#d97706}
.mechanic-item.custom_mechanic{border-left-color:#7c3aed}
.mechanic-item.variant_rule{border-left-color:#374151}
.mechanic-item.advice{border-left-color:#1e3a5f}
.mechanic-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.mechanic-name{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:#e8e0d0}
.mechanic-type{font-family:'Cinzel',serif;font-size:9px;letter-spacing:.1em;color:#6b7280;text-transform:uppercase}
.mechanic-desc{color:#9ca3af;font-size:12px;line-height:1.6}

/* ── Footer ── */
.doc-footer{margin-top:48px;padding-top:16px;border-top:1px solid #f59e0b22;display:flex;justify-content:space-between;color:#4b5563;font-size:10px;font-family:'Cinzel',serif;letter-spacing:.08em}
</style></head><body>

<div class="doc-header">
  <div class="doc-label">Player's Primer</div>
  <div class="doc-title">${esc(d.worldOverview.name)}</div>
  <div class="doc-tagline">${esc(d.worldOverview.tagline)}</div>
  <div class="doc-meta">${esc(d.campaignName)} &middot; ${dateStr}</div>
  <div class="tone-badge">${esc(d.worldOverview.tone)}</div>
</div>

<div class="section">
  <div class="section-heading">The World</div>
  <div class="prose">${prose(d.worldOverview.history)}${d.worldOverview.cosmology ? prose(d.worldOverview.cosmology) : ''}</div>
</div>

${d.whatYouKnow.length > 0 ? `
<div class="section">
  <div class="section-heading">What You Know</div>
  ${knowHtml}
</div>` : ''}

${d.factions.length > 0 ? `
<div class="section">
  <div class="section-heading">Factions &amp; Powers</div>
  <div class="faction-grid">${factionHtml}</div>
</div>` : ''}

${d.locations.length > 0 ? `
<div class="section">
  <div class="section-heading">Known Locations</div>
  ${locationHtml}
</div>` : ''}

<div class="section">
  <div class="section-heading">Creating Your Character</div>
  <div class="guide-overview">${esc(d.characterGuide.overview)}</div>
  ${d.characterGuide.recommendedClasses.length > 0 ? `
  <div class="guide-group-label">Recommended Classes</div>
  <table><thead><tr><th>Class</th><th>Why It Fits</th></tr></thead><tbody>${classHtml}</tbody></table>` : ''}
  ${d.characterGuide.recommendedBackgrounds.length > 0 ? `
  <div class="guide-group-label">Recommended Backgrounds</div>
  <table><thead><tr><th>Background</th><th>Why It Fits</th></tr></thead><tbody>${bgHtml}</tbody></table>` : ''}
  ${d.characterGuide.themes.length > 0 ? `
  <div class="guide-group-label">Themes &amp; Motivations</div>
  <div class="themes-list">${themesHtml}</div>` : ''}
  ${d.characterGuide.warnings.length > 0 ? `
  <div class="warnings-box">${warningsHtml}</div>` : ''}
</div>

${d.mechanics.length > 0 ? `
<div class="section">
  <div class="section-heading">How We Play</div>
  ${mechanicsHtml}
</div>` : ''}

<div class="doc-footer">
  <span>QuiverDM &middot; Player's Primer</span>
  <span>${dateStr}</span>
</div>

</body></html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const html    = buildHtml(data);
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  console.log('Rendering PDF...');
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path:            pdfPath,
    format:          'A4',
    printBackground: true,
    margin:          { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();

  console.log(`Wrote: ${pdfPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
