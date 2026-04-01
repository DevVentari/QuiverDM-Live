import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF file required' }, { status: 400 });
  }

  const doclingUrl = process.env.DOCLING_URL || 'http://localhost:5001';
  const body = new FormData();
  const buffer = Buffer.from(await file.arrayBuffer());
  body.append('files', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), 'upload.pdf');
  body.append('to_formats', 'md');

  const res = await fetch(`${doclingUrl}/v1/convert/file`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) return NextResponse.json({ error: `Docling error ${res.status}` }, { status: 502 });

  const result = await res.json();
  const item = Array.isArray(result) ? result[0] : result;
  const markdown: string =
    item?.document?.md_content ?? item?.output?.md_content ?? item?.md_content ?? item?.content ?? '';

  return NextResponse.json({ markdown });
}
