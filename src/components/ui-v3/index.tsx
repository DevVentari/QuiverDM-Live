/**
 * ui-v3 — QuiverDM v3 token-only primitive set.
 *
 * All components in this barrel use ONLY --qd-* CSS vars (via Tailwind qd-* utilities).
 * They deliberately do NOT import anything from @/components/ui/* (shadcn) to avoid
 * pulling in v2 design tokens (bg-background, text-foreground, etc.).
 *
 * Consumers: src/app/v3/** (and any v3 cluster being ported from v2 UI).
 */
export { QdButton } from './QdButton';
export type { QdButtonProps, QdButtonVariant } from './QdButton';

export { QdInput } from './QdInput';
export type { QdInputProps } from './QdInput';

export { QdTextarea } from './QdTextarea';
export type { QdTextareaProps } from './QdTextarea';

export { QdLabel } from './QdLabel';
export type { QdLabelProps } from './QdLabel';

export { QdProgress } from './QdProgress';
export type { QdProgressProps } from './QdProgress';

export { QdTabs } from './QdTabs';
export type { QdTabsProps, QdTabItem } from './QdTabs';

export { QdModal } from './QdModal';
export type { QdModalProps } from './QdModal';

export { QdPanel } from './QdPanel';
export type { QdPanelProps } from './QdPanel';
