import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/server/db';
import { callGemini, callGeminiVision } from '@/lib/ai/gemini';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

const HOMEBREW_EXTRACTION_PROMPT = `You are a D&D 5e content extractor. Extract all D&D homebrew content from the provided material (which may be a photo of handwritten notes, a sketch, or typed text).

Return ONLY valid JSON with this structure:
{
  "items": [
    {
      "name": "string",
      "type": "item|spell|creature|location|faction|race|rule|adventure",
      "description": "full description preserving all important details",
      "properties": { "any relevant structured fields" }
    }
  ]
}

Rules:
- Extract ALL D&D content you can find
- If the material is handwritten or a sketch, do your best to read and interpret it
- Use type "item" for weapons/armor/wondrous items, "spell" for spells, "creature" for monsters/NPCs with stats, "location" for places, "faction" for groups/organizations, "race" for playable races, "rule" for house rules/mechanics, "adventure" for adventure hooks or scenarios
- If you cannot identify a clear type, use "item"
- If nothing D&D-related is found, return { "items": [] }`;

export interface ExtractedItem {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

function parseExtracted(text: string): ExtractedItem[] {
  const match = text.match(/```json\n?([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  try {
    const parsed = JSON.parse(match ? match[1] : text);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function extractFromText(text: string, userKey?: string, userId?: string): Promise<ExtractedItem[]> {
  const prompt = `${HOMEBREW_EXTRACTION_PROMPT}\n\nContent:\n${text.slice(0, 8000)}`;
  const raw = await callGemini(prompt, userKey, userId ? { userId, feature: 'extraction' } : undefined);
  return parseExtracted(raw);
}

async function extractFromImage(base64Data: string, mimeType: string, userKey?: string, userId?: string): Promise<ExtractedItem[]> {
  const raw = await callGeminiVision(HOMEBREW_EXTRACTION_PROMPT, [{ mimeType, base64Data }], userKey, userId ? { userId, feature: 'extraction' } : undefined);
  return parseExtracted(raw);
}

async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), 'upload.pdf');
  const res = await fetch(`${doclingUrl}/convert`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Docling error ${res.status}`);
  const json = await res.json();
  return json.markdown || json.text || '';
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;

    const userSettings = await prisma.userSettings.findUnique({ where: { userId }, select: { geminiApiKey: true } });
    let userGeminiKey: string | undefined;
    if (userSettings?.geminiApiKey) {
      try {
        const { decrypt } = await import('@/lib/encryption');
        userGeminiKey = decrypt(userSettings.geminiApiKey);
      } catch {}
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });

    const fileResults: Array<{ fileName: string; items: ExtractedItem[]; error?: string }> = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        fileResults.push({ fileName: file.name, items: [], error: 'File too large (max 10MB)' });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let items: ExtractedItem[];

        if (IMAGE_TYPES.includes(file.type)) {
          items = await extractFromImage(buffer.toString('base64'), file.type, userGeminiKey, userId);
        } else if (file.type === 'application/pdf') {
          const markdown = await pdfToMarkdown(buffer);
          items = await extractFromText(markdown, userGeminiKey, userId);
        } else {
          items = await extractFromText(buffer.toString('utf-8'), userGeminiKey, userId);
        }

        fileResults.push({ fileName: file.name, items });
      } catch (err: unknown) {
        fileResults.push({ fileName: file.name, items: [], error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({ fileResults });
  } catch {
    console.error('[homebrew-import/extract] error');
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
