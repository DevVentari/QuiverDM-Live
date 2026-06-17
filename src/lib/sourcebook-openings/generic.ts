// src/lib/sourcebook-openings/generic.ts
import type { OpeningConfig } from './types';

/** Fallback for any sourcebook without a hand-tuned config: one strong-start scene. */
export function genericOpening(slug: string): OpeningConfig {
  return {
    slug,
    sceneBlueprints: [
      {
        key: 'strong-start',
        title: 'The Opening Scene',
        type: 'description',
        intent:
          'Write the strong-start opening moment for Session 0 of this adventure: a vivid read-aloud that drops the party into the world and presents the inciting hook. Use the linked locations and NPCs if present.',
      },
    ],
  };
}
