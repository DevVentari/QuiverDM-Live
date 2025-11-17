# PDF Upload & Marker Conversion - Quick Reference

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  /homebrew/page.tsx (Main Library)                              │
│  ├─ HomebrewPDFUpload (Drag & Drop)                             │
│  ├─ HomebrewPDFList (Status, Actions)                           │
│  └─ HomebrewContentList (Extracted content)                     │
│                                                                   │
│  /homebrew/pdf/[pdfId]/page.tsx (Viewer)                        │
│  └─ HomebrewPDFViewer (PDF + Markdown)                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC API LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  homebrewPdf.{                                                   │
│    createPDF, processPDF, getPDFs, getPDF,                      │
│    toggleLLMMode, deletePDF, getStats                           │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   API ROUTES & HANDLERS                         │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/homebrew/upload-pdf                                  │
│  ├─ Authenticate (NextAuth)                                     │
│  ├─ Validate (type, size, campaign)                            │
│  ├─ Upload to R2                                                │
│  ├─ Create DB record                                            │
│  └─ Trigger background processing (fire-and-forget)             │
│                                                                   │
│  Background Process (async):                                     │
│  ├─ Download PDF from R2                                        │
│  ├─ Convert via Marker                                          │
│  ├─ Store markdown + metadata                                   │
│  └─ Update status (processing → completed/failed)               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     LIBRARIES & SERVICES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Marker (marker.ts)           R2 Storage (r2-storage.ts)        │
│  ├─ convertPdfToMarkdown      ├─ uploadToR2                     │
│  ├─ buildMarkerCommand        ├─ downloadFromR2                 │
│  └─ parseMarkerOutput         ├─ deleteFromR2                   │
│                               └─ presigned URLs                 │
│                                                                   │
│  Prisma ORM                   Authentication                     │
│  ├─ HomebrewPDF model         └─ NextAuth v5                    │
│  ├─ HomebrewContent model                                       │
│  └─ Database transactions                                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Cloudflare R2 Storage                  Marker CLI              │
│  └─ PDFs stored in cloud                ├─ PDF → Markdown       │
│     (S3-compatible)                     ├─ OCR support          │
│                                         ├─ LLM enhancement      │
│                                         └─ Optional: GPU accel. │
│                                                                   │
│  PostgreSQL Database                    LLM Models              │
│  └─ Stores metadata & content           ├─ Gemini 2.0 Flash     │
│                                         ├─ Claude Sonnet        │
│                                         └─ GPT-4o               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Upload → Processing → Display

```
STEP 1: USER UPLOADS FILE
┌─────────────────────────────────────────┐
│ HomebrewPDFUpload Component             │
│ ├─ Drag & drop or file selector         │
│ ├─ Client-side validation               │
│ └─ POST /api/homebrew/upload-pdf        │
└─────────────────────────────────────────┘
                    ↓
STEP 2: API UPLOAD HANDLER
┌─────────────────────────────────────────┐
│ POST /api/homebrew/upload-pdf/route.ts  │
│ ├─ Authenticate user                    │
│ ├─ Validate PDF (type, size, campaign)  │
│ ├─ uploadToR2 → returns r2Url           │
│ ├─ prisma.homebrewPDF.create()          │
│ │  └─ processingStatus: "pending"       │
│ ├─ Trigger: processInBackground()       │
│ │  (async, not awaited)                 │
│ └─ Return: { success, pdf.id }          │
└─────────────────────────────────────────┘
                    ↓
STEP 3: BACKGROUND PROCESSING (async)
┌─────────────────────────────────────────┐
│ processInBackground()                   │
│ ├─ Update: processingStatus = "processing" │
│ ├─ downloadFromR2(r2Url)                │
│ ├─ Save temp file                       │
│ ├─ convertPdfToMarkdown()               │
│ │  └─ Runs: marker_single [pdf] [output] │
│ ├─ Parse Marker output                  │
│ ├─ Clean temp file                      │
│ ├─ If success:                          │
│ │  └─ Update: processingStatus = "completed" │
│ │     markdownContent = "..."           │
│ │     markerMetadata = {...}            │
│ └─ If error:                            │
│    └─ Update: processingStatus = "failed" │
│       errorMessage = "..."              │
└─────────────────────────────────────────┘
                    ↓
STEP 4: FRONTEND UPDATES
┌─────────────────────────────────────────┐
│ React Query Updates                     │
│ ├─ utils.homebrewPdf.getPDFs.invalidate │
│ ├─ Refetch PDF list                     │
│ └─ Show new PDF with "pending" status   │
│                                         │
│ Polling (built into getPDFs):           │
│ ├─ Component checks status              │
│ ├─ "pending" → status badge             │
│ ├─ "processing" → spinner badge         │
│ └─ "completed" → green badge, show      │
│    download/view buttons                │
└─────────────────────────────────────────┘
                    ↓
STEP 5: DISPLAY RESULTS
┌─────────────────────────────────────────┐
│ HomebrewPDFViewer                       │
│ ├─ GET /homebrew/pdf/[pdfId]           │
│ ├─ Show PDF metadata                    │
│ ├─ Tabs:                                │
│ │  ├─ PDF View (embedded <embed>)      │
│ │  └─ Markdown (debug preview)         │
│ ├─ Download buttons                     │
│ └─ Processing details                   │
│    (pages, time, tokens, cost)         │
└─────────────────────────────────────────┘
```

---

## Database Schema

```sql
CREATE TABLE "HomebrewPDF" (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL,
  campaignId            TEXT,  -- optional
  
  -- File metadata
  filename              TEXT NOT NULL,
  fileSize              INT NOT NULL,        -- bytes
  mimeType              TEXT DEFAULT 'application/pdf',
  r2Url                 TEXT NOT NULL,       -- Cloudflare R2 URL
  
  -- Marker processing results
  markdownContent       TEXT,                -- Converted markdown
  markdownR2Url         TEXT,                -- For large files
  markerProcessed       BOOLEAN DEFAULT false,
  markerMetadata        JSON,                -- {pages, processingTime, ...}
  useLLM                BOOLEAN DEFAULT false,
  
  -- Processing status
  processingStatus      TEXT DEFAULT 'pending',  -- pending|processing|completed|failed
  errorMessage          TEXT,
  processingStartedAt   TIMESTAMP,
  processingEndedAt     TIMESTAMP,
  
  createdAt             TIMESTAMP DEFAULT now(),
  updatedAt             TIMESTAMP DEFAULT now(),
  
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  FOREIGN KEY (campaignId) REFERENCES "Campaign"(id) ON DELETE SET NULL,
  INDEX (userId),
  INDEX (campaignId),
  INDEX (processingStatus),
  INDEX (createdAt)
);
```

---

## Marker Integration Details

### Command Execution

```bash
# Basic conversion
marker_single "/path/to/file.pdf" "/output/directory"

# With LLM enhancement (Gemini)
marker_single "/path/to/file.pdf" "/output/directory" \
  --use_llm \
  --llm_model "gemini/gemini-2.0-flash-exp"

# With Anthropic Claude
marker_single "/path/to/file.pdf" "/output/directory" \
  --use_llm \
  --llm_model "anthropic/claude-3-5-sonnet-20241022"

# With OpenAI GPT-4o
marker_single "/path/to/file.pdf" "/output/directory" \
  --use_llm \
  --llm_model "openai/gpt-4o"

# Force OCR (for scanned PDFs)
marker_single "/path/to/file.pdf" "/output/directory" --force_ocr

# CPU-only mode
set TORCH_DEVICE=cpu && marker_single ...
```

### Output Files

```
/output/directory/
├── file.md                 ← Main markdown output
└── images/                 ← Extracted images (if any)
    ├── image_1.png
    └── image_2.png
```

### Metadata Extraction

```
Marker stdout/stderr parsed for:
- Page count: "\d+ pages?" regex
- Token usage: "tokens?:\s*(\d+)" regex (if LLM)
- Image count: "\d+ images?" regex

Calculated:
- Processing time: start → end
- LLM cost: tokens * (price per model)
```

---

## API Endpoints

### POST /api/homebrew/upload-pdf

**Request (FormData)**:
```
file: File (PDF, max 50MB)
campaignId: string? (optional)
useLLM: boolean (default: false)
```

**Response (Success)**:
```json
{
  "success": true,
  "pdf": {
    "id": "cuid123",
    "filename": "homebrew.pdf",
    "fileSize": 2048000,
    "processingStatus": "pending",
    "useLLM": false
  }
}
```

**Response (Error)**:
```json
{
  "error": "File must be a PDF" | "File size exceeds..." | "Unauthorized" | "Upload failed"
}
```

---

### homebrewPdf.processPDF

**Input**:
```typescript
{
  pdfId: string
}
```

**Output**:
```typescript
{
  id: string,
  markdownContent: string,
  markerMetadata: {
    pages: number,
    processingTime: number,  // seconds
    imagesExtracted?: number,
    llmUsed: boolean,
    llmProvider?: string,
    tokensUsed?: number,
    estimatedCost?: number
  },
  processingStatus: "completed"
}
```

---

### homebrewPdf.getPDFs

**Input**:
```typescript
{
  campaignId?: string,
  limit?: number,      // 1-100, default 50
  cursor?: string      // pagination cursor
}
```

**Output**:
```typescript
{
  items: HomebrewPDF[],
  nextCursor?: string
}
```

---

### homebrewPdf.toggleLLMMode

**Input**:
```typescript
{
  pdfId: string,
  useLLM: boolean
}
```

**Effect**:
- Clears existing markdown
- Resets to "pending" status
- Triggers reprocessing with new LLM setting

---

## Status Lifecycle

```
Upload
  ↓
┌─ "pending" ────────────────────┐
│  (Initial state)               │
│  ├─ Show status badge (gray)   │
│  ├─ No content available       │
│  └─ Can delete                 │
│                                │
└─→ Background process starts    │
   (processInBackground)         │
                                 ↓
               ┌─ "processing" ──┐
               │ (In progress)   │
               │ ├─ Show spinner │
               │ ├─ Blue badge   │
               │ └─ Can delete   │
               │                 │
               └────↓────────────┘
                    │
         ┌──────────┴──────────┐
         ↓                     ↓
    "completed"            "failed"
    (Success)              (Error)
    ├─ Green badge        ├─ Red badge
    ├─ Can view/download  ├─ Show error msg
    ├─ Can download MD    ├─ Can retry
    ├─ Can toggle LLM     ├─ Can delete
    └─ Can delete         └─ No content
```

---

## Error Handling

### Possible Errors

| Error | Cause | User Action |
|-------|-------|-------------|
| "File must be a PDF" | Wrong MIME type | Select valid PDF |
| "File size exceeds 50MB" | Too large | Use smaller PDF |
| "Campaign not found or access denied" | Wrong campaign ID | Select valid campaign |
| "PDF not found" | PDF record deleted | Reload page |
| "PDF is already being processed" | Concurrent request | Wait for completion |
| "Marker did not generate markdown file" | Marker failed to execute | Retry or delete |
| "MARKER_EXECUTION_FAILED" | Marker crashed | Check logs, retry |

### Error Recovery

```
1. Check errorMessage in HomebrewPDF
2. Inspect processingEndedAt timestamp
3. Try retry button (resets to "pending")
4. Check Marker installation: marker_single --version
5. Check server logs for detailed error
6. Delete and re-upload PDF
```

---

## Performance Characteristics

### Typical Processing Times

| PDF Type | Pages | Processing Time | Notes |
|----------|-------|---|---|
| Simple text | 5 | 20-40s | No images, basic layout |
| Complex layout | 10 | 1-2 min | Tables, multiple columns |
| With images | 20 | 2-5 min | Embedded images/charts |
| Scanned (good) | 10 | 1-2 min | OCR required, good quality |
| Scanned (poor) | 10 | 1-3 min | Lower accuracy |
| With LLM (Gemini) | 10 | 2-5 min | Slower, better extraction |
| Large (100+ pages) | 100 | 10-30 min | Multiple chunks, GPU helps |

### Memory Usage

```
Per PDF:
- Original file: ~1-50 MB
- Temp working file: ~same
- Markdown output: ~0.5-5 MB
- Metadata: ~1 KB

Concurrent PDFs:
- 1 PDF: ~50-100 MB
- 2 PDFs: ~100-200 MB (can spike during processing)
- 3+ PDFs: Risk of memory exhaustion
```

### Optimization Tips

```
1. Use GPU if available (auto-detect)
   - Set TORCH_DEVICE not needed (auto)
   - 3-5x faster than CPU

2. Disable LLM for simple PDFs
   - Only enable for complex layouts
   - Saves time and cost

3. Keep file size small
   - Split 200+ page PDFs
   - Less memory required

4. Batch uploads
   - Implement queue
   - Limit concurrent to 1-2
   - Prevents overload
```

---

## Environment Variables Checklist

```bash
# Required for PDF uploads
R2_ACCOUNT_ID=xxxx.xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=quiverdm-media-dev

# Optional: For LLM enhancement
OPENAI_API_KEY=sk-...  # For Gemini, uses Marker's built-in
ANTHROPIC_API_KEY=... # Alternative to Gemini
GOOGLE_API_KEY=...    # Alternative (Gemini)

# System-level (for GPU acceleration)
TORCH_DEVICE=auto|cuda|cpu  # Default: auto-detect
CUDA_VISIBLE_DEVICES=0      # GPU device ID
```

---

## Common Tasks

### Upload and Convert a PDF

1. Navigate to `/homebrew`
2. Click "PDF Library" tab
3. Drag PDF or click to select
4. (Optional) Check "Use AI Enhancement"
5. Click "Upload and Process"
6. Wait for status to change to "completed"

### View Converted Markdown

1. Open PDF from list (click "View")
2. Click "Markdown (Debug)" tab
3. Read raw markdown output
4. Download markdown file if needed

### Re-process with Different Settings

1. Open PDF from list
2. Click menu (⋮)
3. Select "Enable/Disable AI Enhancement"
4. PDF resets to "pending"
5. Automatic reprocessing starts

### Delete PDF

1. Open PDF from list
2. Click menu (⋮)
3. Select "Delete"
4. Confirm in dialog
5. Deleted from R2 and database

---

## Troubleshooting

### "Processing" Status Won't Complete

**Symptoms**: Status stuck on "processing" for hours

**Causes**:
- Server crashed mid-processing
- Marker process hung
- Very large PDF taking long time

**Solutions**:
1. Check server logs: `npm run dev` output
2. Check Marker is installed: `marker_single --version`
3. Try manual retry: Click menu → "Retry Processing"
4. Delete and re-upload

### "Failed" Status with No Error Message

**Symptoms**: Status is "failed" but no error text shown

**Causes**:
- Unknown error in background process
- Marker crashed silently

**Solutions**:
1. Check browser console for errors
2. Check server logs
3. Try uploading smaller PDF
4. Verify Marker installation

### Marker Command Not Found

**Symptoms**: "marker_single: command not found" error

**Causes**:
- Marker not installed
- Not in system PATH
- Python venv not activated

**Solutions**:
```bash
# Install Marker
pip install marker-pdf

# Verify installation
marker_single --version

# Or use full path
which marker_single  # Find location
```

### Out of Memory Error

**Symptoms**: Server crashes or "memory exceeded" error

**Causes**:
- Multiple large PDFs processing simultaneously
- Insufficient system RAM

**Solutions**:
1. Wait for current processing to complete
2. Limit concurrent uploads (max 1)
3. Split large PDFs (>100 pages)
4. Increase server memory allocation

---

## File Structure

```
Key Files:

src/
├── app/
│   ├── api/homebrew/upload-pdf/route.ts     (Upload handler)
│   └── homebrew/
│       ├── page.tsx                          (Library page)
│       └── pdf/[pdfId]/page.tsx              (Viewer page)
├── components/homebrew/
│   ├── HomebrewPDFUpload.tsx                (Upload component)
│   ├── HomebrewPDFList.tsx                  (List component)
│   └── HomebrewPDFViewer.tsx                (Viewer component)
├── lib/
│   ├── marker.ts                            (Marker integration)
│   └── r2-storage.ts                        (R2 wrapper)
└── server/routers/
    ├── homebrew-pdf.ts                      (PDF router)
    └── _app.ts                              (Router registration)

prisma/
└── schema.prisma                            (HomebrewPDF model)

tests/
└── homebrew-pdf-upload.spec.ts              (E2E tests)
```

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| **PDF Upload** | ✅ Complete | Drag-and-drop, R2 storage |
| **Marker Integration** | ✅ Complete | CLI execution, metadata parsing |
| **Status Tracking** | ✅ Complete | 4 states with timestamps |
| **LLM Enhancement** | ✅ Complete | Gemini, Claude, GPT-4o |
| **Error Handling** | ✅ Complete | Errors stored, retryable |
| **UI Components** | ✅ Complete | Upload, list, viewer |
| **Authentication** | ✅ Complete | NextAuth protected |
| **Background Processing** | ⚠️ Fire-and-forget | No job queue, could lose work |
| **Real-time Updates** | ❌ Polling only | No WebSocket/SSE |
| **Concurrent Limits** | ❌ None | Risk of overload |
| **Content Extraction** | ❌ Not implemented | Markdown generated but not parsed |

