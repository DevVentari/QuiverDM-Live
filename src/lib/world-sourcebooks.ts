export interface WorldSourcebook {
  id: string;
  title: string;
  subtitle: string;
  sourceSlug: string; // slug of the seeded demo campaign to copy from
  tags: string[];
  gradient: string;
}

export const WORLD_SOURCEBOOKS: WorldSourcebook[] = [
  {
    id: 'hameria-ire',
    title: 'Tales from the Bonfire Keep',
    subtitle: 'Hameria Ire — a world held in stasis by an ancient crime',
    sourceSlug: 'tales-from-the-bonfire-keep',
    tags: ['homebrew', 'cosmic', 'original'],
    gradient: 'from-orange-950 via-stone-900 to-orange-950',
  },
];
