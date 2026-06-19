/**
 * Shared scene types. The note-board pipeline (scene-notes.ts) and the
 * server-side glue (scene-generation.service.ts) build their prompt context
 * from these. The old monolithic generateScene() path was removed when the
 * scene surface moved to the note board; this file now holds only the shared
 * types it left behind.
 */
export type SceneType = 'rp' | 'description' | 'tavern' | 'battle' | 'theatre';

export interface SceneContext {
  intent: string;
  mood?: SceneType;
  tagged: Array<{
    id: string; name: string; type: string;
    description?: string; statSummary?: string;
    history?: string[]; // recent WorldStateChange triggerText lines (Brain weave)
  }>;
  party: Array<{ name: string; summary: string; hook?: string }>; // hook = a bond/flaw line
  campaignName?: string;
}
