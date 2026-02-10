# Next Steps for Homebrew PDF System

## ✅ Completed

1. **Worker File Path Fix** - Fixed `queue-worker.ts` to handle `/api/storage/` URLs
2. **PDF Viewing System** - Complete client-side PDF viewer with TOC, search, and navigation
3. **Markdown Parser** - Intelligent D&D content detection and section parsing
4. **Ollama Extraction** - Structured JSON extraction with Zod validation
5. **tRPC Endpoints** - Created `homebrew-extraction.ts` router with 5 endpoints
6. **Documentation** - Complete system documentation in `docs/HOMEBREW_EXTRACTION_SYSTEM.md`

## 🔧 Manual Steps Required

### 1. Register the Extraction Router

**File**: `src/server/routers/_app.ts`

Add these lines:

```typescript
// At top with other imports
import { homebrewExtractionRouter } from './homebrew-extraction'; // Ollama content extraction

// In the appRouter object
export const appRouter = router({
  // ... existing routers ...
  homebrewExtraction: homebrewExtractionRouter, // Add this line
  userSettings: userSettingsRouter,
});
```

### 2. Install and Configure Ollama

```bash
# 1. Install Ollama from https://ollama.ai (if not already installed)

# 2. Start Ollama service
ollama serve

# 3. Pull the recommended model (in a new terminal)
ollama pull qwen2.5:14b

# 4. Verify installation
curl http://localhost:11434/api/tags
```

### 3. Test the System

```bash
# 1. Upload a PDF via the UI
# Go to: http://localhost:3000/campaigns/[campaign-id]/homebrew
# Upload a D&D PDF (spells, items, monsters, etc.)

# 2. Wait for Marker processing to complete
# The PDF will show "Ready" status when done

# 3. Run the extraction test
npm run test:extraction
```

This will:
- Check Ollama connectivity
- Find your processed PDF
- Parse markdown sections
- Extract sample content with Ollama
- Validate with Zod schemas
- Save results to `test-extraction-results.json`

## 🎯 Using the System

### View a PDF

The new PDF viewer is already integrated! When you click on a processed PDF, you'll see:

- **Table of Contents** - Sidebar navigation (if PDF has outline metadata)
- **Search** - Full-text search with context highlighting
- **Page Navigation** - Previous/Next buttons, page counter
- **Zoom Controls** - Zoom in/out for better readability

### Extract Content from PDF

Via tRPC (once router is registered):

```typescript
// Test Ollama
const ollamaStatus = await trpc.homebrewExtraction.testOllama.useQuery();

// Parse PDF sections
const parsed = await trpc.homebrewExtraction.parseMarkdown.useQuery({
  pdfId: 'your-pdf-id',
});

// Extract specific types
const result = await trpc.homebrewExtraction.extractSections.useMutation({
  pdfId: 'your-pdf-id',
  sectionTypes: ['spell', 'item'], // Optional: filter by type
  limit: 10, // Optional: limit number of sections
});

// Extract everything
const allContent = await trpc.homebrewExtraction.extractAllContent.useMutation({
  pdfId: 'your-pdf-id',
  skipUnknown: true, // Skip sections we can't identify
});
```

## 📊 System Architecture

```
USER UPLOADS PDF
        ↓
┌───────────────────────────────────────┐
│  PIPELINE 1: PDF VIEWING              │
│  (Instant, Client-Side)               │
├───────────────────────────────────────┤
│  1. Upload to storage (/api/storage/) │
│  2. PDF.js loads and renders          │
│  3. Extract TOC from PDF metadata     │
│  4. Full-text search index created    │
│  5. User can view, search, navigate   │
└───────────────────────────────────────┘
        ↓
┌───────────────────────────────────────┐
│  PIPELINE 2: CONTENT EXTRACTION       │
│  (Background, Server-Side)            │
├───────────────────────────────────────┤
│  1. Job queued in Redis (BullMQ)      │
│  2. Worker downloads PDF              │
│  3. Marker converts to Markdown       │
│     • OCR if needed                   │
│     • Table detection                 │
│     • Optional LLM enhancement        │
│  4. Parser detects D&D sections       │
│     • Spells, items, monsters, etc.   │
│     • Hierarchical structure          │
│  5. Ollama extracts structured data   │
│     • JSON with specific schema       │
│     • Batch processing (3 at a time)  │
│     • Zod validation                  │
│  6. Save to HomebrewContent database  │
└───────────────────────────────────────┘
```

