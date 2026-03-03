# Obsidian Adventures + Media Import + Gemini Default Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Adventures folder import, add a Gemini shared client with fallback for rules AI, and let players import homebrew from any format (images, handwritten notes, sketches, docs).

**Architecture:** Three independent changes: (1) single-file categorizer fix in the Obsidian import worker, (2) shared Gemini client extracted from obsidian-extraction.ts and used as fallback in rules.service.ts, (3) new API route + dialog for uploading arbitrary media files and extracting D&D homebrew with Gemini Vision.

**Tech Stack:** Next.js 15 App Router API routes, tRPC v11, Prisma, Gemini Vision (`gemini-2.0-flash`), BullMQ (no new workers), TypeScript

---

### Task 1: Fix Adventures folder — import as homebrew type 'adventure'

**Files:**
- Modify: `src/lib/queue/obsidian-import-worker.ts`

**What to do:**

In `obsidian-import-worker.ts`, make the following changes:

**Step 1: Change the `FileCategory` union type** (line ~116) — add `'homebrew-adventure'`:

```typescript
type FileCategory =
  | 'npc'
  | 'character'
  | 'session-planning'   // keep for any future use
  | 'session-completed'
  | 'homebrew-item'
  | 'homebrew-location'
  | 'homebrew-faction'
  | 'homebrew-race'
  | 'homebrew-rule'
  | 'homebrew-adventure'  // ADD THIS
  | 'skip';
```

**Step 2: Change the categorizer** (line ~131) — change `adventures/` from `session-planning` to `homebrew-adventure`:

```typescript
function categorize(filePath: string): FileCategory {
  const rel = path.relative(extractDir, filePath).replace(/\\/g, '/').toLowerCase();
  if (rel.includes('player characters/') || rel.includes('player-characters/')) return 'character';
  if (rel.includes('sessions/')) return 'session-completed';
  if (rel.includes('adventures/')) return 'homebrew-adventure';  // WAS: session-planning
  const base = path.basename(filePath).toLowerCase();
  if (base === 'npcs.md') return 'npc';
  if (base === 'items.md') return 'homebrew-item';
  if (base === 'locations.md') return 'homebrew-location';
  if (base === 'factions.md') return 'homebrew-faction';
  if (base === 'races.md') return 'homebrew-race';
  if (base === 'systems.md') return 'homebrew-rule';
  return 'skip';
}
```

**Step 3: Update the work items loop** — adventures are whole files, not split by H2. Change the `if` condition that decides whether to splitOnH2 (line ~152):

```typescript
if (
  ['npc', 'homebrew-item', 'homebrew-location', 'homebrew-faction', 'homebrew-race', 'homebrew-rule'].includes(
    category
  )
) {
  // split into per-entity blocks
  const blocks = splitOnH2(content);
  ...
} else {
  // sessions, characters, homebrew-adventure — whole file as one item
  workItems.push({ category, label, markdown: content });
}
```

**Step 4: Add `'homebrew-adventure'` to the homebrew processing branch** (line ~240). Find this block:

```typescript
} else if (item.category.startsWith('homebrew-') && options.homebrew) {
  const typeMap: Record<string, string> = {
    'homebrew-item': 'item',
    'homebrew-location': 'location',
    'homebrew-faction': 'faction',
    'homebrew-race': 'race',
    'homebrew-rule': 'rule',
  };
```

Add `'homebrew-adventure': 'adventure'` to the typeMap:

```typescript
  const typeMap: Record<string, string> = {
    'homebrew-item': 'item',
    'homebrew-location': 'location',
    'homebrew-faction': 'faction',
    'homebrew-race': 'race',
    'homebrew-rule': 'rule',
    'homebrew-adventure': 'adventure',  // ADD THIS
  };
```

**Step 5: Commit**

```bash
git add src/lib/queue/obsidian-import-worker.ts
git commit -m "fix(obsidian-import): import Adventures folder as homebrew type 'adventure'"
```

---

### Task 2: Shared Gemini client + rules service Gemini fallback

**Files:**
- Create: `src/lib/ai/gemini.ts`
- Modify: `src/lib/ai/obsidian-extraction.ts`
- Modify: `src/server/services/rules.service.ts`

**What to do:**

