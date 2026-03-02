'use client';

import { useState, useRef, useContext } from 'react';
import html2canvas from 'html2canvas';
import { MessageSquare, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { getConsoleLogs, type CapturedLog } from './console-log-capture';
import { useCampaignOptional } from '@/components/campaign/campaign-context';

type ReportType = 'bug' | 'feature' | 'feedback';

const TYPE_LABELS: Record<ReportType, string> = {
  bug: 'Bug',
  feature: 'Feature',
  feedback: 'Feedback',
};

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('bug');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [logs, setLogs] = useState<CapturedLog[]>([]);
  const [logsVisible, setLogsVisible] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const campaign = useCampaignOptional();

  const createReport = trpc.feedback.createReport.useMutation({
    onSuccess: () => {
      setOpen(false);
      setDescription('');
      setScreenshot(null);
      setLogsVisible(false);
    },
  });

  async function captureScreen() {
    setCapturing(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.5,
        ignoreElements: (el) => el === dialogRef.current,
      });
      setScreenshot(canvas.toDataURL('image/png'));
    } catch (err) {
      console.warn('[feedback] html2canvas failed:', err);
    } finally {
      setCapturing(false);
    }
  }

  function handleOpen() {
    setLogs(getConsoleLogs());
    setOpen(true);
    setTimeout(captureScreen, 100);
  }

  function handleSubmit() {
    if (!description.trim() || description.trim().length < 10) return;
    createReport.mutate({
      type,
      description: description.trim(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      screenshotBase64: screenshot ?? '',
      consoleLogs: logs,
      ...(campaign && {
        campaignId: campaign.campaignId,
        campaignSlug: campaign.slug,
        campaignName: campaign.name,
      }),
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Report feedback"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Feedback
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={dialogRef} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report an issue</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 mt-4">
            {(Object.keys(TYPE_LABELS) as ReportType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  type === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Describe what happened or what you'd like..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[80px] resize-none text-sm mt-4"
          />

          <div className="space-y-1 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Screenshot</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={captureScreen}
                disabled={capturing}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${capturing ? 'animate-spin' : ''}`} />
                Retake
              </Button>
            </div>
            {screenshot ? (
              <img
                src={screenshot}
                alt="App screenshot"
                className="w-full rounded border border-border object-cover"
                style={{ maxHeight: 120 }}
              />
            ) : (
              <div className="flex h-20 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
                {capturing ? 'Capturing...' : 'No screenshot'}
              </div>
            )}
          </div>

          {logs.length > 0 && (
            <div className="space-y-1 mt-4">
              <button
                onClick={() => setLogsVisible((v) => !v)}
                className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span>Console logs ({logs.length} captured)</span>
                {logsVisible ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {logsVisible && (
                <div className="max-h-32 overflow-y-auto rounded bg-muted p-2 font-mono text-[10px] space-y-0.5">
                  {logs.map((l, i) => (
                    <div key={i} className={l.level === 'error' ? 'text-destructive' : 'text-yellow-500'}>
                      [{new Date(l.ts).toLocaleTimeString()}] {l.level.toUpperCase()}: {l.msg}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 mt-4">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={description.trim().length < 10 || createReport.isPending}
            >
              {createReport.isPending ? 'Sending...' : 'Submit'}
            </Button>
          </div>

          {createReport.isError && (
            <p className="text-xs text-destructive mt-2">
              Failed to submit. Please try again.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