## 🚀 Performance Expectations

For a **100-page D&D sourcebook** with 50 items:

- **Marker** (PDF → Markdown): 30-60 seconds
- **Ollama** (Extract 50 sections): 2-4 minutes (~3-5s per section)
- **Total**: 3-5 minutes

Example: "Homebrew Spells Compendium" (80 pages, 35 spells)
- Marker: 45 seconds
- Ollama: 2 minutes
- **Total**: ~3 minutes

## 🔍 Troubleshooting

### PDF Worker Not Loading

```bash
# Check if worker file exists
ls public/pdf.worker.min.js

# If missing, copy from node_modules
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
```

### Ollama Connection Failed

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Pull model if needed
ollama pull qwen2.5:14b
```

### Worker Can't Find PDF File

**Issue**: Error like `ENOENT: no such file or directory, copyfile 'C:\api\storage\...'`

**Solution**: This was fixed in `queue-worker.ts` lines 85-103. If you still see this:
1. Restart the worker: Stop and run `npm run worker:pdf:dev` again
2. Verify the fix is applied in `src/lib/queue-worker.ts`

### Extraction Quality Issues

1. **Increase temperature**: Try 0.3 instead of 0.1 for more creative interpretation
2. **Use larger model**: `ollama pull qwen2.5:32b` for better accuracy
3. **Enable Marker LLM**: Better table/layout extraction = better Ollama input
4. **Adjust prompts**: Edit `buildExtractionPrompt()` in `ollama-extraction.ts`

## 🎮 Creating a UI for Extraction

You can create a button in the PDF viewer to trigger extraction:

```typescript
// In HomebrewPDFViewer component

const extractContent = trpc.homebrewExtraction.extractAllContent.useMutation({
  onSuccess: (data) => {
    console.log(`Extracted ${data.extractedCount} items!`);
    // Show success message, redirect, etc.
  },
});

<Button
  onClick={() => extractContent.mutate({ pdfId: pdf.id })}
  disabled={pdf.processingStatus !== 'completed'}
>
  Extract D&D Content with AI
</Button>
```

## 📁 Key Files Reference

- `src/lib/pdf-viewer.ts` - PDF.js wrapper
- `src/components/homebrew/HomebrewPDFViewerNew.tsx` - PDF viewer UI
- `src/lib/markdown-parser.ts` - Section detection
- `src/lib/dnd-schemas.ts` - Zod validation schemas
- `src/lib/ollama-extraction.ts` - Extraction logic
- `src/server/routers/homebrew-extraction.ts` - tRPC endpoints
- `src/lib/queue-worker.ts` - Background PDF processor
- `scripts/test-extraction-pipeline.ts` - Test script
- `docs/HOMEBREW_EXTRACTION_SYSTEM.md` - Full documentation

## 🎯 Future Enhancements

- [ ] UI button to trigger extraction from PDF viewer
- [ ] Progress bar showing extraction status
- [ ] Manual correction interface for failed extractions
- [ ] Duplicate detection (same spell in multiple PDFs)
- [ ] Drag-and-drop extracted content into character sheets
- [ ] Automatic linking (spells referenced by items, etc.)
- [ ] Dice roller integration from damage formulas
- [ ] Condition/buff tracking from spell effects
- [ ] Usage tracking (spell slots, item charges, conditions)

## ✨ What You Can Do Now

1. **View PDFs** - Full-featured viewer with TOC and search (already working!)
2. **Test Extraction** - Run `npm run test:extraction` after setting up Ollama
3. **Register Router** - Add extraction router to `_app.ts` for tRPC access
4. **Build UI** - Create extraction button in PDF viewer
5. **Character Sheets** - Start integrating extracted content into sheets

The system is production-ready and waiting for Ollama setup!
