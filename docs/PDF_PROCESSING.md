# PDF Upload & Marker Conversion Guide

## Overview

QuiverDM has a production-ready PDF upload and Marker conversion system for processing homebrew D&D content. This document covers the complete implementation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├─────────────────────────────────────────────────────────────────┤
│  /homebrew/page.tsx (Main Library)                              │
│  ├─ HomebrewPDFUpload (Drag & Drop)                             │
│  ├─ HomebrewPDFList (Status, Actions)                           │
│  └─ HomebrewContentList (Extracted content)                     │
│                                                                   │
│  /homebrew/pdf/[pdfId]/page.tsx (Viewer)                        │
│  └─ HomebrewPDFViewer (PDF + Markdown)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      tRPC API LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  homebrewPdf.{createPDF, processPDF, getPDFs, getPDF,           │
│               toggleLLMMode, deletePDF, getStats}               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     LIBRARIES & SERVICES                        │
├─────────────────────────────────────────────────────────────────┤
│  Marker (marker.ts)           R2 Storage (r2-storage.ts)        │
│  ├─ convertPdfToMarkdown      ├─ uploadToR2                     │
│  ├─ buildMarkerCommand        ├─ downloadFromR2                 │
│  └─ parseMarkerOutput         └─ presigned URLs                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────────┤
│  Cloudflare R2 Storage    │  Marker CLI        │  LLM Models    │
│  └─ PDFs in cloud         │  ├─ PDF→Markdown   │  ├─ Gemini     │
│                           │  └─ OCR support    │  ├─ Claude     │
│                           │                    │  └─ GPT-4o     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. USER UPLOADS FILE
   HomebrewPDFUpload → POST /api/homebrew/upload-pdf

2. API UPLOAD HANDLER
   ├─ Authenticate user
   ├─ Validate PDF (type, size ≤50MB, campaign)
   ├─ uploadToR2 → returns r2Url
   ├─ prisma.homebrewPDF.create(processingStatus: "pending")
   ├─ Trigger: processInBackground() (async, not awaited)
   └─ Return: { success, pdf.id }

3. BACKGROUND PROCESSING
   ├─ Update: processingStatus = "processing"
   ├─ downloadFromR2(r2Url)
   ├─ convertPdfToMarkdown() → runs marker_single
   ├─ If success: status = "completed", store markdown
   └─ If error: status = "failed", store errorMessage

4. FRONTEND UPDATES
   ├─ React Query invalidates getPDFs
   └─ Status badge updates: pending → processing → completed/failed
```

---

## Status Lifecycle

```
"pending" (initial)     → "processing" (background starts)
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
        "completed"                       "failed"
        ├─ Green badge                    ├─ Red badge
        ├─ View/download                  ├─ Show error
        └─ Toggle LLM                     └─ Can retry
```

---

## Implementation Status

### Implemented (Complete)
- ✅ PDF upload via drag-and-drop UI
- ✅ R2 storage integration with Cloudflare
- ✅ Marker CLI integration for PDF-to-Markdown
- ✅ Background asynchronous processing
- ✅ Processing status tracking
- ✅ LLM enhancement toggle (Gemini, Anthropic, OpenAI)
- ✅ Error handling and retry mechanism
- ✅ PDF viewer with markdown preview
- ✅ tRPC API with full CRUD operations
- ✅ Authentication and authorization

### Known Limitations
- ⚠️ Fire-and-forget processing (use job queue for production)
- ⚠️ No real-time progress updates (polling only)
- ⚠️ No concurrent processing limits
- ❌ Markdown not auto-converted to HomebrewContent

---

## Key Files

```
src/
├── app/
│   ├── api/homebrew/upload-pdf/route.ts     # Upload handler
│   └── homebrew/
│       ├── page.tsx                          # Library page
│       └── pdf/[pdfId]/page.tsx              # Viewer page
├── components/homebrew/
│   ├── HomebrewPDFUpload.tsx                # Upload component
│   ├── HomebrewPDFList.tsx                  # List component
│   └── HomebrewPDFViewer.tsx                # Viewer component
├── lib/
│   ├── marker.ts                            # Marker integration
│   └── r2-storage.ts                        # R2 wrapper
└── server/routers/
    └── homebrew-pdf.ts                      # PDF router

prisma/schema.prisma                         # HomebrewPDF model
tests/homebrew-pdf-upload.spec.ts            # E2E tests
```

---

## Marker Commands

```bash
# Basic conversion
marker_single "/path/to/file.pdf" "/output/directory"

# With LLM enhancement
marker_single "/path/to/file.pdf" "/output/directory" \
  --use_llm --llm_model "gemini/gemini-2.0-flash-exp"

# Force OCR (scanned PDFs)
marker_single "/path/to/file.pdf" "/output/directory" --force_ocr

# CPU-only mode
set TORCH_DEVICE=cpu && marker_single ...
```

---

## Environment Variables

```bash
# Required for PDF uploads
R2_ACCOUNT_ID=xxxx.xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=quiverdm-media-dev

# Optional: For LLM enhancement
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
```

---

## Performance

| PDF Type | Pages | Time | Notes |
|----------|-------|------|-------|
| Simple text | 5 | 20-40s | Basic layout |
| Complex layout | 10 | 1-2 min | Tables, columns |
| With images | 20 | 2-5 min | Embedded images |
| With LLM | 10 | 2-5 min | Better extraction |
| Large (100+) | 100 | 10-30 min | GPU helps significantly |

---

## Troubleshooting

### "Processing" Status Won't Complete
- Check server logs
- Verify Marker: `marker_single --version`
- Try manual retry or delete/re-upload

### Marker Command Not Found
```bash
pip install marker-pdf
marker_single --version
```

### Out of Memory
- Wait for current processing to complete
- Split large PDFs (>100 pages)
- Limit concurrent uploads

---

## Database Schema

```prisma
model HomebrewPDF {
  id                  String    @id @default(cuid())
  userId              String
  campaignId          String?
  filename            String
  fileSize            Int
  r2Url               String
  markdownContent     String?   @db.Text
  markerProcessed     Boolean   @default(false)
  markerMetadata      Json?
  useLLM              Boolean   @default(false)
  processingStatus    String    @default("pending")
  errorMessage        String?   @db.Text
  processingStartedAt DateTime?
  processingEndedAt   DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

---

## Related Documentation

- [Homebrew Library](./HOMEBREW_LIBRARY.md) - Full homebrew system
- [Homebrew Extraction](./HOMEBREW_EXTRACTION_SYSTEM.md) - AI content extraction
- [PDF Job Queue](./PDF_JOB_QUEUE_GUIDE.md) - Background processing queue
