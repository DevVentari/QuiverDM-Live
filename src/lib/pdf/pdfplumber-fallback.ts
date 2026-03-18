/**
 * pymupdf4llm fallback PDF converter (MIT licensed, commercial-safe).
 *
 * pymupdf4llm preserves markdown structure significantly better than pdfplumber:
 *   - Multi-column layouts are merged in reading order
 *   - Tables are output as markdown table syntax (| col | col |)
 *   - Headings and lists are preserved
 *   - Handles decorative D&D-style table formatting better than PDF-structure parsers
 *
 * Requires: pip install pymupdf4llm
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface PDFPlumberResult {
  markdown: string;
  metadata: {
    pages: number;
    processingTime: number;
    tables: number;
    converter: 'pymupdf4llm' | 'pdfplumber';
  };
}

export async function convertPdfWithPdfplumber(
  pdfPath: string
): Promise<PDFPlumberResult> {
  const startTime = Date.now();

  // Try pymupdf4llm first (better table and layout support)
  try {
    return await convertWithPymupdf4llm(pdfPath, startTime);
  } catch (pymupdfError: any) {
    console.warn(`[PDF Fallback] pymupdf4llm failed (${pymupdfError.message}), trying pdfplumber...`);
  }

  // Fall back to the original pdfplumber script
  return await convertWithPdfplumber(pdfPath, startTime);
}

async function convertWithPymupdf4llm(
  pdfPath: string,
  startTime: number
): Promise<PDFPlumberResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'pymupdf_extract.py');

  const { stdout } = await execAsync(
    `python "${scriptPath}" "${pdfPath}"`,
    { maxBuffer: 50 * 1024 * 1024, timeout: 120_000 }
  );

  const result = JSON.parse(stdout);
  if (!result.success) {
    throw new Error(result.error || 'pymupdf4llm extraction failed');
  }

  // pymupdf4llm outputs clean markdown — count approximate table count
  const tableCount = (result.markdown.match(/^\|/gm) ?? []).length;

  return {
    markdown: result.markdown,
    metadata: {
      pages: result.pages ?? 0,
      processingTime: (Date.now() - startTime) / 1000,
      tables: tableCount,
      converter: 'pymupdf4llm',
    },
  };
}

async function convertWithPdfplumber(
  pdfPath: string,
  startTime: number
): Promise<PDFPlumberResult> {
  const { mkdtempSync, rmSync } = await import('fs');
  const os = await import('os');
  const fs = await import('fs/promises');

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'quiverdm-pdf-'));
  const outputPath = path.join(tmpDir, 'output.md');

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdfplumber_extract.py');

    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${pdfPath}" --output "${outputPath}"`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 300_000 }
    );

    if (stderr) console.warn('[pdfplumber] Warnings:', stderr);

    const result = JSON.parse(stdout);
    if (!result.success) throw new Error(result.error || 'pdfplumber extraction failed');

    const markdown = await fs.readFile(outputPath, 'utf-8');

    return {
      markdown,
      metadata: {
        pages: result.pages ?? 0,
        processingTime: (Date.now() - startTime) / 1000,
        tables: result.tables ?? 0,
        converter: 'pdfplumber',
      },
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
