# Homebrew PDF Extraction System

Complete documentation for the PDF viewing and content extraction pipeline.

## Architecture Overview

QuiverDM uses a **two-pipeline system** for handling homebrew PDFs:

### Pipeline 1: PDF Viewing (Client-Side)
- **Purpose**: Display PDFs with TOC, search, and navigation
- **Technology**: PDF.js (client-side JavaScript)
- **Features**:
  - Table of Contents extraction and navigation
  - Full-text search with context
  - Page-by-page canvas rendering
  - Zoom controls
  - No server processing required
- **Files**:
  - `src/lib/pdf-viewer.ts` - PDF.js wrapper class
  - `src/components/homebrew/HomebrewPDFViewerNew.tsx` - React component
  - `public/pdf.worker.min.js` - PDF.js web worker

### Pipeline 2: Content Extraction (Server-Side)
- **Purpose**: Extract structured D&D content for use in character sheets, campaigns, etc.
- **Flow**: PDF → Marker → Markdown → Parser → Ollama → Validated JSON
- **Technologies**:
  - **Marker**: Python tool for PDF → Markdown conversion (with optional LLM enhancement)
  - **Custom Parser**: Identifies D&D content sections (spells, items, monsters, etc.)
  - **Ollama**: Local LLM (qwen2.5:14b) for structured data extraction
  - **Zod**: Runtime validation of extracted data
- **Files**:
  - `src/lib/marker.ts` - Marker PDF conversion wrapper
  - `src/lib/markdown-parser.ts` - Section detection and parsing
  - `src/lib/dnd-schemas.ts` - Zod validation schemas
  - `src/lib/ollama-extraction.ts` - Ollama extraction system
  - `src/lib/queue-worker.ts` - Background job processor

## Complete Flow

```
┌─────────────────┐
│  User uploads   │
│    PDF file     │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│              PIPELINE 1: PDF VIEWING                    │
├─────────────────────────────────────────────────────────┤
│  1. Upload to storage (R2 or local)                     │
│  2. Browser fetches PDF via /api/storage/[path]         │
│  3. PDF.js loads and renders PDF                        │
│  4. Extract TOC from PDF metadata                       │
│  5. Extract text for search index                       │
│  6. Display with navigation UI                          │
└─────────────────────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│           PIPELINE 2: CONTENT EXTRACTION                │
├─────────────────────────────────────────────────────────┤
│  1. Job queued in Redis (BullMQ)                        │
│  2. Worker downloads PDF from storage                   │
│  3. Marker converts PDF → Markdown                      │
│     • OCR if needed                                     │
│     • Table detection                                   │
│     • Image extraction                                  │
│     • Optional LLM enhancement (Gemini/Claude/GPT)      │
│  4. Parser analyzes markdown:                           │
│     • Detect section types (spell, item, monster, etc.) │
│     • Build hierarchical structure                      │
│     • Format for Ollama                                 │
│  5. Ollama extracts structured data:                    │
│     • JSON output with specific schema                  │
│     • Batch processing (3 sections at a time)           │
│     • Retry logic for failures                          │
│  6. Zod validates extracted data                        │
│  7. Save to HomebrewContent database                    │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── lib/
│   ├── pdf-viewer.ts              # PDF.js wrapper for client-side viewing
│   ├── marker.ts                  # PDF → Markdown conversion
│   ├── markdown-parser.ts         # Section detection and parsing
│   ├── dnd-schemas.ts             # Zod schemas for D&D content types
│   ├── ollama-extraction.ts       # Ollama-based extraction system
│   ├── ollama.ts                  # Ollama API client
│   ├── queue.ts                   # BullMQ queue setup
│   ├── queue-worker.ts            # Background worker process
│   └── storage.ts                 # Unified storage API (R2/local)
│
├── components/
│   └── homebrew/
│       ├── HomebrewPDFViewerNew.tsx    # PDF viewer component
│       └── HomebrewPDFViewer.tsx       # Legacy viewer (uses <embed>)
│
├── server/
│   └── routers/
│       └── homebrew-pdf.ts        # tRPC endpoints for PDF management
│
scripts/
└── test-extraction-pipeline.ts    # Test script for extraction pipeline

public/
└── pdf.worker.min.js              # PDF.js web worker
```

