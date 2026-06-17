// src/lib/sourcebook-openings/index.ts
import type { OpeningConfig } from './types';
import { genericOpening } from './generic';
import { cosOpening } from './cos';

const REGISTRY: Record<string, OpeningConfig> = {
  cos: cosOpening,
};

/** Resolve a sourcebook's opening config by slug, falling back to a generic blueprint. */
export function resolveOpeningConfig(slug: string): OpeningConfig {
  return REGISTRY[slug.toLowerCase()] ?? genericOpening(slug);
}

export type { OpeningConfig, SceneBlueprint, TarokkaConfig } from './types';
