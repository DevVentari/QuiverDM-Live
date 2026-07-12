import { describe, it, expect } from 'vitest';
import {
  RecapContentSchema, DEFAULT_THEME, VALDRATH_THEME, PANEL_KEYS, defaultLabel,
} from './recap-theme';

const valid = {
  header: { eyebrow: 'Session One', title: 'Blood at the Gate' },
  statline: [{ label: 'Run-time', value: '3h 40m' }],
  lede: 'The party arrived at Gravenhold.',
  panels: {
    party: [{ name: 'Kael', role: 'Fighter', status: 'alive' }],
    timeline: [{ title: 'Arrival', body: 'They reached the gate.', marker: 'reveal' }],
    npcs: [{ name: 'The Commander', disposition: 'neutral' }],
    locations: [{ name: 'Gravenhold' }],
    adversaries: [{ name: 'Cultists' }],
    threads: [{ title: 'The chant', marker: 'flag' }],
    whereWeLeftOff: 'The chant stopped.',
  },
};

describe('RecapContentSchema', () => {
  it('parses a valid recap', () => {
    expect(RecapContentSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects a bad party status', () => {
    const bad = structuredClone(valid);
    (bad.panels.party[0] as { status: string }).status = 'exploded';
    expect(RecapContentSchema.safeParse(bad).success).toBe(false);
  });
  it('allows empty panels and omitted image', () => {
    const thin = structuredClone(valid);
    thin.panels.party = []; thin.panels.timeline = []; thin.panels.npcs = [];
    thin.panels.locations = []; thin.panels.adversaries = []; thin.panels.threads = [];
    expect(RecapContentSchema.safeParse(thin).success).toBe(true);
  });
});

describe('themes', () => {
  it('both themes define every palette key the renderer needs', () => {
    for (const t of [DEFAULT_THEME, VALDRATH_THEME]) {
      for (const k of ['pelt', 'panel', 'bone', 'bone-dim', 'blood', 'blood-bright', 'ember', 'frost', 'gold', 'line']) {
        expect(t.palette[k], `${k} missing`).toMatch(/^#/);
      }
      expect(t.fonts.importUrl).toMatch(/^https:\/\/fonts\.googleapis\.com/);
    }
  });
  it('valdrath relabels adversaries as Demons Below; default falls back', () => {
    expect(VALDRATH_THEME.labels?.adversaries).toBe('Demons Below');
    expect(defaultLabel('adversaries')).toBe('Adversaries');
    expect(PANEL_KEYS).toContain('whereWeLeftOff');
  });
});
