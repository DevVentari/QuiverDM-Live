'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CircularProgress } from '@/components/ui/circular-progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Terminal,
  Timer,
  TriangleAlert,
  X,
} from 'lucide-react';

interface PDFProcessingProgressProps {
  pdfId: string;
  filename?: string;
  onComplete?: () => void;
}

type StageId = 'queued' | 'downloading' | 'converting' | 'analyzing' | 'extracting' | 'saving' | 'completed';
type StageStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error';
}

const STAGES: Array<{ id: StageId; name: string; description: string }> = [
  { id: 'queued', name: 'Queued', description: 'Waiting in processing queue' },
  { id: 'downloading', name: 'Downloading', description: 'Fetching PDF from storage' },
  { id: 'converting', name: 'Converting', description: 'Converting PDF to markdown with Docling' },
  { id: 'analyzing', name: 'Analyzing', description: 'Analyzing document structure' },
  { id: 'extracting', name: 'Extracting', description: 'Extracting D&D content with AI' },
  { id: 'saving', name: 'Saving', description: 'Saving to database' },
  { id: 'completed', name: 'Completed', description: 'Ready for review' },
];

function normalizeStage(step: string | null | undefined, progress: number): StageId {
  if (!step) {
    if (progress >= 100) return 'completed';
    if (progress >= 90) return 'saving';
    if (progress >= 75) return 'extracting';
    if (progress >= 55) return 'analyzing';
    if (progress >= 30) return 'converting';
    if (progress >= 10) return 'downloading';
    return 'queued';
  }

  const key = step.toLowerCase();

  if (key.includes('completed') || key === 'done') return 'completed';
  if (key.includes('saving') || key.includes('uploading_audio')) return 'saving';
  if (key.includes('extract') || key.includes('submitting_to_assemblyai')) return 'extracting';
  if (key.includes('analy') || key.includes('transcribing') || key.includes('waiting_for_assemblyai')) return 'analyzing';
  if (key.includes('convert') || key.includes('preprocess') || key.includes('pdf_conversion') || key.includes('splitting_chunks') || key.includes('fallback')) return 'converting';
  if (key.includes('download') || key.includes('extracting_audio')) return 'downloading';
  if (key.includes('queue') || key.includes('pending') || key.includes('waiting')) return 'queued';
  return 'queued';
}

