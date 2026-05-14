export type SemanticAccentKey = 'primary' | 'quest' | 'success' | 'danger' | 'arcane' | 'neutral';

export type SemanticAccentToken = {
  text: string;
  border: string;
  trace: string;
  glow: string;
};

export const semanticAccentTokens: Record<SemanticAccentKey, SemanticAccentToken> = {
  primary: {
    text: 'var(--q-accent-primary)',
    border: 'var(--q-accent-primary-border)',
    trace: 'var(--q-accent-primary-trace)',
    glow: 'var(--q-accent-primary-glow)',
  },
  quest: {
    text: 'var(--q-accent-quest)',
    border: 'var(--q-accent-quest-border)',
    trace: 'var(--q-accent-quest-trace)',
    glow: 'var(--q-accent-quest-glow)',
  },
  success: {
    text: 'var(--q-accent-success)',
    border: 'var(--q-accent-success-border)',
    trace: 'var(--q-accent-success-trace)',
    glow: 'var(--q-accent-success-glow)',
  },
  danger: {
    text: 'var(--q-accent-danger)',
    border: 'var(--q-accent-danger-border)',
    trace: 'var(--q-accent-danger-trace)',
    glow: 'var(--q-accent-danger-glow)',
  },
  arcane: {
    text: 'var(--q-accent-arcane)',
    border: 'var(--q-accent-arcane-border)',
    trace: 'var(--q-accent-arcane-trace)',
    glow: 'var(--q-accent-arcane-glow)',
  },
  neutral: {
    text: 'var(--q-accent-neutral)',
    border: 'var(--q-accent-neutral-border)',
    trace: 'var(--q-accent-neutral-trace)',
    glow: 'var(--q-accent-neutral-glow)',
  },
};
