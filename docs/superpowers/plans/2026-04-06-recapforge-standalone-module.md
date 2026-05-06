# RecapForge Standalone Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone `src/components/recap/` component library and `src/store/recap-store.ts` per the PRD Package at `docs/Modules/RecapForge-PRD-Package/`. Existing page files are NOT modified — these components are extracted/cloned alongside the current implementation for eventual integration.

**Architecture:** Each component is a self-contained, prop-driven React component. State that crosses component boundaries (editing, clarification answers, UI preferences) lives in a Zustand store. Components use QuiverDM's existing design tokens (glass-panel, stone-card, section-rule, Cinzel/Bricolage, amber oklch tokens) — no new CSS variables introduced.

**Tech Stack:** React 18, TypeScript, Zustand, Framer Motion, Lucide React, shadcn/ui, tRPC (referenced via types only — components receive data via props, not queries directly, except `RecapCard` which already queries).

**Source of truth:** `docs/Modules/RecapForge-PRD-Package/05-COMPONENTS.md` and `03-STYLE-CARD.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/store/recap-store.ts` | Create | Zustand store: editing state, clarification answers, UI prefs |
| `src/components/recap/pending-badge.tsx` | Create | Pill badge showing pending review count |
| `src/components/recap/recap-stats.tsx` | Create | "47h transcribed · 22 sessions · 3 pending" glass row |
| `src/components/recap/style-selector.tsx` | Create | 4-style pill selector, cloned from recap/page.tsx inline style picker |
| `src/components/recap/recap-section.tsx` | Create | Single editable recap section, cloned from recap/page.tsx inline section logic |
| `src/components/recap/recap-viewer.tsx` | Create | Full recap viewer composition: style-selector + recap-section list + action bar |
| `src/components/recap/discord-preview.tsx` | Create | Discord share preview: mock message, char count, format/thread toggles |
| `src/components/recap/campaign-card.tsx` | Create | Campaign card for /recap dashboard, cloned from inline card in /recap/page.tsx |
| `src/components/recap/session-list-item.tsx` | Create | Session row for /recap dashboard, cloned from inline row in /recap/page.tsx |

---

### Task 1: Zustand store — recap-store.ts

**Files:**
- Create: `src/store/recap-store.ts`

- [ ] **Step 1: Create the store**

```ts
import { create } from 'zustand';
import type { RecapStyle } from '@prisma/client';

interface RecapStore {
  // Active editing
  editingRecapId: string | null;
  editingSectionKey: string | null;
  editDraft: string;
  setEditing: (recapId: string, sectionKey: string, content: string) => void;
  clearEditing: () => void;
  updateDraft: (content: string) => void;

  // Clarification state (client-side before submission)
  clarificationAnswers: Record<string, string>;
  setAnswer: (questionId: string, answer: string) => void;
  clearAnswers: () => void;

  // UI preferences (persisted in localStorage via zustand/middleware if needed)
  preferredStyle: RecapStyle;
  preferredCharLimit: 2000 | 3000;
  preferredThreadMode: boolean;
  setPreferredStyle: (style: RecapStyle) => void;
  setPreferredCharLimit: (limit: 2000 | 3000) => void;
  setPreferredThreadMode: (mode: boolean) => void;
}

export const useRecapStore = create<RecapStore>((set) => ({
  editingRecapId: null,
  editingSectionKey: null,
  editDraft: '',
  setEditing: (recapId, sectionKey, content) =>
    set({ editingRecapId: recapId, editingSectionKey: sectionKey, editDraft: content }),
  clearEditing: () =>
    set({ editingRecapId: null, editingSectionKey: null, editDraft: '' }),
  updateDraft: (content) => set({ editDraft: content }),

  clarificationAnswers: {},
  setAnswer: (questionId, answer) =>
    set((s) => ({ clarificationAnswers: { ...s.clarificationAnswers, [questionId]: answer } })),
  clearAnswers: () => set({ clarificationAnswers: {} }),

  preferredStyle: 'NARRATIVE',
  preferredCharLimit: 2000,
  preferredThreadMode: false,
  setPreferredStyle: (style) => set({ preferredStyle: style }),
  setPreferredCharLimit: (limit) => set({ preferredCharLimit: limit }),
  setPreferredThreadMode: (mode) => set({ preferredThreadMode: mode }),
}));
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap-store" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/recap-store.ts
git commit -m "feat(recap): add recap Zustand store"
```

