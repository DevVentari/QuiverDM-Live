'use client'

import { useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { Progress } from '@/components/ui/progress'

export function ProgressView({
  jobId,
  onComplete,
}: {
  jobId: string
  onComplete: () => void
}) {
  const { data } = trpc.importHub.getJobStatus.useQuery(
    { jobId },
    { refetchInterval: 2000 }
  )

  useEffect(() => {
    if (data?.status === 'complete' || data?.status === 'failed') {
      onComplete()
    }
  }, [data?.status, onComplete])

  const pct = data?.total ? Math.round((data.progress / data.total) * 100) : 0

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {data?.status === 'failed'
          ? `Import failed: ${data.error ?? 'Unknown error'}`
          : data?.status === 'complete'
          ? 'Import complete!'
          : `Importing… ${data?.progress ?? 0} / ${data?.total ?? '?'} items`}
      </p>
      <Progress value={pct} />
      {data?.status === 'complete' && (
        <p className="text-xs text-muted-foreground">
          Items saved. Check your{' '}
          <a href="/homebrew" className="underline">homebrew library</a>.
        </p>
      )}
    </div>
  )
}
