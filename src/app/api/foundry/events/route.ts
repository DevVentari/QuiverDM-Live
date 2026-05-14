import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { verifyFoundryRequest } from '@/lib/foundry-auth'
import { z } from 'zod'

const BodySchema = z.object({
  campaignId: z.string().cuid(),
  sessionId: z.string().cuid(),
  type: z.string(),
  payload: z.record(z.unknown()),
  foundryTimestamp: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { campaignId, sessionId, type, payload, foundryTimestamp } = parsed.data

  const ok = await verifyFoundryRequest(req, campaignId)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  await prisma.foundryEvent.create({
    data: {
      campaignId,
      sessionId,
      type,
      payload: payload as Prisma.InputJsonValue,
      foundryTimestamp: foundryTimestamp ? new Date(foundryTimestamp) : null,
    },
  })

  return NextResponse.json({ ok: true })
}
