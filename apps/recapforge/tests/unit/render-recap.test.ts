import { describe, it, expect } from 'vitest';
import { VALDRATH_THEME, DEFAULT_THEME, type RecapContent } from '@quiverdm/shared';
import { renderRecapHtml } from '@/lib/render-recap';

const full: RecapContent = {
  header: { eyebrow: 'Session One', title: 'Blood at the Gate', image: { url: 'https://x/y.png', alt: 'gate' } },
  statline: [{ label: 'Run-time', value: '3h 40m' }],
  lede: 'The party arrived at Gravenhold.',
  panels: {
    party: [{ name: 'Kael', role: 'Fighter', status: 'alive' }, { name: 'Ghost', role: 'Wizard', status: 'dead' }],
    timeline: [{ title: 'Arrival', tag: 'Revelation', body: 'They reached the gate.', marker: 'reveal' }],
    npcs: [{ name: 'The Commander', disposition: 'neutral', note: 'wary' }],
    locations: [{ name: 'Gravenhold', note: 'a walled town' }],
    adversaries: [{ name: 'Cultists', status: 'alive' }],
    threads: [{ title: 'The chant', body: 'why did it stop?', marker: 'flag' }],
    whereWeLeftOff: 'The chant stopped.',
  },
};
const meta = { campaignName: 'Valdrath', sessionNumber: 1 };

describe('renderRecapHtml', () => {
  it('is self-contained: doctype, inline style, no external stylesheet link', () => {
    const html = renderRecapHtml(full, VALDRATH_THEME, meta);
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="(?!https:\/\/fonts)/);
  });
  it('injects theme palette as CSS vars and uses the theme label override', () => {
    const html = renderRecapHtml(full, VALDRATH_THEME, meta);
    expect(html).toContain('--blood:#8a1c1c');
    expect(html).toContain('Demons Below');        // adversaries relabelled
    expect(html).toContain('Where We Left Off');
  });
  it('default theme uses the fallback label', () => {
    const html = renderRecapHtml(full, DEFAULT_THEME, meta);
    expect(html).toContain('Adversaries');
    expect(html).not.toContain('Demons Below');
  });
  it('omits empty panels (no heading when the array is empty)', () => {
    const thin: RecapContent = { ...full, panels: { ...full.panels, locations: [], npcs: [] } };
    const html = renderRecapHtml(thin, VALDRATH_THEME, meta);
    expect(html).not.toContain('Locations');
    expect(html).not.toContain('NPCs');
  });
  it('renders the image when present and skips it when null', () => {
    expect(renderRecapHtml(full, VALDRATH_THEME, meta)).toContain('https://x/y.png');
    const noimg: RecapContent = { ...full, header: { ...full.header, image: null } };
    expect(renderRecapHtml(noimg, VALDRATH_THEME, meta)).not.toContain('<img');
  });
  it('bakes in the mobile layer and escapes HTML in content', () => {
    const html = renderRecapHtml(full, VALDRATH_THEME, meta);
    expect(html).toContain('@media (max-width');
    const xss: RecapContent = { ...full, lede: 'a <script>alert(1)</script> b' };
    expect(renderRecapHtml(xss, VALDRATH_THEME, meta)).not.toContain('<script>alert(1)');
  });
});
