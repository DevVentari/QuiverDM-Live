import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { verifyFoundryRequest } from '@/lib/foundry-auth'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Quiver-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

const PatchSchema = z.object({
  jobId: z.string().cuid(),
  campaignId: z.string().cuid(),
  status: z.enum(['delivered', 'error']),
  error: z.string().max(2000).optional(),
})

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get('campaignId')
  if (!campaignId) return NextResponse.json({ error: 'missing_campaign' }, { status: 400 })

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const jobs = await prisma.foundryImportJob.findMany({
    where: { campaignId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { id: true, type: true, payload: true, sourceName: true },
  })

  return NextResponse.json({ jobs }, { headers: CORS })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })

  const ok = await verifyFoundryRequest(req, parsed.data.campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await prisma.foundryImportJob.update({
    where: { id: parsed.data.jobId, campaignId: parsed.data.campaignId },
    data: {
      status: parsed.data.status,
      deliveredAt: parsed.data.status !== 'error' ? new Date() : null,
      error: parsed.data.error ?? null,
    },
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}
