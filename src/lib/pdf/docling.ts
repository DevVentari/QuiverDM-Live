/**
 * Docling PDF-to-Markdown Client
 *
 * Calls the Docling-serve REST API to convert PDFs to markdown.
 */

import fs from 'fs';
import path from 'path';

const DOCLING_URL = process.env.DOCLING_URL || 'http://localhost:5001';

export interface DoclingImage {
  data: string;
  pageNumber: number;
  format: string;
  filename: string;
  width?: number;
  height?: number;
}

export interface DoclingResult {
  markdown: string;
  images: DoclingImage[];
  metadata: {
    pages: number;
    processingTimeMs: number;
    provider: 'docling';
    imagesExtracted: number;
  };
}

/**
 * Convert a PDF file to markdown using Docling REST API (async endpoint).
 *
 * Uses the async flow to avoid the sync timeout limit (DOCLING_SERVE_MAX_SYNC_WAIT):
 *   1. POST /v1/convert/file/async  → { task_id }
 *   2. Poll  GET /v1/status/poll/{task_id}  until complete
 *   3. Fetch GET /v1/result/{task_id}
 */
export async function convertWithDocling(
  pdfPath: string,
  onProgress?: (percent: number) => void,
): Promise<DoclingResult> {
  const startTime = Date.now();

  onProgress?.(10);

  const fileBuffer = await fs.promises.readFile(pdfPath);
  const filename = path.basename(pdfPath);

  const formData = new FormData();
  formData.append('files', new Blob([fileBuffer], { type: 'application/pdf' }), filename);
  // Request both markdown (for AI extraction) and json (for structured image extraction)
  formData.append('to_formats', 'md');
  formData.append('to_formats', 'json');
  formData.append('include_images', 'true');
  formData.append('image_export_mode', 'embedded');

  onProgress?.(15);

  // ── Step 1: Submit async job ──────────────────────────────────────────────
  const submitRes = await fetch(`${DOCLING_URL}/v1/convert/file/async`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60_000), // 60s to accept the upload
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text().catch(() => 'Unknown error');
    throw new Error(`Docling async submit failed (${submitRes.status}): ${errorText}`);
  }

  const taskInfo = await submitRes.json() as { task_id: string; task_status: string };
  const taskId = taskInfo.task_id;
  if (!taskId) throw new Error('Docling async submit returned no task_id');

  console.log(`[Docling] Async task submitted: ${taskId}`);
  onProgress?.(25);

  // ── Step 2: Poll until complete ───────────────────────────────────────────
  const MAX_WAIT_MS = 540_000; // 9 minutes (worker lock is 10 min)
  const POLL_INTERVAL_MS = 4_000;
  const pollStart = Date.now();

  while (Date.now() - pollStart < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    let poll: { task_status: string } | null = null;
    try {
      const pollRes = await fetch(`${DOCLING_URL}/v1/status/poll/${taskId}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (pollRes.ok) poll = await pollRes.json();
    } catch {
      // Transient network error — keep polling
    }

    const taskStatus = poll?.task_status?.toLowerCase() ?? '';

    // Estimate progress: 25% → 78% during conversion
    const elapsed = Date.now() - pollStart;
    const estimatedPct = 25 + Math.min(53, Math.floor((elapsed / MAX_WAIT_MS) * 53));
    onProgress?.(estimatedPct);

    if (taskStatus === 'success' || taskStatus === 'failure' || taskStatus === 'partial_success') {
      console.log(`[Docling] Task ${taskId} finished with status: ${taskStatus}`);
      break;
    }
    // 'pending' | 'started' → keep polling
  }

  onProgress?.(80);

  // ── Step 3: Fetch result ──────────────────────────────────────────────────
  const resultRes = await fetch(`${DOCLING_URL}/v1/result/${taskId}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!resultRes.ok) {
    const errorText = await resultRes.text().catch(() => 'Unknown error');
    throw new Error(`Docling result fetch failed (${resultRes.status}): ${errorText}`);
  }

  const result = await resultRes.json();

  onProgress?.(90);

  // Check conversion status before extracting content
  const status = extractStatus(result);
  if (status === 'failure' || status === 'skipped') {
    const errors = extractErrors(result);
    throw new Error(`Docling conversion ${status}: ${errors || 'no details'}`);
  }
  if (status && status !== 'success' && status !== 'partial_success') {
    console.warn(`[Docling] Unexpected conversion status: ${status}`);
  }

  const markdown = extractMarkdown(result);
  const pages = extractPageCount(result);
  const images = extractImages(result);

  onProgress?.(100);

  return {
    markdown,
    images,
    metadata: {
      pages,
      processingTimeMs: Date.now() - startTime,
      provider: 'docling',
      imagesExtracted: images.length,
    },
  };
}

function extractStatus(result: unknown): string | undefined {
  if (!result) return undefined;
  if (Array.isArray(result) && result.length > 0) return extractStatus(result[0]);
  const value = result as Record<string, unknown>;
  const s = value?.status;
  return typeof s === 'string' ? s : undefined;
}

function extractErrors(result: unknown): string {
  if (!result) return '';
  if (Array.isArray(result) && result.length > 0) return extractErrors(result[0]);
  const value = result as Record<string, unknown>;
  const errors = value?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors
      .map((e: unknown) => {
        const er = asRecord(e);
        return er?.error_message ?? er?.message ?? JSON.stringify(er);
      })
      .join('; ');
  }
  return '';
}

