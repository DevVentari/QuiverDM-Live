export const SCENE_TYPES = ['rp', 'description', 'tavern', 'battle', 'theatre'] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const MOOD_LABELS: Record<SceneType, string> = {
  rp: 'RP',
  description: 'Description',
  tavern: 'Tavern',
  battle: 'Combat',
  theatre: 'Set-piece',
};

export interface SceneFormState {
  title: string;
  mood: SceneType | null;
  partyPresentIds: string[];
  linkedEntityIds: string[];
  description: string;
}

export const EMPTY_SCENE_FORM: SceneFormState = {
  title: '', mood: null, partyPresentIds: [], linkedEntityIds: [], description: '',
};
