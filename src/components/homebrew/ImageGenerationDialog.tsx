'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface ImageGenerationDialogProps {
  homebrewId: string;
  itemType: string;
  itemName: string;
  itemDescription?: string;
  imagePromptHint?: string;
  open: boolean;
  onClose: () => void;
}

type GenState = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

export function ImageGenerationDialog({
  homebrewId,
  itemType,
  itemName,
  itemDescription,
  imagePromptHint,
  open,
  onClose,
}: ImageGenerationDialogProps) {
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [genState, setGenState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const quota = trpc.homebrewImage.getQuota.useQuery(undefined, {
    enabled: open,
  });

  const generate = trpc.homebrewImage.generateImage.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      setGenState('queued');
      setProgress(5);
    },
    onError: (err) => {
      toast.error(err.message);
      setGenState('idle');
    },
  });

  // Poll job status while generating
  const jobStatus = trpc.homebrewImage.getJobStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && genState !== 'idle' && genState !== 'completed' && genState !== 'failed',
      refetchInterval: 2000,
    }
  );

  useEffect(() => {
    if (!jobStatus.data) return;
    const { status, progress: p, resultUrl: url } = jobStatus.data;

    setProgress(p ?? 0);

    if (status === 'processing') setGenState('processing');
    if (status === 'completed' && url) {
      setGenState('completed');
      setResultUrl(url);
      setProgress(100);
      utils.homebrew.getContentById.invalidate({ id: homebrewId });
    }
    if (status === 'failed') {
      setGenState('failed');
      toast.error(jobStatus.data.errorMessage || 'Generation failed');
    }
  }, [jobStatus.data, homebrewId, utils]);

  const handleGenerate = () => {
    generate.mutate({
      homebrewId,
      prompt: customPrompt || undefined,
    });
  };

  const handleClose = () => {
    setJobId(null);
    setGenState('idle');
    setProgress(0);
    setResultUrl(null);
    setCustomPrompt('');
    setShowAdvanced(false);
    onClose();
  };

  const isGenerating = genState === 'queued' || genState === 'processing';
  const defaultPrompt = imagePromptHint
    ? `D&D 5e fantasy art, ${imagePromptHint}`
    : `D&D 5e fantasy art, ${itemType} named ${itemName}${
        itemDescription ? `, ${itemDescription.slice(0, 100)}` : ''
      }, high quality digital art`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Generate Image with AI
          </DialogTitle>
          <DialogDescription>
            Create a fantasy illustration for <strong>{itemName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quota display */}
          {quota.data && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              {quota.data.remaining} / {quota.data.limit} generations remaining this month
            </div>
          )}

          {/* Idle state */}
          {genState === 'idle' && (
            <>
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
                <p className="font-medium mb-1">Auto-generated prompt:</p>
                <p className="text-xs italic">{defaultPrompt}</p>
              </div>

              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? 'Hide' : 'Customize prompt'}
              </button>

              {showAdvanced && (
                <div className="space-y-2">
                  <Label className="text-sm">Custom prompt</Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={defaultPrompt}
                    rows={3}
                    maxLength={500}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">{customPrompt.length}/500</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={generate.isPending || !quota.data?.allowed} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" />
                  {quota.data?.allowed === false ? 'Limit reached' : 'Generate'}
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {/* Generating state */}
          {isGenerating && (
            <div className="space-y-4 text-center py-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-amber-500" />
              <div>
                <p className="font-medium">{genState === 'queued' ? 'Queued...' : 'Generating image...'}</p>
                <p className="text-xs text-muted-foreground mt-1">This may take 30-90 seconds</p>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Completed state */}
          {genState === 'completed' && resultUrl && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Image generated!</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Generated" className="w-full rounded-lg" />
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </div>
          )}

          {/* Failed state */}
          {genState === 'failed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">Generation failed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {jobStatus.data?.errorMessage || 'An error occurred. Please try again.'}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setGenState('idle');
                    setJobId(null);
                  }}
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