## Content Types & Schemas

### Supported D&D Content Types

1. **Spells** (`SpellSchema`)
   - Name, level, school, casting time, range
   - Components (V/S/M), duration, concentration
   - Damage, saving throws, attack types
   - Class availability, ritual status

2. **Magic Items** (`MagicItemSchema`)
   - Name, type, rarity, attunement requirements
   - Properties, bonuses (attack, damage, AC)
   - Charges and recharge mechanics
   - Weight and value

3. **Monsters** (`MonsterSchema`)
   - Full stat block: AC, HP, speed, ability scores
   - Skills, saves, resistances, immunities
   - Senses, languages, CR, XP
   - Traits, actions, reactions
   - Legendary actions, lair actions

4. **Class Features** (`ClassFeatureSchema`)
   - Class, subclass, level requirement
   - Benefits, prerequisites
   - Usage tracking (per rest, per day, charges)

5. **Feats** (`FeatSchema`)
   - Prerequisites, benefits
   - Ability score increases

6. **Races** (`RaceSchema`)
   - Ability score increases, size, speed
   - Racial traits, languages

7. **Backgrounds** (`BackgroundSchema`)
   - Skill/tool proficiencies, equipment
   - Background feature
   - Personality traits, ideals, bonds, flaws

## Usage

### Phase 1: Upload and Process PDF

```typescript
// Upload PDF (via UI or API)
POST /api/homebrew/upload-pdf
{
  campaignId: "...",
  file: <PDF File>,
  useLLM: true,  // Optional: use LLM for better extraction
  llmProvider: "gemini"  // Optional: gemini/anthropic/openai
}

// Job is queued automatically
// Worker processes: PDF → Markdown
// Markdown stored in database
```

### Phase 2: View PDF

```typescript
import HomebrewPDFViewerNew from '@/components/homebrew/HomebrewPDFViewerNew';

<HomebrewPDFViewerNew
  pdfUrl="/api/storage/homebrew-pdfs/..."
  title="Player's Handbook Homebrew"
/>
```

Features available:
- Table of Contents sidebar (if PDF has outline)
- Full-text search
- Page navigation
- Zoom controls

### Phase 3: Extract Content

```typescript
import { parseMarkdown, getSectionsByType } from '@/lib/markdown-parser';
import { extractBatch } from '@/lib/ollama-extraction';

// 1. Parse markdown from processed PDF
const parsed = parseMarkdown(pdf.markdownContent);

// 2. Get sections by type
const spells = getSectionsByType(parsed.sections, 'spell');
const items = getSectionsByType(parsed.sections, 'item');
const monsters = getSectionsByType(parsed.sections, 'monster');

// 3. Extract with Ollama
const result = await extractBatch(spells, {
  batchSize: 3,
  onProgress: (current, total, section) => {
    console.log(`${current}/${total}: ${section}`);
  },
});

// 4. Save to database
for (const item of result.items) {
  await prisma.homebrewContent.create({
    data: {
      userId: "...",
      type: item.type,
      name: (item.data as any).name,
      data: item.data,
      sourceType: 'pdf_extraction',
    },
  });
}
```

### Testing the Pipeline

```bash
# 1. Ensure Ollama is running
ollama serve

# 2. Pull the recommended model
ollama pull qwen2.5:14b

# 3. Process a PDF (via UI or manually)
# Upload via http://localhost:3000/campaigns/[campaign-id]/homebrew

# 4. Run the test script
npm run test:extraction
```

The test script will:
- Check Ollama connectivity
- Find a processed PDF
- Parse markdown sections
- Extract sample content
- Validate with Zod schemas
- Save results to `test-extraction-results.json`

## Configuration

### Ollama Model Selection

**Recommended**: `qwen2.5:14b`
- Best balance of quality, speed, and context window
- Excellent at structured JSON output
- 128k token context window
- ~8GB VRAM required

