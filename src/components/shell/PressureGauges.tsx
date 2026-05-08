'use client'

import { useHeaderStore } from '@/store/header-store'
import { trpc } from '@/lib/trpc'
import { PressureGauges as PressureGaugesDisplay } from '@/components/brain/pressure-gauges'

export function PressureGauges() {
  const { slot } = useHeaderStore()
  const campaignId = slot?.campaignId
  const isDM = slot?.isDM

  const { data } = trpc.brain.state.get.useQuery(
    { campaignId: campaignId ?? '' },
    { enabled: !!campaignId && !!isDM, staleTime: 30_000 },
  )

  if (!isDM || !data) return null

  return <PressureGaugesDisplay state={data} />
}
