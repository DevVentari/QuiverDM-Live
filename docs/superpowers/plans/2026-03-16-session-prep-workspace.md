# Session Prep Workspace Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-step linear prep wizard with a free-form prep workspace where DMs import raw notes, DM Brain extracts and pre-populates sections, and all sections are accessible as collapsible cards.

**Architecture:** New `PrepWorkspace` component replaces `PrepWizard` at the same route. Existing 8 step components are reused unchanged inside collapsible `PrepSectionCard` wrappers. A new `PrepImportZone` handles file/text upload → R2 → AI extraction via new tRPC mutation.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Zod, Tailwind + shadcn/ui, Lucide icons, existing `/api/uploads` R2 presigned URL flow, `src/lib/ai/` multi-provider AI stack.

**Spec:** `docs/superpowers/specs/2026-03-16-session-prep-workspace-design.md`

---

## Chunk 1: Data Layer

### Task 1: Extend `SessionPrepData` with `importedNotes`

**Files:**
- Modify: `src/lib/prep-types.ts`

- [ ] **Step 1: Read the current schema**

  Open `src/lib/prep-types.ts` and note the existing `SessionPrepDataSchema` shape.

- [ ] **Step 2: Add `importedNotes` field**

  Add to `SessionPrepDataSchema` before the closing `})`:

  ```ts
  importedNotes: z.array(z.object({
    url: z.string().optional(),
    extractedAt: z.string(),
    sectionCounts: z.record(z.string(), z.number()),
  })).optional().default([]),
  ```

  Add to `emptyPrepData()` return value:

  ```ts
  importedNotes: [],
  ```

