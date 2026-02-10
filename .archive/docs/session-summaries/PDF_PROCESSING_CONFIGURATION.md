# PDF Processing Configuration - Marker Setup

**Date:** 2025-11-14
**Status:** ✅ CONFIGURED

## Overview

QuiverDM now uses **Marker + Gemini** for fast, accurate PDF-to-markdown conversion. PDFs are immediately readable after processing, with AI extraction of homebrew items happening later as a separate step.

## Current Configuration

### Frontend Component
**File:** `src/components/homebrew/HomebrewPDFList.tsx`

```typescript
const handleProcess = async (pdfId: string) => {
  const response = await fetch('/api/homebrew/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfId,
      useAI: false, // Just convert to readable format, AI extraction later
      aiProvider: 'marker', // Use Marker for fast, accurate PDF conversion
    }),
  });
};
```

### Processing Workflow

```
1. User uploads PDF
   ↓
2. PDF stored in database (status: "pending")
   ↓
3. User clicks "Process Now" button
   ↓
4. Marker + Gemini converts PDF → Markdown
   ↓
5. Markdown stored in database (markdownContent field)
   ↓
6. PDF status → "completed" (with 0 extracted items)
   ↓
7. PDF is now readable in the UI
   ↓
8. Future: AI extraction of homebrew items from markdown
```

## Why This Approach?

### Benefits
1. **Fast Processing**: ~0.3 seconds per page (10x faster than alternatives)
2. **Immediately Readable**: Users can view PDF content right away as markdown
3. **Cost Effective**: ~$0.15 per 400-page sourcebook
4. **Decouple Concerns**:
   - Phase 1: Make readable (Marker)
   - Phase 2: Extract items (AI, later)

### Technical Details

- **Marker Output**: Clean markdown stored in `markdownContent` field
- **No Item Extraction**: Returns empty `items: []` array
- **Database Fields Used**:
  - `markdownContent` (TEXT) - Full markdown output
  - `markerProcessed` (BOOLEAN) - Processing status flag
  - `markerMetadata` (JSON) - Processing metrics (pages, tokens, cost, time)
  - `processingStatus` → "completed"
  - `extractedCount` → All zeros

## Processing Example

### 2-Page Test PDF
- **Processing Time**: ~1 second
- **Cost**: $0.0008
- **Output**: Clean markdown with preserved formatting
- **Items Extracted**: 0 (by design)

### 400-Page Sourcebook
- **Processing Time**: ~2 minutes
- **Cost**: ~$0.15
- **Output**: Full sourcebook as markdown
- **Items Extracted**: 0 (AI extraction comes later)

## Environment Requirements

```env
# Required for Marker + Gemini
GEMINI_API_KEY=your-api-key-here
```

**Note**: No other services needed! No Docker, no local servers.

## User Experience

### Upload Flow
1. User drags PDF into upload area
2. PDF appears instantly with "pending" status
3. User clicks "🔷 Process Now" button
4. Processing starts (shows progress if available)
5. PDF status changes to "completed"
6. User can now view markdown content

### What Users See
- **Before Processing**: "Status: pending" badge, "Process Now" button
- **After Processing**: "Status: completed" badge, "View Content" button
- **Markdown View**: Clean, readable formatted text

## Future: AI Extraction

When you're ready to add AI extraction of homebrew items:

### Option 1: Separate Button
```tsx
{pdf.processingStatus === 'completed' && (
  <Button onClick={() => handleExtract(pdf.id)}>
    Extract Items with AI
  </Button>
)}
```

### Option 2: Automatic Queue
```typescript
// After markdown processing completes
if (pdf.markerProcessed && !pdf.itemsExtracted) {
  queueAIExtraction(pdf.id);
}
```

### Extraction Flow
```
1. PDF already has markdown in database
   ↓
2. Pass markdown to AI (Gemini/GPT-4)
   ↓
3. AI extracts: items, creatures, spells, etc.
   ↓
4. Save extracted items to HomebrewContent table
   ↓
5. Update extractedCount field
   ↓
6. Link items to campaign
```

## API Endpoint Configuration

**Endpoint:** `POST /api/homebrew/process`

**Request Body:**
```json
{
  "pdfId": "cm123abc",
  "useAI": false,
  "aiProvider": "marker"
}
```

**Response:**
```json
{
  "success": true,
  "pdfId": "cm123abc",
  "markdown": "# Chapter 1\n\n...",
  "pages": 35,
  "tokensUsed": 87500,
  "cost": 0.013,
  "processingTime": 10.5,
  "itemsExtracted": 0
}
```

## Comparison: Marker vs Other Options

| Provider | Speed/Page | Cost/Page | Output | AI Extraction |
|----------|-----------|-----------|--------|---------------|
| **Marker** | 0.3s | $0.0004 | Markdown | No (later) |
| Docling | 4-8s | Free | Structured | No |
| OpenAI Vision | 2-3s | $0.10 | Items | Yes |
| Gemini Vision | 1-2s | $0.02 | Items | Yes |
| Ollama | 10-15s | Free | Items | Yes |

**Winner**: Marker for speed + cost, with clean markdown output for reading

## Troubleshooting

### Issue: "Marker not found"
```bash
pip install marker-pdf[full]
```

### Issue: "GEMINI_API_KEY not set"
Add to `.env.local`:
```env
GEMINI_API_KEY=your-key-here
```

### Issue: "Processing takes too long"
- **Expected**: ~0.3s per page
- **2 pages**: ~1 second
- **35 pages**: ~10 seconds
- **400 pages**: ~2 minutes

If slower, check:
- CPU usage (should be high during processing)
- Network connection (for Gemini API calls)
- Disk space (for temporary files)

## Summary

✅ **Current Setup**: Marker converts PDFs to readable markdown
✅ **Fast**: 10x faster than alternatives
✅ **Affordable**: $0.15 per 400-page book
✅ **Clean Output**: Well-formatted markdown
✅ **Future-Ready**: Easy to add AI extraction later

**Result**: Users can upload a PDF and have it readable in seconds, with full AI extraction coming as a follow-up feature.

---

**Last Updated:** 2025-11-14
**Configuration File:** `src/components/homebrew/HomebrewPDFList.tsx`
**Processing Script:** `scripts/process-pdf-external.ts`
