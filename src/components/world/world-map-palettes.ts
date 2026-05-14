export type WorldMapPaletteKey = 'umber' | 'olive' | 'maroon' | 'aubergine' | 'graphite';

export type WorldMapPalette = {
  key: WorldMapPaletteKey;
  label: string;
  title: string;
  feel: string;
  surface: string;
  raised: string;
  border: string;
  muted: string;
  softText: string;
  text: string;
  accent: string;
  glow: string;
};

export const WORLD_MAP_PALETTES: WorldMapPalette[] = [
  {
    key: 'umber',
    label: 'A',
    title: 'Dark Umber',
    feel: 'Candlelit parchment and old leather.',
    surface: '#15110C',
    raised: '#211A12',
    border: '#3A2B19',
    muted: '#A89B7A',
    softText: '#C9B98F',
    text: '#F1E7D0',
    accent: '#C99A4A',
    glow: 'rgba(201, 154, 74, 0.24)',
  },
  {
    key: 'olive',
    label: 'B',
    title: 'Deep Olive',
    feel: 'Forest ruins, grounded and worn.',
    surface: '#10140E',
    raised: '#1A2116',
    border: '#2F3A28',
    muted: '#9BA68D',
    softText: '#C3CBAF',
    text: '#EEF1E5',
    accent: '#B89A54',
    glow: 'rgba(184, 154, 84, 0.22)',
  },
  {
    key: 'maroon',
    label: 'C',
    title: 'Oxblood',
    feel: 'Gothic archive with high drama.',
    surface: '#171011',
    raised: '#241719',
    border: '#3A2427',
    muted: '#B79A92',
    softText: '#D0B3AA',
    text: '#F3E4DF',
    accent: '#D2A35A',
    glow: 'rgba(210, 163, 90, 0.23)',
  },
  {
    key: 'aubergine',
    label: 'D',
    title: 'Smoky Aubergine',
    feel: 'Oracle energy and arcane focus.',
    surface: '#131018',
    raised: '#201A29',
    border: '#342A40',
    muted: '#A99AB8',
    softText: '#CBBED8',
    text: '#EFE8F6',
    accent: '#C8A4FF',
    glow: 'rgba(200, 164, 255, 0.22)',
  },
  {
    key: 'graphite',
    label: 'E',
    title: 'Iron Graphite',
    feel: 'Premium neutral shell.',
    surface: '#111214',
    raised: '#1B1C1F',
    border: '#303034',
    muted: '#A3A09A',
    softText: '#C4C0B8',
    text: '#ECE9E3',
    accent: '#C9A66B',
    glow: 'rgba(201, 166, 107, 0.2)',
  },
];

export const WORLD_MAP_PALETTE_STORAGE_KEY = 'quiverdm.world-map.palette';
export const WORLD_MAP_DEFAULT_PALETTE_KEY: WorldMapPaletteKey = 'graphite';

export function getWorldMapPalette(key: WorldMapPaletteKey | null | undefined) {
  return WORLD_MAP_PALETTES.find((palette) => palette.key === key) ?? WORLD_MAP_PALETTES.find((palette) => palette.key === WORLD_MAP_DEFAULT_PALETTE_KEY) ?? WORLD_MAP_PALETTES[0];
}
