# AI Extraction Reporting Design

**Goal:** Show live progress during AI extraction and a final item-count summary on both the PDF list and detail pages.

**Architecture:** Polling-based (same pattern as PDF conversion). Two nullable fields added to `HomebrewPDF`. Worker writes chunk-by-chunk progress. UI polls every 2s during extraction, stops on completion.

**Tech Stack:** Prisma schema migration, tRPC, React polling via `refetchInterval`

---

## Schema

Add to `HomebrewPDF`:

```prisma
aiExtractionStatus    String?   // null | 'processing' | 'done' | 'error'
aiExtractionProgress  Json?     // { chunk: number, totalChunks: number, itemsFound: number, byType: Record<string,number> }
```

Both nullable — no data migration needed, existing rows stay as-is.

## Worker Changes

In `src/lib/queue/pdf-worker.ts` (the extraction code path):

1. Before processing chunks: set `aiExtractionStatus = 'processing'`, `aiExtractionProgress = { chunk: 0, totalChunks: N, itemsFound: 0, byType: {} }`
2. After each chunk: update `aiExtractionProgress` with current chunk index, running itemsFound count, and byType breakdown
3. On completion: set `aiExtractionStatus = 'done'`, write final progress
4. On error: set `aiExtractionStatus = 'error'`

## tRPC

Extend `homebrewPdf.getJobStatus` response to include `aiExtractionStatus` and `aiExtractionProgress` from the DB row (already queries HomebrewPDF — just select these fields).

Also extend `homebrewPdf.getPDFs` list response to include `aiExtractionStatus` and `aiExtractionProgress` so list cards can show final summaries without extra queries.

## UI — PDF List Card

- When `aiExtractionStatus = 'processing'`: show a second progress bar (amber) beneath the main blue one, labeled "Extracting content… chunk X of Y • N items found"
- When `aiExtractionStatus = 'done'`: show inline under filename: `47 items · 12 spells · 8 monsters · 3 items`
- When `aiExtractionStatus = 'error'`: show small amber warning text "Extraction failed"
- Enable polling (`refetchInterval: 2000`) when either `processingStatus` is active OR `aiExtractionStatus = 'processing'`

## UI — PDF Detail Page

- During extraction: replace the "Extract D&D Content" button area with a live progress bar + "Found N items so far (chunk X/Y)…" text. Polling via `refetchInterval` on the existing `getJobStatus` query.
- After completion: show final summary badge row at the top of the Extracted Content tab: `47 items extracted • 12 spells • 8 monsters • 3 items`
- The existing grid of HomebrewContentCard items stays — summary row is additive

## Error Handling

- If extraction fails mid-run, `aiExtractionStatus = 'error'` — show retry option
- Progress fields remain from last successful chunk write (shows how far it got)
- Extraction errors don't affect `processingStatus` (PDF conversion already completed)
