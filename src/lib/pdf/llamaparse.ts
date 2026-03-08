import fs from 'fs';
import path from 'path';

const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_CLOUD_BASE_URL = 'https://api.cloud.llamaindex.ai/v1';

export interface LlamaParseResult {
  markdown: string;
  metadata: {
    pages: number;
    processingTimeMs: number;
    provider: 'llamaparse';
    jobId: string;
  };
}

export function isLlamaParseConfigured(): boolean {
  return !!LLAMA_CLOUD_API_KEY;
}

export async function convertWithLlamaParse(
  pdfPath: string,
  onProgress?: (percent: number) => void,
): Promise<LlamaParseResult> {
  if (!LLAMA_CLOUD_API_KEY) {
    throw new Error('LLAMA_CLOUD_API_KEY is not configured');
  }

  const startTime = Date.now();
  onProgress?.(10);

  const fileBuffer = await fs.promises.readFile(pdfPath);
  const filename = path.basename(pdfPath);

  // Step 1: Upload file
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename);
  formData.append('language', 'en');
  formData.append('parsing_instruction', 'This is a D&D/TTRPG document. Preserve all stat blocks, tables, spell descriptions, and monster entries exactly. Keep formatting for headers, lists, and tables.');
  formData.append('result_type', 'markdown');

  onProgress?.(15);

  const uploadRes = await fetch(`${LLAMA_CLOUD_BASE_URL}/parsing/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
    },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => 'Unknown error');
    throw new Error(`LlamaParse upload failed (${uploadRes.status}): ${errorText}`);
  }

  const uploadResult = await uploadRes.json() as { id: string; status: string };
  const jobId = uploadResult.id;
  if (!jobId) throw new Error('LlamaParse upload returned no job ID');

  console.log(`[LlamaParse] Job submitted: ${jobId}`);
  onProgress?.(25);

  // Step 2: Poll until complete
  const MAX_WAIT_MS = 540_000; // 9 minutes
  const POLL_INTERVAL_MS = 3_000;
  const pollStart = Date.now();

  while (Date.now() - pollStart < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${LLAMA_CLOUD_BASE_URL}/parsing/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!statusRes.ok) continue;

    const status = await statusRes.json() as { status: string; num_pages?: number };
    const jobStatus = status.status?.toLowerCase();

    const elapsed = Date.now() - pollStart;
    const estimatedPct = 25 + Math.min(53, Math.floor((elapsed / MAX_WAIT_MS) * 53));
    onProgress?.(estimatedPct);

    if (jobStatus === 'success') {
      console.log(`[LlamaParse] Job ${jobId} completed`);
      break;
    }

    if (jobStatus === 'error' || jobStatus === 'failed') {
      throw new Error(`LlamaParse job failed (status: ${jobStatus})`);
    }
  }

  onProgress?.(80);

  // Step 3: Get markdown result
  const resultRes = await fetch(`${LLAMA_CLOUD_BASE_URL}/parsing/job/${jobId}/result/markdown`, {
    headers: { 'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });

  if (!resultRes.ok) {
    const errorText = await resultRes.text().catch(() => 'Unknown error');
    throw new Error(`LlamaParse result fetch failed (${resultRes.status}): ${errorText}`);
  }

  const resultData = await resultRes.json() as { markdown: string; pages?: number };
  const markdown = resultData.markdown;

  if (!markdown || markdown.trim().length === 0) {
    throw new Error('LlamaParse returned empty markdown');
  }

  onProgress?.(100);

  return {
    markdown,
    metadata: {
      pages: resultData.pages ?? 0,
      processingTimeMs: Date.now() - startTime,
      provider: 'llamaparse',
      jobId,
    },
  };
}