**Step 1: Create `src/lib/ai/gemini.ts`**

Extract the `callGemini` function from `obsidian-extraction.ts` into a shared module. Also add a `callGeminiVision` function for image inputs (used in Task 3):

```typescript
const TEXT_MODEL = 'gemini-2.5-flash-lite';
const VISION_MODEL = 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 60_000;

export async function callGemini(prompt: string, userKey?: string): Promise<string> {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const res = await fetch(`${BASE_URL}/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export async function callGeminiVision(
  prompt: string,
  images: Array<{ mimeType: string; base64Data: string }>,
  userKey?: string
): Promise<string> {
  const apiKey = userKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');

  const parts: unknown[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64Data } });
  }

  const res = await fetch(`${BASE_URL}/${VISION_MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`Gemini Vision error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
```

**Step 2: Update `src/lib/ai/obsidian-extraction.ts`**

Remove the local `callGemini` function (lines 1–21) and replace with an import:

```typescript
import { callGemini } from './gemini';
```

The rest of the file stays the same — all other functions already call `callGemini` correctly.

**Step 3: Update `src/server/services/rules.service.ts`**

Add Gemini as fallback when Ollama returns an empty/failed response. Import `callGemini` and add a fallback:

```typescript
import { callGemini } from '@/lib/ai/gemini';
```

In the `lookup` method, after `chatWithOllama`, add a fallback:

```typescript
let answer: string;
try {
  answer = await chatWithOllama(
    [
      {
        role: 'system',
        content:
          'You are a D&D 5e rules expert. Answer using only the provided rules text. Be concise (2-4 sentences). If the answer is not in the provided text, explicitly say so.',
      },
      {
        role: 'user',
        content: `Rules text:\n${context}\n\nQuestion: ${normalizedQuestion}`,
      },
    ],
    { temperature: 0.1 }
  );
} catch {
  // Ollama unavailable — fall back to Gemini
  answer = await callGemini(
    `You are a D&D 5e rules expert. Answer using only the provided rules text. Be concise (2-4 sentences). If the answer is not in the provided text, explicitly say so.\n\nRules text:\n${context}\n\nQuestion: ${normalizedQuestion}`
  );
}
```

**Step 4: Commit**

```bash
git add src/lib/ai/gemini.ts src/lib/ai/obsidian-extraction.ts src/server/services/rules.service.ts
git commit -m "feat(ai): extract shared Gemini client, add Gemini fallback to rules service"
```

---

### Task 3: Homebrew media import API route

**Files:**
- Create: `src/app/api/uploads/homebrew-import/route.ts`

**What to do:**

This API route accepts up to 5 files (images, text, markdown, PDF) and a `campaignId` (optional). For each file:
- Image (jpg/png/webp/gif): base64-encode → `callGeminiVision` with D&D extraction prompt
- Text/Markdown: `callGemini` with extraction prompt
- PDF: fetch Docling service at `DOCLING_URL || 'http://localhost:5001'` to get markdown, then `callGemini`

For each extracted item, create a `HomebrewContent` record. If `campaignId` provided, also create `CampaignHomebrewContent`.

**Step 1: Create `src/app/api/uploads/homebrew-import/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/server/db';
import { callGemini, callGeminiVision } from '@/lib/ai/gemini';
import { Prisma } from '@prisma/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5;

const HOMEBREW_EXTRACTION_PROMPT = `You are a D&D 5e content extractor. Extract all D&D homebrew content from the provided material (which may be a photo of handwritten notes, a sketch, or typed text).

Return ONLY valid JSON with this structure:
{
  "items": [
    {
      "name": "string",
      "type": "item|spell|creature|location|faction|race|rule|adventure",
      "description": "full description preserving all important details",
      "properties": { "any relevant structured fields" }
    }
  ]
}

Rules:
- Extract ALL D&D content you can find
- If the material is handwritten or a sketch, do your best to read and interpret it
- Use type "item" for weapons/armor/wondrous items, "spell" for spells, "creature" for monsters/NPCs with stats, "location" for places, "faction" for groups/organizations, "race" for playable races, "rule" for house rules/mechanics, "adventure" for adventure hooks or scenarios
- If you cannot identify a clear type, use "item"
- If nothing D&D-related is found, return { "items": [] }`;

interface ExtractedItem {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

function parseExtracted(text: string): ExtractedItem[] {
  const match = text.match(/```json\n?([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  try {
    const parsed = JSON.parse(match ? match[1] : text);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function extractFromText(text: string, userKey?: string): Promise<ExtractedItem[]> {
  const prompt = `${HOMEBREW_EXTRACTION_PROMPT}\n\nContent:\n${text.slice(0, 8000)}`;
  const raw = await callGemini(prompt, userKey);
  return parseExtracted(raw);
}

async function extractFromImage(
  base64Data: string,
  mimeType: string,
  userKey?: string
): Promise<ExtractedItem[]> {
  const raw = await callGeminiVision(HOMEBREW_EXTRACTION_PROMPT, [{ mimeType, base64Data }], userKey);
  return parseExtracted(raw);
}

async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), 'upload.pdf');

  const res = await fetch(`${doclingUrl}/convert`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Docling error ${res.status}`);
  const json = await res.json();
  return json.markdown || json.text || '';
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get user's Gemini key if set
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { geminiApiKey: true },
    });
    let userGeminiKey: string | undefined;
    if (userSettings?.geminiApiKey) {
      try {
        const { decrypt } = await import('@/lib/encryption');
        userGeminiKey = decrypt(userSettings.geminiApiKey);
      } catch {}
    }

    const formData = await request.formData();
    const campaignId = (formData.get('campaignId') as string | null) || undefined;
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }

    const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const results: Array<{ name: string; count: number; errors: string[] }> = [];

    for (const file of files) {
      const errors: string[] = [];
      let extractedItems: ExtractedItem[] = [];

      if (file.size > MAX_FILE_SIZE) {
        results.push({ name: file.name, count: 0, errors: [`File too large (max 10MB)`] });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        if (IMAGE_TYPES.includes(file.type)) {
          extractedItems = await extractFromImage(buffer.toString('base64'), file.type, userGeminiKey);
        } else if (file.type === 'application/pdf') {
          const markdown = await pdfToMarkdown(buffer);
          extractedItems = await extractFromText(markdown, userGeminiKey);
        } else {
          // text/plain, text/markdown, or unknown — treat as text
          extractedItems = await extractFromText(buffer.toString('utf-8'), userGeminiKey);
        }
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : String(err));
        results.push({ name: file.name, count: 0, errors });
        continue;
      }

      let saved = 0;
      for (const item of extractedItems) {
        try {
          const content = await prisma.homebrewContent.create({
            data: {
              userId,
              type: item.type || 'item',
              name: item.name || 'Untitled',
              data: {
                description: item.description,
                ...(item.properties ?? {}),
              } as Prisma.InputJsonValue,
              images: [],
              tags: [item.type || 'item'],
              searchText: `${item.name} ${item.description}`,
              sourceType: 'media_import',
            },
          });

          if (campaignId) {
            await prisma.campaignHomebrewContent.create({
              data: { campaignId, homebrewId: content.id },
            });
          }
          saved++;
        } catch (err: unknown) {
          errors.push(`${item.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      results.push({ name: file.name, count: saved, errors });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('[homebrew-import upload] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/uploads/homebrew-import/route.ts
git commit -m "feat(homebrew): add media import API route — Gemini Vision extraction from images/text/PDF"
```

---

### Task 4: Player homebrew import dialog UI

**Files:**
- Create: `src/components/homebrew/import-from-media-dialog.tsx`
- Modify: `src/app/(app)/homebrew/page.tsx`

**What to do:**

**Step 1: Create `src/components/homebrew/import-from-media-dialog.tsx`**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ResultItem {
  name: string;
  count: number;
  errors: string[];
}

interface ImportFromMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string;
  onSuccess?: () => void;
}

export function ImportFromMediaDialog({
  open,
  onOpenChange,
  campaignId,
  onSuccess,
}: ImportFromMediaDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: campaigns } = trpc.campaigns.getAll.useQuery(undefined, { staleTime: 60_000 });
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaignId ?? '');

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, []);

  async function handleSubmit() {
    if (files.length === 0) return;

    setUploading(true);
    setResults(null);

    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      if (selectedCampaignId) fd.append('campaignId', selectedCampaignId);

      const res = await fetch('/api/uploads/homebrew-import', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setResults([{ name: 'Error', count: 0, errors: [json.error || 'Upload failed'] }]);
        return;
      }

      setResults(json.results as ResultItem[]);
      const totalSaved = (json.results as ResultItem[]).reduce((sum: number, r: ResultItem) => sum + r.count, 0);
      if (totalSaved > 0) onSuccess?.();
    } catch (err: unknown) {
      setResults([{ name: 'Error', count: 0, errors: [err instanceof Error ? err.message : 'Upload failed'] }]);
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setFiles([]);
    setResults(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!uploading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Any Format</DialogTitle>
          <DialogDescription>
            Upload photos of hand-drawn content, handwritten notes, sketches, or any text file. AI will extract D&D homebrew content automatically.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  {r.count > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-medium truncate">{r.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {r.count} item{r.count !== 1 ? 's' : ''} imported
                  </span>
                </div>
                {r.errors.length > 0 && (
                  <ul className="pl-6 text-xs text-destructive space-y-0.5">
                    {r.errors.map((e, j) => <li key={j}>{e}</li>)}
                  </ul>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
              <Button variant="outline" onClick={reset}>Import More</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Images (JPG, PNG, WebP), PDF, text files — up to 5 files, 10MB each
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!campaignId && campaigns && campaigns.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="campaign-select">Add to Campaign (optional)</Label>
                <select
                  id="campaign-select"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                >
                  <option value="">No campaign — library only</option>
                  {campaigns.map((c: { id: string; name: string }) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={files.length === 0 || uploading}>
                {uploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</>
                ) : (
                  `Import ${files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}`
                )}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add the dialog to `src/app/(app)/homebrew/page.tsx`**

At line ~14 (imports), add:
```tsx
import { ImportFromMediaDialog } from '@/components/homebrew/import-from-media-dialog';
import { ImageUp } from 'lucide-react';
```

In the component state (line ~28), add:
```tsx
const [mediaImportOpen, setMediaImportOpen] = useState(false);
```

Find the button row where `CreateHomebrewDialog` and `ImportFromDDBDialog` are rendered and add a third button + dialog instance. The button should use the `ImageUp` icon and label "Import from Photo/Notes". Place it between Create and DDB Import buttons.

Also add the dialog component:
```tsx
<ImportFromMediaDialog
  open={mediaImportOpen}
  onOpenChange={setMediaImportOpen}
  onSuccess={() => content.refetch()}
/>
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 4: Commit**

```bash
git add src/components/homebrew/import-from-media-dialog.tsx src/app/(app)/homebrew/page.tsx
git commit -m "feat(homebrew): add media import dialog — AI extraction from images, notes, PDFs"
```

---

### Task 5: Type-check and final verification

**Step 1: Run TypeScript check**

```bash
cd E:/Projects/QuiverDM && npx tsc --noEmit 2>&1 | head -40
```

Fix any errors found. Common issues to watch for:
- `campaigns.getAll` router may not exist — check available campaign queries with `trpc.campaigns.` and use the correct one (may be `trpc.campaigns.getAll` or `trpc.campaigns.list`)
- `sourceType` field on HomebrewContent — if schema doesn't have `'media_import'` as a valid value, use `'custom'` or the closest existing enum value. Check `prisma/schema.prisma` for the `HomebrewContent` model.

**Step 2: Check the HomebrewContent sourceType constraint**

```bash
grep -n "sourceType\|media_import\|obsidian_import" prisma/schema.prisma
```

If `sourceType` is an enum, add `media_import` to it and run `npm run db:push`. If it's a plain String field, `'media_import'` works as-is.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from media import feature"
```

---

## Notes for Implementer

- `trpc.campaigns.getAll` — verify this is the correct query name by checking `src/server/routers/campaigns.ts`. Use whatever returns a list of the user's campaigns.
- The `DOCLING_URL` env var defaults to `http://localhost:5001` — on prod, PDF extraction will silently fail and errors will be reported per file. That's fine.
- Do not add `'adventure'` to the homebrew type filter chips on the homebrew page — keep it minimal (YAGNI).
- The Gemini Vision fallback in rules.service.ts is intentionally simple — it only catches errors (Ollama down/timeout), it doesn't replace Ollama when available.
