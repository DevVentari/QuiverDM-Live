# Homebrew Library

The Homebrew Library manages D&D homebrew content - items, creatures, spells, and more - extracted from PDFs or created manually.

## Features

- **PDF Upload**: Drag-and-drop PDF files
- **AI Extraction**: Automatically extract D&D content using AI
- **Content Types**: Items, creatures, spells, locations, feats, subclasses, rules
- **Search & Filter**: Full-text search with type filtering
- **Quick Add**: Insert homebrew into session notes

## Content Types

| Type | Description |
|------|-------------|
| `item` | Magic items, equipment, weapons, armor |
| `creature` | Monsters, NPCs, beasts |
| `spell` | Custom spells |
| `location` | Places, dungeons, regions |
| `subclass` | Character subclasses |
| `feat` | Character feats |
| `rule` | House rules, mechanics |

## PDF Processing Pipeline

```
Upload PDF → Marker (PDF→Markdown) → AI Extraction → Database
```

### Two Extraction Options

**1. Basic Pattern Matching (Free)**
- Text-only (no OCR)
- Simple pattern matching
- Fast, works offline
- Lower accuracy

**2. AI Extraction with OCR**
- Full OCR support for scanned PDFs
- GPT-4o-mini for content understanding
- ~$0.01-0.05 per PDF
- 90%+ accuracy

## Usage

### Upload a PDF

1. Navigate to `/homebrew`
2. Click "Upload PDF" or drag-and-drop
3. Wait for processing (see PDF Processing doc)
4. View extracted content

### Browse Content

```typescript
// Get all homebrew for a campaign
const { data } = trpc.homebrew.getContent.useQuery({
  campaignId,
  type: 'item', // Optional filter
});
```

### Search Content

```typescript
const { data } = trpc.homebrew.searchContent.useQuery({
  campaignId,
  query: 'flaming sword',
});
```

### Create Content Manually

```typescript
await trpc.homebrew.createContent.mutate({
  campaignId,
  type: 'item',
  name: 'Sword of Flames',
  data: {
    description: 'A magical longsword...',
    rarity: 'rare',
    requiresAttunement: true,
  },
  tags: ['rare', 'weapon', 'fire'],
});
```

## AI Extraction

### Enable AI Extraction

When processing a PDF:

```typescript
await trpc.homebrew.processPDF.mutate({
  id: pdfId,
  useAI: true,
});
```

### Cost Estimation

```typescript
const estimate = await trpc.homebrew.estimatePDFCost.query({
  pages: 20,
});
// { estimatedCost: 0.012, model: 'gpt-4o-mini' }
```

### Typical Costs (GPT-4o-mini)

| PDF Size | Cost |
|----------|------|
| 10 pages | ~$0.005 |
| 30 pages | ~$0.015 |
| 100 pages | ~$0.05 |

## Ollama Local Extraction

For fully local extraction without API costs:

### Setup

```bash
# Install Ollama
# https://ollama.ai

# Pull recommended model
ollama pull qwen2.5:14b
```

### Usage

```typescript
import { extractBatch } from '@/lib/ollama-extraction';

const result = await extractBatch(sections, {
  batchSize: 3,
  onProgress: (current, total) => console.log(`${current}/${total}`),
});
```

### Model Selection

| Model | VRAM | Quality |
|-------|------|---------|
| qwen2.5:7b | ~4 GB | Good |
| qwen2.5:14b | ~8 GB | Better |
| qwen2.5:32b | ~20 GB | Best |

## Database Schema

```prisma
model HomebrewPDF {
  id                String    @id
  userId            String
  campaignId        String?
  filename          String
  fileSize          Int
  markdownContent   String?   @db.Text
  processingStatus  String    @default("pending")
  useLLM            Boolean   @default(false)
}

model HomebrewContent {
  id          String   @id
  userId      String
  campaignId  String?
  type        String   // item, creature, spell, etc.
  name        String
  data        Json     // Flexible structure
  tags        String[]
  sourcePdfId String?
}
```

## Components

### HomebrewPDFUpload

Drag-and-drop PDF upload:

```tsx
<HomebrewPDFUpload
  campaignId={campaignId}
  userId={userId}
  onUploadComplete={() => refetch()}
/>
```

### HomebrewContentList

Browse and filter content:

```tsx
<HomebrewContentList
  campaignId={campaignId}
  onContentClick={(id) => openDetail(id)}
/>
```

### HomebrewQuickAdd

Quick search and insert:

```tsx
<HomebrewQuickAdd
  campaignId={campaignId}
  onSelect={(content) => addToSession(content)}
/>
```

## Key Files

| File | Purpose |
|------|---------|
| `src/server/routers/homebrew.ts` | Main homebrew tRPC router |
| `src/server/routers/homebrew-pdf.ts` | PDF-specific endpoints |
| `src/lib/marker.ts` | PDF to Markdown conversion |
| `src/lib/ollama-extraction.ts` | Local AI extraction |
| `src/lib/ai-homebrew-extractor.ts` | OpenAI extraction |
| `src/components/homebrew/` | UI components |

## Troubleshooting

### PDF Upload Fails

- Check file size (max 50MB)
- Verify storage is configured
- Check server logs

### No Content Extracted

- PDF may not match extraction patterns
- Try enabling AI extraction
- Consider manual content creation

### Search Not Working

- Verify content exists in campaign
- Check searchText field is populated
- Try exact name match

### Ollama Connection Failed

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Start if needed
ollama serve
```