function extractMarkdown(result: unknown): string {
  if (!result) {
    throw new Error('Could not extract markdown from empty Docling response');
  }

  if (Array.isArray(result) && result.length > 0) {
    return extractMarkdown(result[0]);
  }

  const value = result as Record<string, unknown>;
  const markdownCandidates = [
    value?.document && (value.document as Record<string, unknown>).md_content,
    value?.output && (value.output as Record<string, unknown>).md_content,
    value.md_content,
    value.content,
  ];

  for (const candidate of markdownCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  throw new Error('Could not extract markdown from Docling response');
}

function extractPageCount(result: unknown): number {
  if (!result) return 0;
  if (Array.isArray(result) && result.length > 0) return extractPageCount(result[0]);

  const value = result as Record<string, unknown>;
  const numericCandidates = [
    value?.document && (value.document as Record<string, unknown>).num_pages,
    value?.document && (value.document as Record<string, unknown>).pages,
    value?.output && (value.output as Record<string, unknown>).num_pages,
    value.num_pages,
    value.pages,
  ];

  for (const candidate of numericCandidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function formatFromMime(mimeType: string): string | undefined {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized.includes('/')) {
    const [, subtypeRaw] = normalized.split('/', 2);
    const subtype = subtypeRaw.split(';', 1)[0].trim();
    if (subtype === 'jpeg') return 'jpg';
    return subtype || undefined;
  }

  if (normalized.startsWith('.')) {
    return normalized.slice(1);
  }

  return normalized;
}

function parseImageUri(value: string): { data: string; format?: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(raw);
  if (match) {
    const format = formatFromMime(match[1]);
    return { data: match[2], format };
  }
  return { data: raw };
}

function parseImageData(value: unknown): { data: string; format?: string } | null {
  // Handle ImageRef object: { uri: "data:image/png;base64,...", mimetype: "image/png", ... }
  const rec = asRecord(value);
  if (rec) {
    const uri = rec.uri;
    if (typeof uri === 'string' && uri.trim()) {
      return parseImageUri(uri);
    }
    return null;
  }

  if (typeof value !== 'string') return null;
  return parseImageUri(value);
}

function parsePageNumber(imageRecord: Record<string, unknown>): number {
  const directCandidates = [
    imageRecord.pageNumber,
    imageRecord.page,
    imageRecord.page_no,
    imageRecord.pageIndex,
  ];

  for (const candidate of directCandidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== undefined) return parsed;
  }

  const prov = imageRecord.prov;
  if (Array.isArray(prov)) {
    for (const entry of prov) {
      const entryRecord = asRecord(entry);
      if (!entryRecord) continue;
      const parsed = toFiniteNumber(entryRecord.page_no ?? entryRecord.page);
      if (parsed !== undefined) return parsed;
    }
  }

  return 0;
}

function normalizeImage(
  image: unknown,
  index: number,
): DoclingImage | null {
  const imageRecord = asRecord(image);
  if (!imageRecord) return null;

  const dataCandidates = [
    // DoclingDocument PictureItem stores image as ImageRef object at .image
    imageRecord.image,    // ImageRef: { uri: "data:...", mimetype, dpi, size }
    imageRecord.data,
    imageRecord.base64,
    imageRecord.content,
    imageRecord.uri,      // fallback: direct uri string
  ];

  let parsedData: { data: string; format?: string } | null = null;
  for (const candidate of dataCandidates) {
    parsedData = parseImageData(candidate);
    if (parsedData) break;
  }

  if (!parsedData) return null;

  // Format can come from ImageRef.mimetype (DoclingDocument) or legacy fields
  const imageRef = asRecord(imageRecord.image);
  const formatCandidates = [
    imageRef?.mimetype,
    imageRecord.format,
    imageRecord.type,
    imageRecord.mimeType,
    imageRecord.mime_type,
    imageRecord.extension,
    imageRecord.ext,
    parsedData.format,
  ];

  let format = 'png';
  for (const candidate of formatCandidates) {
    if (typeof candidate !== 'string') continue;
    const parsed = formatFromMime(candidate);
    if (!parsed) continue;
    format = parsed;
    break;
  }

  const pageNumber = parsePageNumber(imageRecord);
  const filenameValue = imageRecord.filename ?? imageRecord.name;
  const filename =
    typeof filenameValue === 'string' && filenameValue.trim().length > 0
      ? filenameValue
      : `image_${index + 1}.${format}`;

  const width = toFiniteNumber(imageRecord.width);
  const height = toFiniteNumber(imageRecord.height);

  return {
    data: parsedData.data,
    pageNumber,
    format,
    filename,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

export function extractImages(result: unknown): DoclingImage[] {
  if (!result) return [];

  if (Array.isArray(result)) {
    return result.flatMap((entry) => extractImages(entry));
  }

  const value = asRecord(result);
  if (!value) return [];

  const document = asRecord(value.document);
  const output = asRecord(value.output);
  const documentJson = asRecord(document?.json_content);
  const outputJson = asRecord(output?.json_content);

  // DoclingDocument stores pictures in json_content.pictures[]
  // Collect from all known locations
  const imageCandidates: unknown[] = [
    documentJson?.pictures,
    outputJson?.pictures,
    document?.images,
    output?.images,
    value.images,
  ];

  const extracted: DoclingImage[] = [];
  const seen = new Set<string>();

  for (const candidate of imageCandidates) {
    if (!Array.isArray(candidate)) continue;

    for (const [index, image] of candidate.entries()) {
      const normalized = normalizeImage(image, index);
      if (!normalized) continue;

      const signature = `${normalized.pageNumber}:${normalized.format}:${normalized.data.slice(0, 64)}`;
      if (seen.has(signature)) continue;

      seen.add(signature);
      extracted.push(normalized);
    }
  }

  return extracted;
}

export async function isDoclingAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DOCLING_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
