import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: 'File too large (max 25 MB)' }, { status: 400 });
  }

  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const buffer = Buffer.from(await file.arrayBuffer());
  const doclingForm = new FormData();
  doclingForm.append('files', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), file.name);
  doclingForm.append('to_formats', 'md');

  const res = await fetch(`${doclingUrl}/v1/convert/file`, {
    method: 'POST',
    body: doclingForm,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    return NextResponse.json({ error: `Docling error: ${errText}` }, { status: 502 });
  }

  const result = await res.json();
  const item = Array.isArray(result) ? result[0] : result;
  const markdown: string =
    item?.document?.md_content ??
    item?.output?.md_content ??
    item?.md_content ??
    item?.content ??
    '';

  if (!markdown.trim()) {
    return NextResponse.json({ error: 'PDF yielded no text content' }, { status: 422 });
  }

  return NextResponse.json({ markdown, filename: file.name });
}
