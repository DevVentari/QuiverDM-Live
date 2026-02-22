'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Download, ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ImageGalleryProps {
  entityType: 'homebrew' | 'npc';
  entityId: string;
  currentImageUrl?: string | null;
  currentJobId?: string | null;
  canGenerate: boolean;
  entityName: string;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ImageGallery({
  entityType,
  entityId,
  currentImageUrl,
  currentJobId,
  canGenerate,
  entityName,
  onImageUpdate,
}: ImageGalleryProps) {
  const [activeJobId, setActiveJobId] = useState<string | null>(currentJobId ?? null);
  const [latestImageUrl, setLatestImageUrl] = useState<string | null>(currentImageUrl ?? null);
  const utils = trpc.useUtils();

  useEffect(() => {
    setActiveJobId(currentJobId ?? null);
  }, [currentJobId]);

  useEffect(() => {
    if (currentImageUrl) {
      setLatestImageUrl(currentImageUrl);
    }
  }, [currentImageUrl]);

  const jobStatus = trpc.homebrewImage.getJobStatus.useQuery(
    { jobId: activeJobId ?? '' },
    {
      enabled: !!activeJobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        return data.status === 'queued' || data.status === 'processing' ? 2000 : false;
      },
    }
  );

  const generateHomebrew = trpc.homebrewImage.generateImage.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const generateNpc = trpc.homebrewImage.generateForNpc.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const displayImageUrl = jobStatus.data?.resultUrl ?? latestImageUrl;
  const isGenerating = jobStatus.data?.status === 'queued' || jobStatus.data?.status === 'processing';

  useEffect(() => {
    if (jobStatus.data?.status === 'completed' && jobStatus.data.resultUrl) {
      setLatestImageUrl(jobStatus.data.resultUrl);
      onImageUpdate?.(jobStatus.data.resultUrl);

      if (entityType === 'homebrew') {
        void utils.homebrew.getContentById.invalidate({ id: entityId });
      } else {
        void utils.npcs.getById.invalidate({ id: entityId });
      }
    }
  }, [entityId, entityType, jobStatus.data, onImageUpdate, utils]);

  const isMutating = generateHomebrew.isPending || generateNpc.isPending;

  const generate = () => {
    if (entityType === 'homebrew') {
      generateHomebrew.mutate(
        { homebrewId: entityId },
        {
          onSuccess: (result) => {
            setActiveJobId(result.jobId);
          },
        }
      );
      return;
    }

    generateNpc.mutate(
      { npcId: entityId },
      {
        onSuccess: (result) => {
          setActiveJobId(result.jobId);
        },
      }
    );
  };

  const isBusy = isGenerating || isMutating;
  const buttonLabel = useMemo(() => {
    if (isBusy) return 'Generating Image...';
    return displayImageUrl ? 'Regenerate Image' : 'Generate Image';
  }, [displayImageUrl, isBusy]);

  return (
    <div className="space-y-3">
      {displayImageUrl ? (
        <div className="relative group rounded-lg overflow-hidden border">
          <Image
            src={displayImageUrl}
            alt={entityName}
            width={1024}
            height={1024}
            className="w-full object-cover max-h-80"
            unoptimized
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <a href={displayImageUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary">
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </a>
            {canGenerate && (
              <Button size="sm" variant="secondary" onClick={generate} disabled={isBusy}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-48 rounded-lg border border-dashed flex items-center justify-center bg-muted/30">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Generating image...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm">No image yet</p>
            </div>
          )}
        </div>
      )}

      {canGenerate && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={isBusy}
          onClick={generate}
        >
          {isBusy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}
