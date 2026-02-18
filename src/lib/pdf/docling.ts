/**
 * Docling PDF-to-Markdown Client
 *
 * Calls the Docling-serve REST API to convert PDFs to markdown.
 */

import fs from 'fs';
import path from 'path';

const DOCLING_URL = process.env.DOCLING_URL || 'http://localhost:5001';

export interface DoclingImage {
  data: string; // base64 image data
  pageNumber: number;
  format: string;
  filename: string;
}

export interface DoclingResult {
  markdown: string;
  metadata: {
    pages: number;
    processingTimeMs: number;
    provider: 'docling';
  };
  images?: DoclingImage[];
}

/**
 * Convert a PDF file to markdown using Docling REST API.
 *
 * Uses the documented file-upload endpoint:
 * POST /v1/convert/file
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

  onProgress?.(20);

  const response = await fetch(`${DOCLING_URL}/v1/convert/file`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(600_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Docling conversion failed (${response.status}): ${errorText}`);
  }

  onProgress?.(80);

  const result = await response.json();

  onProgress?.(90);

  const markdown = extractMarkdown(result);
  const pages = extractPageCount(result);
  const images = extractImages(result);

  onProgress?.(100);

  return {
    markdown,
    metadata: {
      pages,
      processingTimeMs: Date.now() - startTime,
      provider: 'docling',
    },
    images,
  };
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

function extractImages(result: unknown): DoclingImage[] {
  if (!result) return [];
  if (Array.isArray(result) && result.length > 0) return extractImages(result[0]);

  const value = result as Record<string, unknown>;
  const candidates = [
    value.images,
    value.extracted_images,
    value?.document && (value.document as Record<string, unknown>).images,
    value?.output && (value.output as Record<string, unknown>).images,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const normalized = candidate
      .map((item): DoclingImage | null => {
        if (!item || typeof item !== 'object') return null;
        const image = item as Record<string, unknown>;

        const data = typeof image.data === 'string' ? image.data : '';
        const pageRaw = image.pageNumber ?? image.page_number ?? image.page ?? 0;
        const pageNumber = typeof pageRaw === 'number' ? pageRaw : Number(pageRaw);
        const format = typeof image.format === 'string' ? image.format : 'png';
        const filename = typeof image.filename === 'string' ? image.filename : `page-${pageNumber || 1}.png`;

        if (!data || !Number.isFinite(pageNumber)) return null;

        return {
          data,
          pageNumber,
          format,
          filename,
        };
      })
      .filter((img): img is DoclingImage => img !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
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
