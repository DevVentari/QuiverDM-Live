import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';

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

const HANDWRITTEN_NOTES_PROMPT = `You are a DM's notes transcriber and organiser. Your job is to extract everything useful from handwritten D&D notes — preserving the DM's original voice and capturing content that doesn't fit rigid stat-block schemas.

Step 1 — Transcribe: Read everything you can see. Mark uncertain words with [?]. Do not paraphrase or formalise.

Step 2 — Split into items: One item per distinct idea. A page with three NPC concepts becomes three items. A page with one long lore entry stays as one item.

Step 3 — Assign a type to each item:
- "creature" — monster or NPC with combat stats
- "item" — weapon, armor, or wondrous item
- "spell" — named spell with mechanics
- "location" — named place with description
- "faction" — group, organisation, or cult
- "race" — playable species or lineage
- "rule" — house rule or custom mechanic
- "adventure" — structured adventure hook or scenario outline
- "npc_concept" — NPC idea, personality sketch, or backstory fragment (no full stats)
- "plot_hook" — loose story idea, quest seed, or "what if" prompt
- "lore" — world-building, history, mythology, or setting detail
- "note" — anything else — reminders, lists, rough ideas, session notes

Return ONLY valid JSON:
{
  "items": [
    {
      "name": "string (infer a short title if none is written)",
      "type": "one of the types above",
      "description": "transcribed content — preserve original phrasing, mark unclear text with [?]",
      "properties": { "any structured fields if present, e.g. stats, abilities" }
    }
  ]
}

If the image is blank or completely illegible, return { "items": [] }.`;

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

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured on server');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function extractFromText(text: string): Promise<ExtractedItem[]> {
  const client = getAnthropicClient();
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: `${HOMEBREW_EXTRACTION_PROMPT}\n\nContent:\n${text.slice(0, 8000)}` }],
  });
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  return parseExtracted(raw);
}

async function extractFromImage(base64Data: string, mimeType: string, mode: 'homebrew' | 'notes' = 'homebrew'): Promise<ExtractedItem[]> {
  const client = getAnthropicClient();
  const prompt = mode === 'notes' ? HANDWRITTEN_NOTES_PROMPT : HOMEBREW_EXTRACTION_PROMPT;
  const mediaType = (mimeType === 'image/jpeg' ? 'image/jpeg' : mimeType === 'image/png' ? 'image/png' : mimeType === 'image/gif' ? 'image/gif' : 'image/webp') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: mode === 'notes' ? 8192 : 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        { type: 'text', text: prompt },
      ],
    }],
  });
  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  return parseExtracted(raw);
}

async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const formData = new FormData();
  formData.append('files', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), 'upload.pdf');
  formData.append('to_formats', 'md');
  const res = await fetch(`${doclingUrl}/v1/convert/file`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Docling error ${res.status}`);
  const result = await res.json();
  const item = Array.isArray(result) ? result[0] : result;
  return item?.document?.md_content ?? item?.output?.md_content ?? item?.md_content ?? item?.content ?? '';
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });

    const fileResults: Array<{ fileName: string; items: ExtractedItem[]; sourceType: string; error?: string }> = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        fileResults.push({ fileName: file.name, items: [], sourceType: 'media_import', error: 'File too large (max 10MB)' });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        let items: ExtractedItem[];
        let sourceType: string;

        if (IMAGE_TYPES.includes(file.type)) {
          items = await extractFromImage(buffer.toString('base64'), file.type, 'notes');
          sourceType = 'handwritten_scan';
        } else if (file.type === 'application/pdf') {
          const markdown = await pdfToMarkdown(buffer);
          items = await extractFromText(markdown);
          sourceType = 'pdf_extraction';
        } else {
          items = await extractFromText(buffer.toString('utf-8'));
          sourceType = 'media_import';
        }

        fileResults.push({ fileName: file.name, items, sourceType });
      } catch (err: unknown) {
        fileResults.push({ fileName: file.name, items: [], sourceType: 'media_import', error: err instanceof Error ? err.message : String(err) });
      }
    }

    return NextResponse.json({ fileResults });
  } catch {
    console.error('[homebrew-import/extract] error');
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