---

### Task 2: PendingBadge and RecapStats

**Files:**
- Create: `src/components/recap/pending-badge.tsx`
- Create: `src/components/recap/recap-stats.tsx`

- [ ] **Step 1: Create pending-badge.tsx**

```tsx
'use client';

interface PendingBadgeProps {
  count: number;
  className?: string;
}

export function PendingBadge({ count, className }: PendingBadgeProps) {
  if (count === 0) return null;
  return (
    <span
      className={className}
      style={{
        background: 'hsl(200 70% 55%)',
        color: 'white',
        fontFamily: 'var(--font-bricolage)',
        fontSize: '11px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '9999px',
        lineHeight: 1,
        display: 'inline-block',
      }}
    >
      {count}
    </span>
  );
}
```

- [ ] **Step 2: Create recap-stats.tsx**

```tsx
'use client';

interface RecapStatsProps {
  totalHoursTranscribed: number;
  totalSessions: number;
  pendingReviews: number;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(0)}h`;
}

export function RecapStats({ totalHoursTranscribed, totalSessions, pendingReviews }: RecapStatsProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs"
      style={{
        background: 'hsl(35 15% 12% / 0.6)',
        border: '1px solid hsl(35 20% 20% / 0.4)',
        fontFamily: 'var(--font-bricolage)',
        color: 'hsl(35 5% 48%)',
      }}
    >
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(35 20% 68%)' }}>
          {formatHours(totalHoursTranscribed)}
        </span>{' '}
        transcribed
      </span>
      <span style={{ color: 'hsl(35 10% 28%)' }}>·</span>
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(35 20% 68%)' }}>
          {totalSessions}
        </span>{' '}
        sessions
      </span>
      {pendingReviews > 0 && (
        <>
          <span style={{ color: 'hsl(35 10% 28%)' }}>·</span>
          <span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'hsl(200 70% 60%)' }}>
              {pendingReviews}
            </span>{' '}
            pending review
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "pending-badge\|recap-stats" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/recap/pending-badge.tsx src/components/recap/recap-stats.tsx
git commit -m "feat(recap): add PendingBadge and RecapStats standalone components"
```

---

### Task 3: StyleSelector

**Files:**
- Create: `src/components/recap/style-selector.tsx`

Cloned from the style picker pills inline in `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`. The existing page uses `activeStyle` and `setActiveStyle` local state plus a `bestStatusFor` helper to show status dots per style. This standalone version accepts all of that via props.

- [ ] **Step 1: Create style-selector.tsx**

```tsx
'use client';

import type { RecapStyle, RecapStatus } from '@prisma/client';

const STYLE_LABELS: Record<RecapStyle, string> = {
  NARRATIVE: 'Narrative',
  SESSION_LOG: 'Session Log',
  BARDS_TALE: "Bard's Tale",
  PREVIOUSLY_ON: 'Previously On',
};

const STYLE_ACCENTS: Record<RecapStyle, string> = {
  NARRATIVE: 'hsl(35 80% 55%)',
  SESSION_LOG: 'hsl(200 60% 50%)',
  BARDS_TALE: 'hsl(280 50% 55%)',
  PREVIOUSLY_ON: 'hsl(150 50% 45%)',
};

const STATUS_DOT: Record<RecapStatus, string> = {
  QUICK_FIRE: 'bg-yellow-400/70',
  REVIEWED: 'bg-amber-500/60',
  AUTO_GENERATED: 'bg-green-500/60',
  GENERATING: 'bg-blue-500/50',
  FAILED: 'bg-red-500/60',
};

interface StyleSelectorProps {
  activeStyle: RecapStyle;
  onChange: (style: RecapStyle) => void;
  disabled?: boolean;
  /** Highest-status recap available per style — used to show status dot */
  bestStatus?: Partial<Record<RecapStyle, RecapStatus>>;
}

const STYLE_PRIORITY: RecapStatus[] = ['QUICK_FIRE', 'REVIEWED', 'AUTO_GENERATED'];

export function StyleSelector({ activeStyle, onChange, disabled, bestStatus }: StyleSelectorProps) {
  const styles: RecapStyle[] = ['NARRATIVE', 'SESSION_LOG', 'BARDS_TALE', 'PREVIOUSLY_ON'];

  return (
    <div className="flex flex-wrap gap-2">
      {styles.map((style) => {
        const isActive = style === activeStyle;
        const accent = STYLE_ACCENTS[style];
        const dotStatus = bestStatus?.[style];
        const dotClass = dotStatus ? STATUS_DOT[dotStatus] : null;

        return (
          <button
            key={style}
            onClick={() => !disabled && onChange(style)}
            disabled={disabled}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-all"
            style={{
              borderLeft: `3px solid ${accent}`,
              background: isActive ? `${accent}22` : 'hsl(35 10% 12% / 0.6)',
              color: isActive ? accent : 'hsl(35 5% 48%)',
              border: isActive ? `1px solid ${accent}40` : '1px solid hsl(35 10% 18% / 0.5)',
              borderLeft: `3px solid ${accent}`,
              fontFamily: 'var(--font-bricolage)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {dotClass && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
            )}
            {STYLE_LABELS[style]}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "style-selector" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/style-selector.tsx
git commit -m "feat(recap): add StyleSelector standalone component"
```

---

### Task 4: RecapSection

**Files:**
- Create: `src/components/recap/recap-section.tsx`

Cloned from the inline section editing logic in `src/app/(app)/campaigns/[slug]/sessions/[sessionId]/recap/page.tsx`. The existing page manages editing state with `editingKey`, `regenKey`, `regenNote` local state. This standalone version is fully controlled — all state lives outside (in the parent or Zustand store).

- [ ] **Step 1: Create recap-section.tsx**

```tsx
'use client';

import { useRef, useEffect } from 'react';
import { Pencil, RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecapSectionProps {
  sectionKey: string;
  title: string;
  content: string;
  isEditing: boolean;
  isRegenerating: boolean;
  regenNote: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onContentChange: (content: string) => void;
  onRegenNoteChange: (note: string) => void;
  onRegenerate: () => void;
}

export function RecapSection({
  sectionKey,
  title,
  content,
  isEditing,
  isRegenerating,
  regenNote,
  onEdit,
  onCancelEdit,
  onContentChange,
  onRegenNoteChange,
  onRegenerate,
}: RecapSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  return (
    <div
      className="py-4 first:pt-0"
      style={isEditing ? { borderLeft: '2px solid hsl(35 60% 42% / 0.5)', paddingLeft: '12px' } : {}}
    >
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 60% 42%)' }}
        >
          {title}
        </h3>
        <div className="flex gap-1">
          {isEditing ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              onClick={onCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-60 hover:!opacity-100"
                onClick={onEdit}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit();
            }}
            rows={6}
            className="w-full resize-none rounded-sm px-3 py-2 text-sm leading-relaxed focus:outline-none"
            style={{
              background: 'hsl(35 10% 8% / 0.8)',
              border: '1px solid hsl(35 20% 22% / 0.6)',
              color: 'hsl(35 10% 72%)',
              fontFamily: 'var(--font-bricolage)',
            }}
          />
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={regenNote}
              onChange={(e) => onRegenNoteChange(e.target.value)}
              placeholder="Note for AI regen… (optional)"
              className="flex-1 h-7 px-2 text-xs rounded-sm focus:outline-none"
              style={{
                background: 'hsl(35 10% 8% / 0.6)',
                border: '1px solid hsl(35 15% 18% / 0.5)',
                color: 'hsl(35 10% 60%)',
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs px-2"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Regen
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="text-sm leading-relaxed cursor-text"
          style={{
            fontFamily: 'var(--font-bricolage)',
            color: 'hsl(35 10% 72%)',
            lineHeight: '1.65',
          }}
          onClick={onEdit}
        >
          {content}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap-section" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/recap-section.tsx
git commit -m "feat(recap): add RecapSection standalone component"
```

---

### Task 5: RecapViewer

**Files:**
- Create: `src/components/recap/recap-viewer.tsx`

Composition component that wraps `StyleSelector` + `RecapSection` list + action bar. This is the centrepiece of the module as described in `05-COMPONENTS.md` and `03-STYLE-CARD.md`. Receives all data via props — no tRPC queries.

- [ ] **Step 1: Create recap-viewer.tsx**

```tsx
'use client';

import { useState } from 'react';
import { MessageSquare, Copy, FileDown, Zap, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StyleSelector } from './style-selector';
import { RecapSection } from './recap-section';
import type { RecapStyle, RecapStatus } from '@prisma/client';

interface RecapSection {
  key: string;
  title: string;
  content: string;
}

interface RecapViewerProps {
  recapId: string;
  sections: RecapSection[];
  activeStyle: RecapStyle;
  status: RecapStatus;
  bestStatusPerStyle?: Partial<Record<RecapStyle, RecapStatus>>;
  isDirty: boolean;
  isApproving: boolean;
  isSharing: boolean;
  /** Per-section regen state — key → boolean */
  regenningKeys: Set<string>;
  onStyleChange: (style: RecapStyle) => void;
  onSectionChange: (key: string, content: string) => void;
  onApprove: (status: 'REVIEWED' | 'QUICK_FIRE') => void;
  onShare: () => void;
  onCopyMarkdown: () => void;
  onExportMarkdown: () => void;
  onRegenSection: (key: string, dmNote: string) => void;
}

export function RecapViewer({
  recapId,
  sections,
  activeStyle,
  status,
  bestStatusPerStyle,
  isDirty,
  isApproving,
  isSharing,
  regenningKeys,
  onStyleChange,
  onSectionChange,
  onApprove,
  onShare,
  onCopyMarkdown,
  onExportMarkdown,
  onRegenSection,
}: RecapViewerProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [regenNote, setRegenNote] = useState('');

  const showApproveBar = status === 'AUTO_GENERATED' || isDirty;
  const showShareButton =
    ['REVIEWED', 'QUICK_FIRE'].includes(status) && !isDirty;

  return (
    <div
      className="rounded-sm p-6 space-y-1"
      style={{
        background: 'hsl(35 10% 10% / 0.7)',
        border: '1px solid hsl(35 15% 18% / 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Style selector */}
      <div className="mb-4">
        <StyleSelector
          activeStyle={activeStyle}
          onChange={onStyleChange}
          bestStatus={bestStatusPerStyle}
        />
      </div>

      {/* Section rule */}
      <div className="section-rule my-4" />

      {/* Sections */}
      <div className="group space-y-0 divide-y divide-[hsl(35_10%_18%_/_0.3)]">
        {sections.map((s) => (
          <RecapSection
            key={s.key}
            sectionKey={s.key}
            title={s.title}
            content={s.content}
            isEditing={editingKey === s.key}
            isRegenerating={regenningKeys.has(s.key)}
            regenNote={editingKey === s.key ? regenNote : ''}
            onEdit={() => {
              setEditingKey(s.key);
              setRegenNote('');
            }}
            onCancelEdit={() => setEditingKey(null)}
            onContentChange={(content) => onSectionChange(s.key, content)}
            onRegenNoteChange={setRegenNote}
            onRegenerate={() => {
              onRegenSection(s.key, regenNote);
              setEditingKey(null);
              setRegenNote('');
            }}
          />
        ))}
      </div>

      {/* Action bar */}
      <div className="section-rule my-4" />
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {showApproveBar && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditingKey(null);
                onApprove('REVIEWED');
              }}
              disabled={isApproving}
              style={
                status === 'REVIEWED'
                  ? { borderColor: 'hsl(35 60% 35%)', color: 'hsl(35 70% 58%)' }
                  : {}
              }
            >
              <CheckCircle className="h-3 w-3" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditingKey(null);
                onApprove('QUICK_FIRE');
              }}
              disabled={isApproving}
            >
              <Zap className="h-3 w-3" /> Quick-fire
            </Button>
          </>
        )}
        {showShareButton && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={onShare}
            disabled={isSharing}
          >
            <MessageSquare className="h-3 w-3" /> Share to Discord
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs ml-auto"
          onClick={onCopyMarkdown}
        >
          <Copy className="h-3 w-3" /> Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          onClick={onExportMarkdown}
        >
          <FileDown className="h-3 w-3" /> Export
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "recap-viewer" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/recap-viewer.tsx
git commit -m "feat(recap): add RecapViewer standalone composition component"
```

---

### Task 6: DiscordPreview

**Files:**
- Create: `src/components/recap/discord-preview.tsx`

New component per PRD `05-COMPONENTS.md`. Enhanced version of the current share Dialog — adds real character count, Standard (2000) / Nitro (3000) char limit toggle, and thread mode toggle. The existing Dialog in `recap/page.tsx` is a simple preview; this is the full PRD-spec component.

- [ ] **Step 1: Create discord-preview.tsx**

```tsx
'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';

interface RecapSection {
  key: string;
  title: string;
  content: string;
}

interface DiscordPreviewProps {
  sessionTitle: string;
  sections: RecapSection[];
  charLimit: 2000 | 3000;
  threadMode: boolean;
  isPending: boolean;
  onCharLimitChange: (limit: 2000 | 3000) => void;
  onThreadModeChange: (enabled: boolean) => void;
  onShare: () => void;
  onCancel: () => void;
}

function buildDiscordMessage(sessionTitle: string, sections: RecapSection[]): string {
  const header = `**${sessionTitle} — Session Recap**\n\n`;
  const body = sections
    .filter((s) => s.title && s.content)
    .map((s) => `**${s.title}**\n${s.content}`)
    .join('\n\n');
  return header + body;
}

function CharCountBar({ count, limit }: { count: number; limit: number }) {
  const ratio = count / limit;
  const color =
    ratio > 1
      ? 'hsl(0 70% 55%)'
      : ratio > 0.9
        ? 'hsl(35 80% 52%)'
        : 'hsl(35 5% 45%)';

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color,
      }}
    >
      {count.toLocaleString()} / {limit.toLocaleString()}
    </span>
  );
}

function PillToggle<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-sm overflow-hidden" style={{ border: '1px solid hsl(35 15% 20% / 0.6)' }}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 text-xs transition-colors"
          style={{
            background: opt.value === value ? 'hsl(35 60% 38% / 0.4)' : 'transparent',
            color: opt.value === value ? 'hsl(35 70% 60%)' : 'hsl(35 5% 45%)',
            borderRight: '1px solid hsl(35 15% 20% / 0.4)',
            fontFamily: 'var(--font-bricolage)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DiscordPreview({
  sessionTitle,
  sections,
  charLimit,
  threadMode,
  isPending,
  onCharLimitChange,
  onThreadModeChange,
  onShare,
  onCancel,
}: DiscordPreviewProps) {
  const fullMessage = useMemo(
    () => buildDiscordMessage(sessionTitle, sections),
    [sessionTitle, sections],
  );

  const charCount = fullMessage.length;
  const exceedsLimit = !threadMode && charCount > charLimit;

  const previewText =
    fullMessage.length > 300 ? fullMessage.slice(0, 300) + '…' : fullMessage;

  return (
    <div className="space-y-4">
      {/* Mock Discord message */}
      <div
        className="rounded-sm p-4"
        style={{
          background: 'hsl(240 10% 9%)',
          borderLeft: '3px solid hsl(35 60% 42%)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold" style={{ color: 'hsl(35 60% 62%)' }}>
            QuiverDM BOT
          </span>
          <span className="text-[10px]" style={{ color: 'hsl(35 5% 38%)' }}>
            Today
          </span>
        </div>
        <p
          className="text-xs leading-relaxed whitespace-pre-wrap"
          style={{ color: 'hsl(35 5% 60%)', fontFamily: 'var(--font-bricolage)' }}
        >
          {previewText}
        </p>
        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid hsl(35 10% 18% / 0.4)' }}>
          <CharCountBar count={charCount} limit={charLimit} />
          {threadMode && (
            <span className="text-[10px]" style={{ color: 'hsl(200 60% 55%)' }}>
              Thread mode — will split automatically
            </span>
          )}
        </div>
      </div>

      {/* Format toggles */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'hsl(35 5% 45%)' }}>Format:</span>
          <PillToggle
            options={[
              { label: 'Standard (2000)', value: 2000 as const },
              { label: 'Nitro (3000)', value: 3000 as const },
            ]}
            value={charLimit}
            onChange={onCharLimitChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'hsl(35 5% 45%)' }}>Mode:</span>
          <PillToggle
            options={[
              { label: 'Single post', value: 'single' as const },
              { label: 'Thread (split)', value: 'thread' as const },
            ]}
            value={threadMode ? 'thread' : 'single'}
            onChange={(v) => onThreadModeChange(v === 'thread')}
          />
        </div>
      </div>

      {exceedsLimit && (
        <p className="text-xs" style={{ color: 'hsl(0 70% 55%)' }}>
          Content exceeds {charLimit} characters. Switch to Thread mode or reduce content.
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onShare}
          disabled={isPending || exceedsLimit}
        >
          {isPending ? 'Posting…' : 'Share to Discord'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "discord-preview" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/recap/discord-preview.tsx
git commit -m "feat(recap): add DiscordPreview standalone component with char count and thread mode"
```

---

### Task 7: CampaignCard and SessionListItem

**Files:**
- Create: `src/components/recap/campaign-card.tsx`
- Create: `src/components/recap/session-list-item.tsx`

Cloned from inline JSX in `src/app/(app)/recap/page.tsx` and promoted to proper named components per PRD `05-COMPONENTS.md`.

- [ ] **Step 1: Create campaign-card.tsx**

```tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { PendingBadge } from './pending-badge';

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    slug: string;
    totalRecaps: number;
    pendingReview: number;
    lastRecapDate: Date | null;
    lastSessionTitle: string | null;
  };
  isActive: boolean;
  onClick: () => void;
}

export function CampaignCard({ campaign, isActive, onClick }: CampaignCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-sm p-4 transition-all min-w-[280px] max-w-[360px] w-full flex flex-col gap-2"
      style={{
        background: isActive
          ? 'hsl(35 20% 12% / 0.9)'
          : 'hsl(35 10% 10% / 0.7)',
        border: isActive
          ? '1px solid hsl(35 60% 38% / 0.6)'
          : '1px solid hsl(35 10% 18% / 0.4)',
        boxShadow: isActive ? '0 0 0 1px hsl(35 60% 38% / 0.2)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.1em] leading-tight"
          style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 60% 62%)' }}
        >
          {campaign.name}
        </h3>
        <PendingBadge count={campaign.pendingReview} />
      </div>

      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'hsl(35 5% 38%)' }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{campaign.totalRecaps}</span>
        <span>sessions</span>
        {campaign.lastRecapDate && (
          <>
            <span>·</span>
            <span>{formatDistanceToNow(campaign.lastRecapDate, { addSuffix: true })}</span>
          </>
        )}
      </div>

      {campaign.lastSessionTitle && (
        <p
          className="text-[12px] italic line-clamp-2"
          style={{ color: 'hsl(35 5% 42%)', fontFamily: 'var(--font-bricolage)' }}
        >
          {campaign.lastSessionTitle}
        </p>
      )}

      {!campaign.lastSessionTitle && campaign.totalRecaps === 0 && (
        <p
          className="text-[11px] italic"
          style={{ color: 'hsl(35 5% 32%)' }}
        >
          No sessions yet
        </p>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Create session-list-item.tsx**

```tsx
'use client';

import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import type { RecapStatus, RecapStyle } from '@prisma/client';

const STATUS_LABEL: Partial<Record<RecapStatus, string>> = {
  REVIEWED: 'Reviewed',
  QUICK_FIRE: 'Quick-fire',
  AUTO_GENERATED: 'Pending',
};

const STATUS_DOT_COLOR: Partial<Record<RecapStatus, string>> = {
  REVIEWED: 'hsl(35 60% 50%)',
  QUICK_FIRE: 'hsl(50 80% 50%)',
  AUTO_GENERATED: 'hsl(140 50% 45%)',
};

const STYLE_LABEL: Partial<Record<RecapStyle, string>> = {
  NARRATIVE: 'Narrative',
  SESSION_LOG: 'Session Log',
  BARDS_TALE: "Bard's Tale",
  PREVIOUSLY_ON: 'Previously On',
};

interface SessionListItemProps {
  session: {
    recapId: string;
    sessionId: string;
    sessionTitle: string | null;
    sessionNumber: number | null;
    sessionDate: Date;
    campaignId: string;
    campaignName: string;
    slug: string;
    status: RecapStatus;
    style: RecapStyle | null;
    sharedToDiscord?: boolean;
  };
  showCampaignName?: boolean;
}

export function SessionListItem({ session, showCampaignName }: SessionListItemProps) {
  const title = session.sessionTitle ?? `Session ${session.sessionNumber ?? '?'}`;
  const dotColor = STATUS_DOT_COLOR[session.status];
  const isPending = session.status === 'AUTO_GENERATED';

  return (
    <Link
      href={`/campaigns/${session.slug}/sessions/${session.sessionId}/recap`}
      className="flex items-center gap-3 px-4 py-3 rounded-sm transition-colors hover:bg-[hsl(35_10%_12%_/_0.6)] group"
      style={{
        borderLeft: isPending ? '2px solid hsl(35 60% 42% / 0.4)' : '2px solid transparent',
      }}
    >
      {/* Status dot */}
      {dotColor && (
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ background: dotColor }}
          aria-label={STATUS_LABEL[session.status]}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'hsl(35 10% 78%)' }}
          >
            {title}
          </span>
          {showCampaignName && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-sm"
              style={{
                background: 'hsl(35 10% 14% / 0.8)',
                color: 'hsl(35 5% 42%)',
                fontFamily: 'var(--font-bricolage)',
              }}
            >
              {session.campaignName}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 text-[11px] mt-0.5"
          style={{ color: 'hsl(35 5% 38%)', fontFamily: 'var(--font-bricolage)' }}
        >
          <span>{format(session.sessionDate, 'MMM d, yyyy')}</span>
          {session.style && (
            <>
              <span>·</span>
              <span>{STYLE_LABEL[session.style]}</span>
            </>
          )}
          {session.sharedToDiscord && (
            <>
              <span>·</span>
              <MessageSquare className="h-2.5 w-2.5" aria-label="Shared to Discord" />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {STATUS_LABEL[session.status] && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
            style={{
              background: isPending ? 'hsl(200 70% 55% / 0.15)' : 'hsl(35 10% 14% / 0.6)',
              color: isPending ? 'hsl(200 70% 65%)' : 'hsl(35 5% 42%)',
            }}
          >
            {STATUS_LABEL[session.status]}
          </span>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Type check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | grep "campaign-card\|session-list-item" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/recap/campaign-card.tsx src/components/recap/session-list-item.tsx
git commit -m "feat(recap): add CampaignCard and SessionListItem standalone components"
git push origin main
```
