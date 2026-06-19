export const NOTE_TYPES = ['read_aloud', 'tactic', 'secret', 'check', 'lore', 'trigger'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const NOTE_LABEL: Record<NoteType, string> = {
  read_aloud: 'read-aloud',
  tactic: 'tactic',
  secret: 'secret',
  check: 'check',
  lore: 'lore',
  trigger: 'trigger',
};

export const NOTE_TINT: Record<NoteType, string> = {
  read_aloud: 'var(--qd-accent-text)',
  tactic: 'var(--qd-arcane)',
  secret: 'var(--qd-accent-bright)',
  check: 'var(--qd-success)',
  lore: 'var(--qd-ink-muted)',
  trigger: 'var(--qd-danger-bright)',
};

export interface SceneNote {
  id: string;
  type: NoteType;
  title: string | null;
  body: string;
  data: unknown;
  orderIndex: number;
  source: string;
}