function formatEta(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function formatLogTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStageStatuses(currentStage: StageId, terminalStatus: 'completed' | 'failed' | null): Record<StageId, StageStatus> {
  const currentIndex = STAGES.findIndex((stage) => stage.id === currentStage);
  const statuses = {} as Record<StageId, StageStatus>;

  STAGES.forEach((stage, index) => {
    if (terminalStatus === 'completed') {
      statuses[stage.id] = 'completed';
      return;
    }

    if (terminalStatus === 'failed') {
      if (index < currentIndex) statuses[stage.id] = 'completed';
      else if (index === currentIndex) statuses[stage.id] = 'failed';
      else statuses[stage.id] = 'pending';
      return;
    }

    if (index < currentIndex) statuses[stage.id] = 'completed';
    else if (index === currentIndex) statuses[stage.id] = 'processing';
    else statuses[stage.id] = 'pending';
  });

  return statuses;
}

function getStatusBadgeClass(status: string) {
  if (status === 'completed') return 'border-green-500/40 bg-green-500/10 text-green-700';
  if (status === 'failed') return 'border-red-500/40 bg-red-500/10 text-red-700';
  if (status === 'processing') return 'border-blue-500/40 bg-blue-500/10 text-blue-700';
  return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
}

export function PDFProcessingProgress({ pdfId, filename, onComplete }: PDFProcessingProgressProps) {
  const completedCalledRef = useRef(false);
  const [logOpen, setLogOpen] = useState(true);
  const [stageTiming, setStageTiming] = useState<Record<StageId, { startedAt?: number; completedAt?: number }>>({} as Record<StageId, { startedAt?: number; completedAt?: number }>);

  const statusQuery = trpc.homebrewPdf.getJobStatus.useQuery(
    { pdfId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as any;
        if (!data) return 2000;
        const dbStatus = data.pdf?.processingStatus;
        if (dbStatus === 'completed' || dbStatus === 'failed') return false;
        return 2000;
      },
      refetchOnWindowFocus: true,
    }
  );

  const payload = statusQuery.data as any;
  const pdf = payload?.pdf;
  const job = payload?.job;

  const processingStatus = pdf?.processingStatus || 'pending';
  const isTerminal = processingStatus === 'completed' || processingStatus === 'failed';
  const progress = typeof job?.progress === 'number'
    ? Math.max(0, Math.min(100, job.progress))
    : processingStatus === 'completed'
      ? 100
      : 0;

  const currentStageId = normalizeStage(job?.currentStep, progress);
  const terminalStatus = processingStatus === 'completed' ? 'completed' : processingStatus === 'failed' ? 'failed' : null;
  const stageStatuses = useMemo(
    () => getStageStatuses(currentStageId, terminalStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStageId, terminalStatus]
  );

  const logs: LogEntry[] = Array.isArray(job?.logs)
    ? job.logs.filter((entry: any) => entry && typeof entry.message === 'string' && typeof entry.timestamp === 'string')
    : [];

  const estimatedTimeRemaining = formatEta(
    typeof job?.estimatedTimeRemaining === 'number' ? job.estimatedTimeRemaining : null
  );

  const currentStage = STAGES.find((stage) => stage.id === currentStageId) || STAGES[0];

  useEffect(() => {
    if (!onComplete || completedCalledRef.current) return;
    if (isTerminal) {
      completedCalledRef.current = true;
      onComplete();
    }
  }, [isTerminal, onComplete]);

  useEffect(() => {
    setStageTiming((prev) => {
      const now = Date.now();
      let changed = false;
      const next = { ...prev };
      for (const stage of STAGES) {
        const status = stageStatuses[stage.id];
        const prior = next[stage.id] || {};
        if (status === 'processing' && !prior.startedAt) {
          next[stage.id] = { ...prior, startedAt: now };
          changed = true;
        }
        if ((status === 'completed' || status === 'failed') && prior.startedAt && !prior.completedAt) {
          next[stage.id] = { ...prior, completedAt: now };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [stageStatuses]);

  const stagedRows = useMemo(() => {
    const currentIndex = STAGES.findIndex((stage) => stage.id === currentStageId);

    return STAGES.map((stage, index) => {
      const timing = stageTiming[stage.id];
      const duration = timing?.startedAt && timing?.completedAt
        ? Math.max(1, Math.round((timing.completedAt - timing.startedAt) / 1000))
        : null;

      let stageProgress: number | null = null;
      if (stage.id === currentStageId && stageStatuses[stage.id] === 'processing') {
        const rangeStart = (index / (STAGES.length - 1)) * 100;
        const rangeEnd = ((index + 1) / (STAGES.length - 1)) * 100;
        const normalized = ((progress - rangeStart) / Math.max(1, rangeEnd - rangeStart)) * 100;
        stageProgress = Math.max(8, Math.min(100, Math.round(normalized)));
      }

      return {
        ...stage,
        status: stageStatuses[stage.id],
        duration,
        stageProgress,
        isLast: index === STAGES.length - 1,
        isCurrent: index === currentIndex,
      };
    });
  }, [currentStageId, progress, stageStatuses, stageTiming]);

  const heroFilename = pdf?.filename || filename || 'Processing PDF';

  if (statusQuery.isLoading && !pdf) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-muted/30 p-4 sm:p-6">
        <div className="pdf-grid-bg absolute inset-0 opacity-40" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <CircularProgress value={progress} size={104} strokeWidth={8} className="mx-auto shrink-0 sm:mx-0">
            <div className="flex flex-col items-center">
              <FileText className="h-7 w-7 text-primary" />
              <span className="mt-1 text-xs font-semibold">{progress}%</span>
            </div>
          </CircularProgress>

          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="truncate text-xl font-bold sm:text-2xl">{heroFilename}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                {currentStage.name}
              </span>
              {estimatedTimeRemaining ? (
                <span className="inline-flex items-center gap-1.5 text-primary">
                  <Timer className="h-4 w-4" />
                  ~{estimatedTimeRemaining} remaining
                </span>
              ) : null}
              {pdf?.createdAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {new Date(pdf.createdAt).toLocaleString()}
                </span>
              ) : null}
            </div>
            <div className="space-y-2 pt-1">
              <Progress
                value={progress}
                className="h-2.5"
                indicatorClassName={cn(
                  'transition-all duration-700',
                  processingStatus === 'processing' ? 'bg-blue-500' : processingStatus === 'completed' ? 'bg-green-600' : processingStatus === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                )}
              />
              <p className="text-sm text-muted-foreground">
                {progress}% complete • {job?.currentSubStep || currentStage.description}
              </p>
            </div>
          </div>

          <Badge variant="outline" className={cn('gap-2 px-3 py-1.5 text-sm capitalize', getStatusBadgeClass(processingStatus))}>
            {processingStatus === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
            {processingStatus === 'completed' && <Check className="h-4 w-4" />}
            {processingStatus === 'failed' && <TriangleAlert className="h-4 w-4" />}
            {(processingStatus === 'pending' || processingStatus === 'queued') && <Clock className="h-4 w-4" />}
            {processingStatus}
          </Badge>
        </div>

        {processingStatus === 'failed' && pdf?.errorMessage ? (
          <div className="relative z-10 mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
            {pdf.errorMessage}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="h-5 w-5" />
            Processing Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stagedRows.map((stage) => (
              <div key={stage.id} className="relative flex items-start gap-4">
                <div className={cn(
                  'relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  stage.status === 'completed' && 'border-green-500 bg-green-500/10 text-green-600',
                  stage.status === 'processing' && 'border-blue-500 bg-blue-500/10 text-blue-600 animate-pulse',
                  stage.status === 'pending' && 'border-muted bg-muted/40 text-muted-foreground',
                  stage.status === 'failed' && 'border-red-500 bg-red-500/10 text-red-600'
                )}>
                  {stage.status === 'completed' ? <Check className="h-5 w-5" /> : null}
                  {stage.status === 'processing' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {stage.status === 'pending' ? <Clock className="h-5 w-5" /> : null}
                  {stage.status === 'failed' ? <X className="h-5 w-5" /> : null}
                </div>

                {!stage.isLast ? (
                  <div className={cn('absolute left-[1.2rem] top-10 h-9 w-px bg-border', stage.status === 'completed' && 'bg-green-500/40')} />
                ) : null}

                <div className="min-w-0 flex-1 pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-medium sm:text-base">{stage.name}</h4>
                    {stage.duration ? <span className="text-xs text-muted-foreground">{stage.duration}s</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stage.isCurrent && job?.currentSubStep ? job.currentSubStep : stage.description}
                  </p>
                  {stage.status === 'processing' && stage.stageProgress !== null ? (
                    <Progress value={stage.stageProgress} className="mt-2 h-1.5" indicatorClassName="bg-blue-500" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <span className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Activity Log
            </span>
            <Button variant="ghost" size="sm" onClick={() => setLogOpen((prev) => !prev)}>
              {logOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        {logOpen ? (
          <CardContent>
            <ScrollArea className="h-64 rounded-md border bg-muted/20 p-3">
              {logs.length > 0 ? (
                <div className="space-y-2 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className="flex gap-3">
                      <span className="shrink-0 text-muted-foreground">{formatLogTime(log.timestamp)}</span>
                      <span className={cn(
                        log.level === 'error' && 'text-red-600',
                        log.level === 'success' && 'text-green-700',
                        log.level === 'info' && 'text-blue-700'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Waiting for processing activity...</p>
              )}
            </ScrollArea>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

