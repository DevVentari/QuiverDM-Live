// src/lib/sourcebook-openings/types.ts
import type { SceneType } from '@/lib/ai/generate-scene';

/** A single scene to author for Session 0. */
export interface SceneBlueprint {
  /** Stable key, stamped into Scene.promptInput for idempotent re-seeding. */
  key: string;
  title: string;
  type: SceneType; // 'rp' | 'description' | 'tavern' | 'battle' | 'theatre'
  /** AI intent: what the scene is and the read-aloud goal. */
  intent: string;
  /** WorldEntity names to prefer-link (resolved case-insensitively within the campaign). */
  linkEntityNames?: string[];
}

/** Per-sourcebook Tarokka config. `roll` is the sourcebook's pure roller. */
export interface TarokkaConfig {
  /** DM scene title for the reading. */
  sceneTitle: string;
  /** Pure function: seed → reading. */
  roll: (seed: string) => { seed: string; draws: Array<{ slot: string; label: string; card: string; location: string }> };
}

export interface OpeningConfig {
  slug: string;
  sceneBlueprints: SceneBlueprint[];
  tarokka?: TarokkaConfig;
}
