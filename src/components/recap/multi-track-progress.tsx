'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, Mic } from 'lucide-react';

interface MultiTrackProgressProps {
  uploadGroupId: string;
  campaignId: string;
  onComplete: () => void;
}

export function MultiTrackProgress({
  uploadGroupId,
  campaignId,
  onComplete,
}: MultiTrackProgressProps) {
  const calledRef = useRef(false);

  const { data } = trpc.multiTrackUpload.getStatus.useQuery(
    { campaignId, uploadGroupId },
    {
      refetchInterval: (query) => {
        const status = (query.state.data as { overallStatus?: string } | undefined)?.overallStatus;
        return status === 'complete' || status === 'failed' ? false : 3000;
      },
    }
  );

  useEffect(() => {
    if (data?.overallStatus === 'complete' && !calledRef.current) {
      calledRef.current = true;
      onComplete();
    }
  }, [data?.overallStatus, onComplete]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing…
      </div>
    );
  }

  const progressPct =
    data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/40">
          <span>
            {data.overallStatus === 'complete'
              ? 'All tracks transcribed'
              : data.overallStatus === 'failed'
              ? 'Some tracks failed'
              : `Transcribing ${data.done} of ${data.total}…`}
          </span>
          <span>{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-1" />
      </div>

      <div className="space-y-1">
        {(data.recordings as Array<{ id: string; mergeStatus: string; speakerTag?: string | null }>).map((rec, i) => (
          <div
            key={rec.id}
            className="flex items-center gap-2 text-sm text-white/60"
          >
            {rec.mergeStatus === 'complete' ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : rec.mergeStatus === 'failed' ? (
              <XCircle className="h-4 w-4 text-red-400" />
            ) : rec.mergeStatus === 'processing' ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <Mic className="h-4 w-4 text-white/20" />
            )}
            <span className="flex-1 truncate">
              {rec.speakerTag ?? `Track ${i + 1}`}
            </span>
            <span className="text-xs text-white/30 capitalize">{rec.mergeStatus}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
