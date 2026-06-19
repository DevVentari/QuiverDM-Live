// src/lib/sourcebook-openings/cos/index.ts
import type { OpeningConfig } from '../types';
import { rollTarokka } from './tarokka';

/** Curse of Strahd — Death House → Village of Barovia opening (level 1). */
export const cosOpening: OpeningConfig = {
  slug: 'cos',
  sceneBlueprints: [
    {
      key: 'into-the-mists',
      title: 'Into the Mists',
      type: 'description',
      intent:
        'The strong start: the party is drawn into the mist-shrouded realm of Barovia. Write a chilling read-aloud as the fog closes behind them and the gates of Barovia loom. Establish that there is no turning back.',
    },
    {
      key: 'village-of-barovia',
      title: 'The Village of Barovia',
      type: 'rp',
      intent:
        'The party reaches the grim village of Barovia. Introduce Ismark Kolyanovich and his sister Ireena at the tavern or the Burgomaster’s mansion, the townsfolk’s dread of Strahd, and the plea to protect Ireena. Give the DM the tactics and secrets to run the encounter.',
      linkEntityNames: ['Ismark', 'Ireena', 'Ireena Kolyana', 'Donavich'],
    },
    {
      key: 'death-house',
      title: 'The Crying Children',
      type: 'description',
      intent:
        'The Death House hook: two frightened children, Rose and Thorn, beg the party to save their baby brother trapped inside a looming townhouse. Write the read-aloud and the secret of what truly waits within.',
      linkEntityNames: ['Rose', 'Thorn', 'Death House'],
    },
  ],
  tarokka: {
    sceneTitle: "Madam Eva's Reading",
    roll: rollTarokka,
  },
};
