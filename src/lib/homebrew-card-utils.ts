export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary' | 'artifact';
export type SpellSchool =
  | 'evocation' | 'illusion' | 'necromancy' | 'abjuration'
  | 'conjuration' | 'divination' | 'enchantment' | 'transmutation';

type RarityVars = { '--rc': string; '--rb': string; '--rg'?: string };
type SchoolVars = { '--school-color': string; '--school-bg': string };

const RARITY_VARS: Record<Rarity, RarityVars> = {
  common:      { '--rc': 'hsl(35,10%,55%)',   '--rb': 'hsl(35,8%,14%)' },
  uncommon:    { '--rc': 'hsl(120,40%,46%)',  '--rb': 'hsl(120,25%,12%)' },
  rare:        { '--rc': 'hsl(210,65%,58%)',  '--rb': 'hsl(210,40%,14%)' },
  'very-rare': { '--rc': 'hsl(270,55%,62%)',  '--rb': 'hsl(270,35%,16%)' },
  legendary: {
    '--rc': 'hsl(38,90%,58%)',
    '--rb': 'hsl(38,60%,13%)',
    '--rg': '0 0 12px hsl(38 90% 50% / 0.2)',
  },
  artifact: {
    '--rc': 'hsl(42,100%,62%)',
    '--rb': 'hsl(42,70%,12%)',
    '--rg': '0 0 20px hsl(42 100% 55% / 0.25), 0 0 40px hsl(42 100% 50% / 0.1)',
  },
};

const SCHOOL_VARS: Record<SpellSchool, SchoolVars> = {
  evocation:     { '--school-color': 'hsl(0,65%,55%)',   '--school-bg': 'hsl(0,50%,15%)' },
  illusion:      { '--school-color': 'hsl(260,55%,62%)', '--school-bg': 'hsl(260,40%,18%)' },
  necromancy:    { '--school-color': 'hsl(140,40%,38%)', '--school-bg': 'hsl(140,30%,12%)' },
  abjuration:    { '--school-color': 'hsl(200,60%,50%)', '--school-bg': 'hsl(200,40%,14%)' },
  conjuration:   { '--school-color': 'hsl(40,70%,50%)',  '--school-bg': 'hsl(40,50%,12%)' },
  divination:    { '--school-color': 'hsl(180,50%,45%)', '--school-bg': 'hsl(180,35%,12%)' },
  enchantment:   { '--school-color': 'hsl(320,50%,55%)', '--school-bg': 'hsl(320,35%,14%)' },
  transmutation: { '--school-color': 'hsl(80,45%,42%)',  '--school-bg': 'hsl(80,30%,12%)' },
};

export function getRarityVars(rarity: Rarity): RarityVars {
  return RARITY_VARS[rarity] ?? RARITY_VARS.common;
}

export function normalizeRarity(rarity: string): Rarity {
  const normalized = rarity.trim().toLowerCase().replace(/\s+/g, '-') as Rarity;
  return normalized in RARITY_VARS ? normalized : 'common';
}

export function getSchoolVars(school: SpellSchool): SchoolVars {
  return SCHOOL_VARS[school] ?? SCHOOL_VARS.evocation;
}

export type DescriptionSegment = { type: 'text' | 'bold'; content: string };

export function parseBoldDescription(text: string): DescriptionSegment[] {
  if (!text) return [{ type: 'text', content: '' }];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { type: 'bold' as const, content: part.slice(2, -2) };
      }
      return { type: 'text' as const, content: part };
    });
}

export function formatAbilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `\u2212${Math.abs(mod)}`;
}