- [ ] **Step 3: Type-check**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors related to `prep-types.ts`.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/prep-types.ts
  git commit -m "feat(prep): add importedNotes field to SessionPrepData schema"
  ```

---

### Task 2: Add `extractPrepFromNotes` tRPC mutation

**Files:**
- Modify: `src/server/routers/sessions.ts`
- Create: `src/lib/ai/extract-prep-notes.ts`

- [ ] **Step 1: Create the AI extraction function stub**

  Create `src/lib/ai/extract-prep-notes.ts`:

  ```ts
  import { chatWithAI } from './index';
  import type { SessionPrepData } from '@/lib/prep-types';

  export interface ExtractPrepNotesInput {
    text: string;
    campaignContext: {
      npcs: Array<{ id: string; name: string }>;
      characters: Array<{ id: string; name: string }>;
      recentSessions: Array<{ title?: string | null; recap?: string | null }>;
    };
  }

  const SYSTEM_PROMPT = `You are a D&D session prep assistant. Extract structured prep content from the DM's raw notes.
  Return ONLY valid JSON matching the schema. Omit any field where no relevant content exists in the notes.`;

  const USER_TEMPLATE = (text: string, context: ExtractPrepNotesInput['campaignContext']) => `
  Campaign context:
  - Characters: ${context.characters.map(c => c.name).join(', ') || 'none'}
  - Known NPCs: ${context.npcs.map(n => n.name).join(', ') || 'none'}
  - Recent sessions: ${context.recentSessions.map(s => s.title ?? 'Untitled').join(', ') || 'none'}

  DM Notes:
  ${text}

  Extract prep content as JSON with these optional fields:
  {
    "strongStart": "string — opening hook or scene",
    "scenes": [{ "title": "string", "description": "string" }],
    "secretsAndClues": [{ "secret": "string" }],
    "npcs": [{ "name": "string", "goal": "string" }],
    "monsters": [{ "name": "string", "notes": "string" }],
    "rewards": [{ "name": "string", "description": "string" }],
    "looseThreads": [{ "thread": "string" }]
  }`;

  export async function extractPrepNotes(
    input: ExtractPrepNotesInput
  ): Promise<Partial<SessionPrepData>> {
    const response = await chatWithAI({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_TEMPLATE(input.text, input.campaignContext) },
      ],
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response) as Partial<SessionPrepData>;
    } catch {
      return {};
    }
  }
  ```

- [ ] **Step 2: Check how `chatWithAI` is exported**

  ```bash
  grep -n "export.*chatWithAI\|export.*function chat" src/lib/ai/index.ts | head -5
  ```

  Adjust import path in `extract-prep-notes.ts` if needed.

- [ ] **Step 3: Add the tRPC mutation**

  In `src/server/routers/sessions.ts`, add after the existing mutations:

  ```ts
  extractPrepFromNotes: campaignDMProcedure
    .input(z.object({
      sessionId: z.string(),
      url: z.string().optional(),
      text: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Fetch text from URL if provided (PDF/image — use rawText from existing pipeline if available)
      let text = input.text ?? '';

      if (input.url && !text) {
        // For images/PDFs uploaded to R2, attempt to fetch as plain text
        // (PDF processing is async; for now pass URL to AI directly as context)
        text = `[Uploaded document: ${input.url}]`;
      }

      if (!text) return {};

      const context = await sessionService.getPrepContext(input.sessionId, ctx.session.user.id);

      const result = await extractPrepNotes({
        text,
        campaignContext: context as any,
      });

      return result;
    }),
  ```

  Add import at top of router file:
  ```ts
  import { extractPrepNotes } from '@/lib/ai/extract-prep-notes';
  ```

- [ ] **Step 4: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/ai/extract-prep-notes.ts src/server/routers/sessions.ts
  git commit -m "feat(prep): add extractPrepFromNotes mutation and AI extraction util"
  ```

---

## Chunk 2: UI Components

### Task 3: `PrepSectionNav` — sticky sidebar navigation

**Files:**
- Create: `src/components/session/prep/prep-section-nav.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  'use client';

  import { cn } from '@/lib/utils';
  import { Check } from 'lucide-react';

  export const PREP_SECTIONS = [
    { id: 'characters',    label: 'Characters' },
    { id: 'strong-start',  label: 'Strong Start' },
    { id: 'scenes',        label: 'Scenes' },
    { id: 'secrets',       label: 'Secrets & Clues' },
    { id: 'npcs',          label: 'Featured NPCs' },
    { id: 'monsters',      label: 'Monsters' },
    { id: 'rewards',       label: 'Rewards' },
    { id: 'threads',       label: 'Loose Threads' },
  ] as const;

  export type SectionId = (typeof PREP_SECTIONS)[number]['id'];

  interface PrepSectionNavProps {
    completedSections: Set<SectionId>;
    activeSection?: SectionId;
    onSectionClick: (id: SectionId) => void;
  }

  export function PrepSectionNav({ completedSections, activeSection, onSectionClick }: PrepSectionNavProps) {
    return (
      <nav className="py-4 px-3 space-y-0.5">
        {PREP_SECTIONS.map((section) => {
          const isComplete = completedSections.has(section.id);
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-amber-500/10 text-amber-300'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <span className={cn(
                'flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center',
                isComplete
                  ? 'border-amber-500/60 bg-amber-500/20'
                  : 'border-border/50'
              )}>
                {isComplete && <Check className="h-2.5 w-2.5 text-amber-400" />}
              </span>
              {section.label}
            </button>
          );
        })}
      </nav>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

---

### Task 4: `PrepSectionCard` — collapsible section wrapper

**Files:**
- Create: `src/components/session/prep/prep-section-card.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  'use client';

  import { useState } from 'react';
  import { cn } from '@/lib/utils';
  import { ChevronDown, Sparkles } from 'lucide-react';
  import { Badge } from '@/components/ui/badge';

  interface PrepSectionCardProps {
    id: string;
    title: string;
    description: string;
    suggestedCount?: number;
    defaultOpen?: boolean;
    onExpand?: () => void;
    children: React.ReactNode;
  }

  export function PrepSectionCard({
    id,
    title,
    description,
    suggestedCount,
    defaultOpen = false,
    onExpand,
    children,
  }: PrepSectionCardProps) {
    const [open, setOpen] = useState(defaultOpen);

    const toggle = () => {
      const next = !open;
      setOpen(next);
      if (next && onExpand) onExpand();
    };

    return (
      <div
        id={`section-${id}`}
        className="rounded-sm border border-border/40 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
          boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
        }}
      >
        <button
          onClick={toggle}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>{title}</p>
            {!open && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'hsl(35 10% 45%)' }}>{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {suggestedCount != null && suggestedCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {suggestedCount} suggested
              </Badge>
            )}
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
              style={{ color: 'hsl(35 10% 40%)' }}
            />
          </div>
        </button>

        {open && (
          <div className="px-5 pb-5 pt-1 border-t border-border/30">
            {children}
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

---

### Task 5: `PrepImportZone` — upload and paste widget

**Files:**
- Create: `src/components/session/prep/prep-import-zone.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  'use client';

  import { useState, useRef } from 'react';
  import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Textarea } from '@/components/ui/textarea';
  import { cn } from '@/lib/utils';
  import { trpc } from '@/lib/trpc';
  import type { SessionPrepData } from '@/lib/prep-types';

  type ImportState = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

  interface PrepImportZoneProps {
    sessionId: string;
    onExtracted: (data: Partial<SessionPrepData>, sectionCounts: Record<string, number>) => void;
    lastImportedAt?: string;
  }

  export function PrepImportZone({ sessionId, onExtracted, lastImportedAt }: PrepImportZoneProps) {
    const [collapsed, setCollapsed] = useState(!!lastImportedAt);
    const [state, setState] = useState<ImportState>('idle');
    const [pastedText, setPastedText] = useState('');
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const getUploadUrl = trpc.homebrewPdf.getUploadUrl.useMutation();
    const extractMutation = trpc.sessions.extractPrepFromNotes.useMutation();

    async function uploadFile(file: File): Promise<string> {
      const upload = await getUploadUrl.mutateAsync({
        filename: file.name,
        fileSize: file.size,
        campaignId: '', // not needed for prep notes
      });
      if (upload.presignedUrl && upload.r2Key) {
        await fetch(upload.presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        return upload.r2Url ?? '';
      }
      throw new Error('Upload failed');
    }

    async function runExtraction(url?: string, text?: string) {
      setState('extracting');
      const result = await extractMutation.mutateAsync({ sessionId, url, text });

      const counts: Record<string, number> = {};
      if (result.strongStart) counts['strong-start'] = 1;
      if (result.scenes?.length) counts['scenes'] = result.scenes.length;
      if (result.secretsAndClues?.length) counts['secrets'] = result.secretsAndClues.length;
      if (result.npcs?.length) counts['npcs'] = result.npcs.length;
      if (result.monsters?.length) counts['monsters'] = result.monsters.length;
      if (result.rewards?.length) counts['rewards'] = result.rewards.length;
      if (result.looseThreads?.length) counts['threads'] = result.looseThreads.length;

      onExtracted(result, counts);
      setState('done');
    }

    async function handleFile(file: File) {
      try {
        setState('uploading');
        setError('');
        const url = await uploadFile(file);
        await runExtraction(url);
        setCollapsed(true);
      } catch (e: any) {
        setState('error');
        setError(e.message ?? 'Upload failed');
      }
    }

    async function handlePaste() {
      if (!pastedText.trim()) return;
      try {
        setError('');
        await runExtraction(undefined, pastedText);
        setCollapsed(true);
      } catch (e: any) {
        setState('error');
        setError(e.message ?? 'Extraction failed');
      }
    }

    if (collapsed) {
      return (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-sm"
          style={{ border: '1px solid hsl(35 35% 18%)', background: 'hsl(240 10% 10%)' }}>
          <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
            {lastImportedAt ? `Notes imported · ${new Date(lastImportedAt).toLocaleTimeString()}` : 'Notes imported'}
          </span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCollapsed(false)}>
            Re-import
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-sm border border-dashed border-amber-500/25 overflow-hidden"
        style={{ background: 'hsl(240 10% 9%)' }}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4" style={{ color: 'hsl(35 80% 55%)' }} />
            <p className="text-sm font-semibold" style={{ color: 'hsl(35 20% 88%)' }}>Import Prep Notes</p>
            <span className="text-xs" style={{ color: 'hsl(35 10% 45%)' }}>— DM Brain will extract and fill sections</span>
          </div>

          {state === 'uploading' || state === 'extracting' ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
              <span className="text-sm" style={{ color: 'hsl(35 10% 55%)' }}>
                {state === 'uploading' ? 'Uploading…' : 'Extracting prep content…'}
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Drop zone */}
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-sm py-6 cursor-pointer transition-colors',
                  dragging ? 'bg-amber-500/10 border-amber-500/40' : 'border border-dashed border-border/40 hover:border-border/60'
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-6 w-6" style={{ color: 'hsl(35 40% 45%)' }} />
                <p className="text-xs" style={{ color: 'hsl(35 10% 45%)' }}>
                  Drop a PDF, image, or{' '}
                  <span style={{ color: 'hsl(35 80% 55%)' }}>browse</span>
                </p>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-[10px] uppercase tracking-widest" style={{ color: 'hsl(35 10% 35%)' }}>or paste text</span>
                <div className="flex-1 h-px bg-border/30" />
              </div>

              <Textarea
                placeholder="Paste your notes here — Obsidian, Google Docs, hand-typed session ideas…"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={4}
                className="resize-none text-sm"
              />

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2">
                {lastImportedAt && (
                  <Button variant="ghost" size="sm" onClick={() => setCollapsed(true)}>Cancel</Button>
                )}
                <Button size="sm" disabled={!pastedText.trim()} onClick={handlePaste}>
                  Extract with Brain
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

---

### Task 6: `PrepWorkspace` — root component

**Files:**
- Create: `src/components/session/prep/prep-workspace.tsx`

This replaces `PrepWizard` with the same props interface so the page component swap is trivial.

- [ ] **Step 1: Create the component**

  ```tsx
  'use client';

  import { useCallback, useMemo, useState } from 'react';
  import { useRouter } from 'next/navigation';
  import { useToast } from '@/hooks/use-toast';
  import { useAutoSave } from '@/hooks/use-auto-save';
  import { trpc } from '@/lib/trpc';
  import { emptyPrepData, type SessionPrepData } from '@/lib/prep-types';
  import { PrepHeader } from './prep-header';
  import { PrepSectionNav, PREP_SECTIONS, type SectionId } from './prep-section-nav';
  import { PrepSectionCard } from './prep-section-card';
  import { PrepImportZone } from './prep-import-zone';
  import { StepCharacters } from './steps/step-characters';
  import { StepStrongStart } from './steps/step-strong-start';
  import { StepScenes } from './steps/step-scenes';
  import { StepSecrets } from './steps/step-secrets';
  import { StepNpcs } from './steps/step-npcs';
  import { StepMonsters } from './steps/step-monsters';
  import { StepRewards } from './steps/step-rewards';
  import { StepLooseThreads } from './steps/step-loose-threads';

  const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
    'characters':   'Who are your players, and what do they want?',
    'strong-start': 'How does tonight begin?',
    'scenes':       'What scenes might unfold?',
    'secrets':      'What secrets can be discovered?',
    'npcs':         'Who will the party encounter?',
    'monsters':     'What dangers lurk ahead?',
    'rewards':      'What spoils await the brave?',
    'threads':      'What threads remain unresolved?',
  };

  type CampaignContext = {
    characters: any[];
    npcs: any[];
    recentSessions: any[];
    homebrew: any[];
  };

  interface PrepWorkspaceProps {
    sessionId: string;
    initialData: SessionPrepData;
    campaignContext: CampaignContext;
    slug: string;
    initialTitle: string;
    prepStatus?: string;
  }

  export function PrepWorkspace({
    sessionId,
    initialData,
    campaignContext,
    slug,
    initialTitle,
    prepStatus = 'draft',
  }: PrepWorkspaceProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [prepData, setPrepData] = useState<SessionPrepData>(initialData ?? emptyPrepData());
    const [title, setTitle] = useState(initialTitle);
    const [activeSection, setActiveSection] = useState<SectionId | undefined>(undefined);
    const [suggestedCounts, setSuggestedCounts] = useState<Record<string, number>>({});

    const updatePrep = trpc.sessions.updatePrep.useMutation();
    const updateSession = trpc.sessions.update.useMutation();
    const completePrep = trpc.sessions.completePrep.useMutation({
      onSuccess: () => {
        toast({ title: 'Prep marked complete' });
        router.push(`/campaigns/${slug}/sessions/${sessionId}`);
      },
      onError: (error) =>
        toast({ title: 'Failed to complete prep', description: error.message, variant: 'destructive' }),
    });

    const savePayload = useMemo(() => ({ prepData, title }), [prepData, title]);

    const onSave = useCallback(
      async (payload: typeof savePayload) => {
        await updatePrep.mutateAsync({ id: sessionId, prepData: payload.prepData });
        await updateSession.mutateAsync({ id: sessionId, title: payload.title });
      },
      [sessionId, updatePrep, updateSession]
    );

    const { status: saveStatus } = useAutoSave(savePayload, onSave, 2000);

    // Compute completed sections from prepData content
    const completedSections = useMemo((): Set<SectionId> => {
      const s = new Set<SectionId>();
      if (prepData.characterNotes.some(n => n.goals || n.notes)) s.add('characters');
      if (prepData.strongStart) s.add('strong-start');
      if (prepData.scenes.length > 0) s.add('scenes');
      if (prepData.secretsAndClues.length > 0) s.add('secrets');
      if (prepData.npcs.length > 0) s.add('npcs');
      if (prepData.monsters.length > 0) s.add('monsters');
      if (prepData.rewards.length > 0) s.add('rewards');
      if (prepData.looseThreads.length > 0) s.add('threads');
      return s;
    }, [prepData]);

    function handleExtracted(extracted: Partial<SessionPrepData>, counts: Record<string, number>) {
      setSuggestedCounts(counts);
      const importedAt = new Date().toISOString();
      setPrepData((prev) => ({
        ...prev,
        strongStart: extracted.strongStart ?? prev.strongStart,
        scenes: extracted.scenes?.length ? [...prev.scenes, ...extracted.scenes] : prev.scenes,
        secretsAndClues: extracted.secretsAndClues?.length
          ? [...prev.secretsAndClues, ...extracted.secretsAndClues]
          : prev.secretsAndClues,
        npcs: extracted.npcs?.length ? [...prev.npcs, ...extracted.npcs] : prev.npcs,
        monsters: extracted.monsters?.length ? [...prev.monsters, ...extracted.monsters] : prev.monsters,
        rewards: extracted.rewards?.length ? [...prev.rewards, ...extracted.rewards] : prev.rewards,
        looseThreads: extracted.looseThreads?.length
          ? [...prev.looseThreads, ...extracted.looseThreads]
          : prev.looseThreads,
        importedNotes: [
          ...(prev.importedNotes ?? []),
          { extractedAt: importedAt, sectionCounts: counts },
        ],
      }));
    }

    const scrollToSection = (id: SectionId) => {
      setActiveSection(id);
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const lastImport = prepData.importedNotes?.[prepData.importedNotes.length - 1];

    return (
      <div className="flex flex-col h-screen">
        <PrepHeader
          title={title}
          onTitleChange={setTitle}
          saveStatus={saveStatus}
          slug={slug}
          onComplete={() => completePrep.mutate({ id: sessionId })}
          isCompleting={completePrep.isPending}
          prepStatus={prepStatus}
          isFullscreen={false}
          onToggleFullscreen={() => {}}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — desktop only */}
          <aside className="hidden md:flex md:flex-col w-56 shrink-0 border-r border-border/50 bg-card/30 overflow-y-auto">
            <PrepSectionNav
              completedSections={completedSections}
              activeSection={activeSection}
              onSectionClick={scrollToSection}
            />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
              {/* Import zone */}
              <PrepImportZone
                sessionId={sessionId}
                onExtracted={handleExtracted}
                lastImportedAt={lastImport?.extractedAt}
              />

              {/* Section cards */}
              <PrepSectionCard
                id="characters" title="Review Characters" description={SECTION_DESCRIPTIONS['characters']}
                defaultOpen={completedSections.has('characters')}
                onExpand={() => setActiveSection('characters')}
              >
                <StepCharacters
                  characterNotes={prepData.characterNotes}
                  onChange={(notes) => setPrepData((p) => ({ ...p, characterNotes: notes }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="strong-start" title="Strong Start" description={SECTION_DESCRIPTIONS['strong-start']}
                suggestedCount={suggestedCounts['strong-start']}
                defaultOpen={!!prepData.strongStart}
                onExpand={() => setActiveSection('strong-start')}
              >
                <StepStrongStart
                  sessionId={sessionId}
                  value={prepData.strongStart}
                  onChange={(v) => setPrepData((p) => ({ ...p, strongStart: v }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="scenes" title="Potential Scenes" description={SECTION_DESCRIPTIONS['scenes']}
                suggestedCount={suggestedCounts['scenes']}
                defaultOpen={prepData.scenes.length > 0}
                onExpand={() => setActiveSection('scenes')}
              >
                <StepScenes
                  sessionId={sessionId}
                  scenes={prepData.scenes}
                  strongStart={prepData.strongStart}
                  onChange={(scenes) => setPrepData((p) => ({ ...p, scenes }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="secrets" title="Secrets & Clues" description={SECTION_DESCRIPTIONS['secrets']}
                suggestedCount={suggestedCounts['secrets']}
                defaultOpen={prepData.secretsAndClues.length > 0}
                onExpand={() => setActiveSection('secrets')}
              >
                <StepSecrets
                  sessionId={sessionId}
                  secrets={prepData.secretsAndClues}
                  onChange={(secretsAndClues) => setPrepData((p) => ({ ...p, secretsAndClues }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="npcs" title="Featured NPCs" description={SECTION_DESCRIPTIONS['npcs']}
                suggestedCount={suggestedCounts['npcs']}
                defaultOpen={prepData.npcs.length > 0}
                onExpand={() => setActiveSection('npcs')}
              >
                <StepNpcs
                  npcs={prepData.npcs}
                  campaignNpcs={campaignContext.npcs}
                  onChange={(npcs) => setPrepData((p) => ({ ...p, npcs }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="monsters" title="Monsters" description={SECTION_DESCRIPTIONS['monsters']}
                suggestedCount={suggestedCounts['monsters']}
                defaultOpen={prepData.monsters.length > 0}
                onExpand={() => setActiveSection('monsters')}
              >
                <StepMonsters
                  monsters={prepData.monsters}
                  onChange={(monsters) => setPrepData((p) => ({ ...p, monsters }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="rewards" title="Rewards" description={SECTION_DESCRIPTIONS['rewards']}
                suggestedCount={suggestedCounts['rewards']}
                defaultOpen={prepData.rewards.length > 0}
                onExpand={() => setActiveSection('rewards')}
              >
                <StepRewards
                  rewards={prepData.rewards}
                  onChange={(rewards) => setPrepData((p) => ({ ...p, rewards }))}
                />
              </PrepSectionCard>

              <PrepSectionCard
                id="threads" title="Loose Threads" description={SECTION_DESCRIPTIONS['threads']}
                suggestedCount={suggestedCounts['threads']}
                defaultOpen={prepData.looseThreads.length > 0}
                onExpand={() => setActiveSection('threads')}
              >
                <StepLooseThreads
                  sessionId={sessionId}
                  threads={prepData.looseThreads}
                  onChange={(looseThreads) => setPrepData((p) => ({ ...p, looseThreads }))}
                />
              </PrepSectionCard>
            </div>
          </main>
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden border-t border-border/50 px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur"
          style={{ background: 'hsl(240 10% 5% / 0.97)' }}>
          <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
            {completedSections.size} / {PREP_SECTIONS.length} sections
          </span>
          <button
            onClick={() => completePrep.mutate({ id: sessionId })}
            disabled={completePrep.isPending}
            className="text-xs font-semibold px-3 py-1.5 rounded-sm"
            style={{ background: 'hsl(35 70% 18%)', border: '1px solid hsl(35 60% 32%)', color: 'hsl(35 80% 65%)' }}
          >
            {completePrep.isPending ? 'Saving…' : 'Mark Complete'}
          </button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit all UI components**

  ```bash
  git add src/components/session/prep/prep-section-nav.tsx \
          src/components/session/prep/prep-section-card.tsx \
          src/components/session/prep/prep-import-zone.tsx \
          src/components/session/prep/prep-workspace.tsx
  git commit -m "feat(prep): add PrepWorkspace, PrepImportZone, PrepSectionCard, PrepSectionNav components"
  ```

---

## Chunk 3: Integration + Play Routes

### Task 7: Wire PrepWorkspace into the prep page

**Files:**
- Modify: `src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx`

- [ ] **Step 1: Swap the import**

  In `src/app/(app)/campaigns/[slug]/sessions/prep/page.tsx`:

  Change:
  ```ts
  import { PrepWizard } from '@/components/session/prep/prep-wizard';
  ```
  To:
  ```ts
  import { PrepWorkspace } from '@/components/session/prep/prep-workspace';
  ```

  Change the component usage (line ~85):
  ```tsx
  return (
    <PrepWorkspace
      sessionId={sessionId}
      initialData={initialData}
      campaignContext={contextQuery.data as any}
      slug={slug}
      initialTitle={(sessionQuery.data as any).title ?? 'Session'}
      prepStatus={(sessionQuery.data as any).prepStatus ?? 'draft'}
    />
  );
  ```

- [ ] **Step 2: Type-check**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Smoke test — navigate to `/campaigns/<slug>/sessions/prep`**

  Verify:
  - Page loads without error
  - Import zone visible at top
  - 8 section cards render collapsed
  - Sidebar shows section nav on desktop
  - Clicking a section expands it

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/"(app)"/campaigns/"[slug]"/sessions/prep/page.tsx
  git commit -m "feat(prep): switch prep page from PrepWizard to PrepWorkspace"
  ```

---

### Task 8: Commit play route changes

**Files:**
- `src/app/(app)/play/[slug]/layout.tsx`
- `src/app/(app)/play/[slug]/page.tsx`
- `src/app/(app)/play/[slug]/sessions/page.tsx`
- `src/app/(app)/play/[slug]/npcs/page.tsx`
- `src/app/(app)/play/[slug]/lore/page.tsx`

- [ ] **Step 1: Review the changes are complete**

  ```bash
  git diff src/app/"(app)"/play/
  ```

  Verify no obvious issues (missing imports, broken JSX).

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/"(app)"/play/
  git commit -m "feat(play): player portal hub, sessions, npcs, lore, and mobile nav"
  ```

- [ ] **Step 3: Push to production**

  ```bash
  git push origin main
  ```