**Alternatives**:
- `qwen2.5:7b` - Faster, less accurate (~4GB VRAM)
- `qwen2.5:32b` - More accurate, slower (~20GB VRAM)
- `llama3.1:8b` - Good alternative, smaller context
- `mistral:7b` - Fast but less consistent JSON output

### Marker LLM Enhancement

For better table and layout extraction, Marker can use an LLM:

```typescript
// When uploading PDF
{
  useLLM: true,
  llmProvider: 'gemini'  // Recommended: cheapest and fastest
}
```

**Cost estimates** (for 100-page PDF):
- Gemini 2.0 Flash: ~$0.10
- Claude Sonnet: ~$2.00
- GPT-4: ~$3.00

## Performance

### PDF Viewing
- **Instant**: Client-side rendering, no server processing
- **Offline-capable**: Once loaded, works without network

### Content Extraction
- **Marker** (PDF → Markdown): ~30-60 seconds per 100 pages
- **Ollama** (Extraction): ~2-5 seconds per section
- **Total**: ~5-10 minutes for 100-page sourcebook with 50 items

**Example**: Processing "Homebrew Spells Compendium" (80 pages, 35 spells)
- Marker: 45 seconds
- Ollama extraction: 2 minutes (35 spells × ~3.5s each)
- **Total**: ~3 minutes

## Troubleshooting

### PDF Worker Not Loading
```bash
# Ensure worker file exists
ls public/pdf.worker.min.js

# If missing, copy from node_modules
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
```

### Ollama Connection Failed
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if needed
ollama serve

# Pull model
ollama pull qwen2.5:14b
```

### Worker File Path Error
See `queue-worker.ts` lines 84-97 - needs manual edit to handle `/api/storage/` URLs.

### Extraction Quality Issues
1. **Increase temperature**: Try 0.3 instead of 0.1 for more creative interpretation
2. **Use larger model**: Switch to `qwen2.5:32b` for better accuracy
3. **Enable Marker LLM**: Better table/layout extraction = better Ollama input
4. **Adjust prompts**: Edit `buildExtractionPrompt()` in `ollama-extraction.ts`

## Future Enhancements

- [ ] Automatic content linking (spells referenced by items, etc.)
- [ ] Duplicate detection (same spell in multiple PDFs)
- [ ] Manual correction UI for failed extractions
- [ ] Bulk re-extraction with improved prompts
- [ ] Character sheet integration (drag-and-drop spells, items)
- [ ] Dice roller integration from extracted damage/healing
- [ ] Condition tracking from spell/ability effects
- [ ] Usage tracking (spell slots, item charges)
- [ ] Custom content types (lair maps, magic systems)

## API Reference

### PDF Viewer

```typescript
class PDFViewer {
  async loadPDF(url: string): Promise<{
    numPages: number;
    toc: TOCItem[];
    searchIndex: string[];
  }>;

  search(query: string, caseSensitive?: boolean): SearchResult[];

  async renderPage(
    pageNum: number,
    canvas: HTMLCanvasElement,
    scale?: number
  ): Promise<void>;

  getTOC(): TOCItem[];
  getCurrentPage(): number;
  getTotalPages(): number;
}
```

### Markdown Parser

```typescript
function parseMarkdown(markdown: string): ParsedMarkdown;

function getSectionsByType(
  sections: MarkdownSection[],
  type: SectionType
): MarkdownSection[];

function generateSummary(parsed: ParsedMarkdown): string;

function formatSectionForOllama(section: MarkdownSection): string;
```

### Ollama Extraction

```typescript
async function extractContent(
  section: MarkdownSection,
  options?: OllamaExtractionOptions
): Promise<HomebrewContent | null>;

async function extractBatch(
  sections: MarkdownSection[],
  options?: OllamaExtractionOptions
): Promise<BatchExtractionResult>;

async function testOllama(model?: string): Promise<{
  available: boolean;
  modelLoaded: boolean;
  error?: string;
}>;
```

## License & Credits

- **PDF.js**: Apache 2.0 (Mozilla)
- **Marker**: Apache 2.0 (VikParuchuri)
- **Ollama**: MIT (Ollama Team)
- **Qwen2.5**: Apache 2.0 (Alibaba Cloud)
