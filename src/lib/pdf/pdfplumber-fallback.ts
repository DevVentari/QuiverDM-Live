/**
 * pdfplumber Fallback for Marker PDF Conversion
 * MIT License - Commercial-safe
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface PDFPlumberResult {
  markdown: string;
  metadata: {
    pages: number;
    processingTime: number;
    tables: number;
    converter: 'pdfplumber';
  };
}

export async function convertPdfWithPdfplumber(
  pdfPath: string
): Promise<PDFPlumberResult> {
  const startTime = Date.now();
  const scriptPath = path.join(process.cwd(), 'scripts', 'pdfplumber_extract.py');
  const outputPath = path.join(
    process.cwd(),
    'temp',
    `${path.basename(pdfPath, '.pdf')}.md`
  );

  // Ensure temp directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  try {
    const { stdout, stderr } = await execAsync(
      `python "${scriptPath}" "${pdfPath}" --output "${outputPath}"`,
      { maxBuffer: 50 * 1024 * 1024, timeout: 300000 }
    );

    if (stderr) {
      console.warn('[pdfplumber] Warnings:', stderr);
    }

    const result = JSON.parse(stdout);

    if (!result.success) {
      throw new Error(result.error || 'pdfplumber extraction failed');
    }

    const markdown = await fs.readFile(outputPath, 'utf-8');

    // Clean up temp file
    await fs.unlink(outputPath).catch(() => {});

    return {
      markdown,
      metadata: {
        pages: result.pages || 0,
        processingTime: (Date.now() - startTime) / 1000,
        tables: result.tables || 0,
        converter: 'pdfplumber',
      },
    };
  } catch (error: any) {
    throw new Error(`pdfplumber fallback failed: ${error.message}`);
  }
}
