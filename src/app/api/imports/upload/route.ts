import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { storage } from '@/lib/storage'
import { IMPORT_SOURCES } from '@/lib/import-adapters/types'

const ALLOWED_TYPES: Record<string, string> = {
  'application/zip': 'obsidian',
  'application/x-zip-compressed': 'obsidian',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/markdown': 'markdown_file',
  'text/plain': 'markdown_file',
  'application/xml': 'world_anvil',
  'text/xml': 'world_anvil',
}

const MAX_SIZE = 100 * 1024 * 1024

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const sourceHint = formData.get('source') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })

  if (sourceHint && !IMPORT_SOURCES.includes(sourceHint as any)) {
    return NextResponse.json({ error: `Invalid source: ${sourceHint}` }, { status: 400 })
  }

  if ((file.type === 'application/json') && !sourceHint) {
    return NextResponse.json({ error: 'JSON files require an explicit source hint (campfire or kanka)' }, { status: 400 })
  }

  const detectedSource = ALLOWED_TYPES[file.type]
  if (!detectedSource && !sourceHint) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const fileKey = `imports/${session.user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await storage.upload(fileKey, buffer, file.type)

  return NextResponse.json({
    fileKey,
    source: sourceHint ?? detectedSource,
    originalName: file.name,
  })
}
