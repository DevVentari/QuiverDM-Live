import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { verifyFoundryRequest } from '@/lib/foundry-auth'

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

  return NextResponse.json({ jobs })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { jobId, campaignId, status, error } = body ?? {}
  if (!jobId || !campaignId) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await prisma.foundryImportJob.update({
    where: { id: jobId },
    data: {
      status: status ?? 'delivered',
      deliveredAt: status !== 'error' ? new Date() : null,
      error: error ?? null,
    },
  })

  return NextResponse.json({ ok: true })
}
