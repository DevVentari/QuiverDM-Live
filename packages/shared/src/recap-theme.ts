import { z } from 'zod';

export type Marker = 'normal' | 'reveal' | 'flag' | 'win';
export type Disposition = 'ally' | 'neutral' | 'hostile' | 'unknown';
export type Status = 'alive' | 'down' | 'dead' | 'absent';

const marker = z.enum(['normal', 'reveal', 'flag', 'win']);
const disposition = z.enum(['ally', 'neutral', 'hostile', 'unknown']);
const status = z.enum(['alive', 'down', 'dead', 'absent']);

export const RecapContentSchema = z.object({
  header: z.object({
    eyebrow: z.string(),
    title: z.string(),
    subtitle: z.string().optional(),
    image: z.object({ url: z.string(), alt: z.string().optional(), caption: z.string().optional() }).nullable().optional(),
  }),
  statline: z.array(z.object({ label: z.string(), value: z.string() })),
  lede: z.string(),
  panels: z.object({
    party: z.array(z.object({ name: z.string(), role: z.string().optional(), status, note: z.string().optional() })),
    timeline: z.array(z.object({ title: z.string(), tag: z.string().optional(), body: z.string(), marker })),
    npcs: z.array(z.object({ name: z.string(), note: z.string().optional(), disposition })),
    locations: z.array(z.object({ name: z.string(), note: z.string().optional() })),
    adversaries: z.array(z.object({ name: z.string(), note: z.string().optional(), status: status.optional() })),
    threads: z.array(z.object({ title: z.string(), body: z.string().optional(), marker })),
    whereWeLeftOff: z.string(),
  }),
});

export type RecapContent = z.infer<typeof RecapContentSchema>;
export type PanelKey = keyof RecapContent['panels'];
export const PANEL_KEYS: PanelKey[] = ['party', 'timeline', 'npcs', 'locations', 'adversaries', 'threads', 'whereWeLeftOff'];

const DEFAULT_LABELS: Record<PanelKey, string> = {
  party: 'The Party', timeline: 'Session Timeline', npcs: 'NPCs & Allies',
  locations: 'Locations', adversaries: 'Adversaries', threads: 'Open Threads',
  whereWeLeftOff: 'Where We Left Off',
};
export function defaultLabel(key: PanelKey): string { return DEFAULT_LABELS[key]; }

export type RecapTheme = {
  palette: Record<string, string>;
  fonts: { display: string; body: string; condensed: string; importUrl: string };
  labels?: Partial<Record<PanelKey, string>>;
  markerColors: { reveal: string; flag: string; win: string };
};

const GOOGLE = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=Barlow+Condensed:wght@500;600;700&display=swap';

export const VALDRATH_THEME: RecapTheme = {
  palette: {
    pelt: '#0d0c0f', 'pelt-2': '#15131a', panel: '#16141b', ash: '#252029',
    bone: '#e7dfcf', 'bone-dim': '#a39885', 'bone-faint': '#6f6557',
    blood: '#8a1c1c', 'blood-bright': '#c0392b', ember: '#d8742a',
    frost: '#5b88a8', gold: '#b08833', green: '#6f8a4e', line: '#34303c',
  },
  fonts: {
    display: "'Cormorant Garamond', serif",
    body: "'Spectral', serif",
    condensed: "'Barlow Condensed', sans-serif",
    importUrl: GOOGLE,
  },
  labels: { adversaries: 'Demons Below', whereWeLeftOff: 'Where We Left Off' },
  markerColors: { reveal: 'gold', flag: 'blood', win: 'green' },
};

// Neutral dark-fantasy fallback — same structure, less blood-red.
export const DEFAULT_THEME: RecapTheme = {
  palette: {
    pelt: '#0e0d10', 'pelt-2': '#16151a', panel: '#17161c', ash: '#26242c',
    bone: '#e8e2d6', 'bone-dim': '#a49a8b', 'bone-faint': '#6f6759',
    blood: '#7a3b2e', 'blood-bright': '#b5654d', ember: '#c98a4a',
    frost: '#5f86a0', gold: '#b39653', green: '#6f8a4e', line: '#33313a',
  },
  fonts: VALDRATH_THEME.fonts,
  labels: {},
  markerColors: { reveal: 'gold', flag: 'blood', win: 'green' },
};
