# PDF Processing Workflow

## Overview

Handles PDF upload, Marker conversion to markdown, and AI-powered D&D content extraction.

## Components

### Backend
- `src/server/routers/homebrew-pdf.ts` - PDF management router
- `src/server/routers/homebrew-extraction.ts` - AI extraction router
- `src/lib/pdf/marker.ts` - Marker CLI integration
- `src/lib/ai/extraction.ts` - AI extraction orchestration
- `src/lib/ai/gemini.ts` - Gemini extraction
- `src/lib/ai/ollama.ts` - Ollama local extraction
- `src/lib/queue/queue.ts` - BullMQ job queue
- `src/lib/queue/worker.ts` - PDF worker process

### Frontend
- `src/components/homebrew/HomebrewPDFUpload.tsx` - Upload component
- `src/components/homebrew/HomebrewPDFViewer.tsx` - PDF viewer
- `src/components/homebrew/HomebrewPDFList.tsx` - PDF list

### API Routes
- `src/app/api/homebrew/upload-pdf/route.ts` - Upload endpoint

## Prerequisites

### Marker Installation
```bash
# Install Marker CLI
pip install marker-pdf

# Verify installation
marker --help
```

### Environment Variables
```env
# AI Providers (at least one required for extraction)
GEMINI_API_KEY=your-key      # Recommended: fast and cheap
ANTHROPIC_API_KEY=your-key   # Most accurate
OPENAI_API_KEY=your-key      # Balanced

# Queue
REDIS_URL=redis://localhost:6380
```

## Test Procedures

### 1. PDF Upload
```typescript
// Via API route
const formData = new FormData();
formData.append('file', pdfFile);
formData.append('useAIExtraction', 'true');
formData.append('llmProvider', 'gemini');

fetch('/api/homebrew/upload-pdf', {
  method: 'POST',
  body: formData
})
// Expected: { pdf: { id, status: "queued" } }
```

### 2. PDF Management
```typescript
// Test: Get user's PDFs
trpc.homebrewPdf.getPDFs.query()
// Expected: Array of PDFs with processing status

// Test: Get PDF by ID
trpc.homebrewPdf.getById.query({ id: "pdf-id" })
// Expected: Full PDF details with markdown content

// Test: Get stats
trpc.homebrewPdf.getStats.query()
// Expected: { total, processed, pending, failed }
```

### 3. Marker Processing
```typescript
// Test: Check Marker availability
// (Internal check during worker startup)
// Expected: Marker CLI found and executable

// Processing stages:
// 1. PDF uploaded to storage
// 2. Job queued in BullMQ
// 3. Worker picks up job
// 4. Marker converts PDF to markdown
// 5. Markdown saved to database
// 6. Status updated to "completed"
```

### 4. AI Extraction
```typescript
// Test: Trigger extraction
trpc.homebrewExtraction.extractFromPdf.mutate({
  pdfId: "pdf-id",
  contentTypes: ["spell", "creature", "item"],
  provider: "gemini"
})
// Expected: Extraction job started

// Test: Get extraction status
trpc.homebrewExtraction.getExtractionStatus.query({
  pdfId: "pdf-id"
})
// Expected: { status, extractedContent: [...] }
```

### 5. Search PDFs
```typescript
// Test: Search PDF content
trpc.homebrewPdf.search.query({
  query: "fireball",
  limit: 10
})
// Expected: Array of matching PDFs with highlights
```

## Processing Pipeline

```
1. Upload PDF via API
   ↓
2. Store PDF in local storage / R2
   ↓
3. Create DB entry (status: "queued")
   ↓
4. Add job to BullMQ queue
   ↓
5. Worker picks up job
   ↓
6. Marker converts to markdown
   ↓
7. Save markdown to database
   ↓
8. (Optional) AI extraction
   ↓
9. Update status to "completed"
```

## Worker Commands

```bash
# Start PDF worker
npm run worker:pdf

# Start with auto-reload (dev)
npm run worker:pdf:dev

# Check queue status (via Redis CLI)
redis-cli -p 6380
> LLEN bull:pdf-processing:wait
```

## LLM Provider Comparison

| Provider | Speed | Accuracy | Cost/Page |
|----------|-------|----------|-----------|
| Gemini 2.0 Flash | Fastest | Good | ~$0.01 |
| Claude Sonnet | Medium | Best | ~$0.03 |
| GPT-4o Mini | Medium | Good | ~$0.02 |

## Validation Checklist

- [ ] PDF upload creates storage file
- [ ] Database entry created with correct metadata
- [ ] BullMQ job queued successfully
- [ ] Worker processes job
- [ ] Marker produces valid markdown
- [ ] AI extraction identifies content types
- [ ] Extracted content saved as homebrew
- [ ] Search indexes updated
- [ ] Error handling for corrupt PDFs
- [ ] Large PDF handling (>50 pages)

## Test Data

Sample PDFs for testing:
- D&D sourcebook excerpts
- Homebrew content PDFs
- Mixed content documents

## Known Issues

- Marker may crash on very large PDFs (>100MB)
- Some PDF formats not supported (scanned images without OCR)
- AI extraction costs accumulate with many pages

## Test Results

See `results/` directory for test execution logs.
