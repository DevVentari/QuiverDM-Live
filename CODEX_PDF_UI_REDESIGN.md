# Codex Task: PDF Processing UI Redesign

## Objective
Transform the PDF processing UI from minimal/uninformative to polished, informative, and engaging.

## Current Problems (User Feedback)

1. **List Page**: Boring, minimal, no visual interest
2. **Detail Page**: Shows "0% Queued" with no context
3. **Processing**: No real-time updates, stages, or feedback
4. **Overall**: Slow, ugly, uninformative

## Target Experience

**Before:** "0% Queued" with empty void
**After:** Live progress with stages, logs, estimated time, beautiful animations

---

## Implementation Tasks

### Phase 1: Enhanced PDF List Page UI

**File:** `src/app/(app)/homebrew/pdfs/page.tsx`

**Current State:** Basic list with filename + status badge

**New Design:**
- **Card-based layout** with visual hierarchy
- **Status indicators** with icons and colors
- **Progress rings** for processing PDFs (show % complete)
- **Quick actions** (View, Re-process, Delete) on hover
- **Empty state** with upload prompt
- **Filtering** by status (all, pending, processing, completed, failed)
- **Sorting** options (newest, oldest, name, size)

**Key Components:**
```tsx
// Modern card with progress ring
<Card className="group hover:border-primary/50 transition-all">
  <CardHeader className="flex flex-row items-start gap-4">
    {/* Progress Ring (for processing) */}
    {isProcessing && (
      <div className="relative">
        <CircularProgress value={progress} size="lg" />
        <FileText className="absolute inset-0 m-auto h-6 w-6" />
      </div>
    )}

    {/* PDF Info */}
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold truncate">{filename}</h3>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{fileSize}</span>
        <span>•</span>
        <span>{uploadDate}</span>
      </div>
    </div>

    {/* Status Badge with Icon */}
    <Badge variant={statusVariant} className="gap-1.5">
      <StatusIcon className="h-3.5 w-3.5" />
      {status}
    </Badge>
  </CardHeader>

  {/* Processing Progress Bar (when active) */}
  {isProcessing && (
    <CardContent>
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {currentStage} • {estimatedTimeRemaining}
        </p>
      </div>
    </CardContent>
  )}

  {/* Quick Actions (on hover) */}
  <CardFooter className="opacity-0 group-hover:opacity-100 transition-opacity">
    <div className="flex gap-2 w-full">
      <Button size="sm" variant="outline" asChild>
        <Link href={`/homebrew/pdfs/${id}`}>View Details</Link>
      </Button>
      {status === 'failed' && (
        <Button size="sm" variant="outline" onClick={reprocess}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Re-process
        </Button>
      )}
    </div>
  </CardFooter>
</Card>
```

**Status Colors:**
- `pending`: amber/yellow with clock icon
- `processing`: blue with spinner icon (animated)
- `completed`: green with check icon
- `failed`: red with alert icon

---

### Phase 2: Live Processing Detail Page

**File:** `src/app/(app)/homebrew/pdfs/[pdfId]/page.tsx`

**Current State:** Shows "0% Queued" with no context

**New Design:**

#### A. Hero Section (Always Visible)
```tsx
<div className="relative overflow-hidden rounded-lg border bg-gradient-to-br from-background to-muted/20 p-6">
  {/* Background Pattern */}
  <div className="absolute inset-0 bg-grid-white/10" />

  <div className="relative z-10 flex items-start gap-6">
    {/* Large Progress Ring */}
    <div className="relative">
      <CircularProgress value={progress} size="xl" className="h-24 w-24" />
      <FileText className="absolute inset-0 m-auto h-10 w-10 text-primary" />
    </div>

    {/* PDF Info */}
    <div className="flex-1 min-w-0">
      <h1 className="text-2xl font-bold mb-2 truncate">{filename}</h1>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileIcon className="h-4 w-4" />
          {fileSize}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {uploadDate}
        </span>
        {estimatedTimeRemaining && (
          <span className="flex items-center gap-1.5 text-primary">
            <Timer className="h-4 w-4" />
            ~{estimatedTimeRemaining} remaining
          </span>
        )}
      </div>
    </div>

    {/* Status Badge */}
    <Badge variant={statusVariant} className="gap-2 px-4 py-2 text-sm">
      <StatusIcon className="h-4 w-4" />
      {status}
    </Badge>
  </div>

  {/* Overall Progress Bar */}
  {isProcessing && (
    <div className="mt-6 space-y-2">
      <Progress value={progress} className="h-3" />
      <p className="text-sm text-muted-foreground">
        {progress}% complete • {currentStage}
      </p>
    </div>
  )}
</div>
```

#### B. Processing Stages Timeline (When Processing)
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Activity className="h-5 w-5" />
      Processing Pipeline
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-start gap-4">
          {/* Stage Icon with Status */}
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2",
            stage.status === 'completed' && "border-green-500 bg-green-500/10",
            stage.status === 'processing' && "border-blue-500 bg-blue-500/10 animate-pulse",
            stage.status === 'pending' && "border-muted bg-muted/50",
            stage.status === 'failed' && "border-red-500 bg-red-500/10"
          )}>
            {stage.status === 'completed' && <Check className="h-5 w-5 text-green-500" />}
            {stage.status === 'processing' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            {stage.status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground" />}
            {stage.status === 'failed' && <X className="h-5 w-5 text-red-500" />}
          </div>

          {/* Stage Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{stage.name}</h4>
              {stage.duration && (
                <span className="text-xs text-muted-foreground">
                  {stage.duration}s
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {stage.description}
            </p>

            {/* Stage Progress Bar (if processing) */}
            {stage.status === 'processing' && stage.progress !== undefined && (
              <Progress value={stage.progress} className="h-1.5 mt-2" />
            )}
          </div>

          {/* Connector Line */}
          {index < stages.length - 1 && (
            <div className="absolute left-5 top-12 h-12 w-0.5 bg-border" />
          )}
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

**Processing Stages:**
1. **Queued** - "Waiting in processing queue"
2. **Downloading** - "Fetching PDF from storage"
3. **Converting** - "Converting PDF to markdown with Docling"
4. **Analyzing** - "Analyzing document structure"
5. **Extracting** - "Extracting D&D content with AI"
6. **Saving** - "Saving to database"
7. **Completed** - "Ready for review"

#### C. Live Activity Log (Collapsible)
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <Terminal className="h-5 w-5" />
        Activity Log
      </span>
      <Button variant="ghost" size="sm" onClick={toggleLog}>
        {logOpen ? <ChevronUp /> : <ChevronDown />}
      </Button>
    </CardTitle>
  </CardHeader>

  {logOpen && (
    <CardContent>
      <ScrollArea className="h-64">
        <div className="space-y-2 font-mono text-xs">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-muted-foreground shrink-0">
                {log.timestamp}
              </span>
              <span className={cn(
                log.level === 'error' && "text-red-500",
                log.level === 'success' && "text-green-500",
                log.level === 'info' && "text-blue-500"
              )}>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </CardContent>
  )}
</Card>
```

---

### Phase 3: Real-Time Progress Polling

**File:** `src/components/PDFProcessingProgress.tsx` (refactor existing component)

**Current State:** Basic component with minimal updates

**New Implementation:**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

interface ProcessingStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  duration?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export function PDFProcessingProgress({ pdfId, onComplete }: Props) {
  const [stages, setStages] = useState<ProcessingStage[]>([
    { id: 'queued', name: 'Queued', description: 'Waiting in processing queue', status: 'pending' },
    { id: 'downloading', name: 'Downloading', description: 'Fetching PDF from storage', status: 'pending' },
    { id: 'converting', name: 'Converting', description: 'Converting PDF to markdown', status: 'pending' },
    { id: 'analyzing', name: 'Analyzing', description: 'Analyzing document structure', status: 'pending' },
    { id: 'extracting', name: 'Extracting', description: 'Extracting D&D content with AI', status: 'pending' },
    { id: 'saving', name: 'Saving', description: 'Saving to database', status: 'pending' },
  ]);

  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; level: string }>>([]);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Queued');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);

  // Poll for job status every 2 seconds
  const { data: jobStatus } = trpc.homebrewPdf.getJobStatus.useQuery(
    { pdfId },
    {
      refetchInterval: 2000, // Poll every 2 seconds
      refetchIntervalInBackground: false,
    }
  );

  useEffect(() => {
    if (!jobStatus) return;

    // Update progress
    setProgress(jobStatus.progress || 0);

    // Update current stage from job metadata
    if (jobStatus.currentStep) {
      setCurrentStage(jobStatus.currentStep);
      updateStageStatus(jobStatus.currentStep, 'processing', jobStatus.currentSubStep);
    }

    // Update logs
    if (jobStatus.progressDetails?.logs) {
      setLogs(jobStatus.progressDetails.logs);
    }

    // Calculate estimated time remaining
    if (jobStatus.estimatedTimeRemaining) {
      const minutes = Math.floor(jobStatus.estimatedTimeRemaining / 60);
      const seconds = jobStatus.estimatedTimeRemaining % 60;
      setEstimatedTimeRemaining(
        minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      );
    }

    // Mark completed stages
    if (jobStatus.status === 'completed') {
      markAllStagesCompleted();
      onComplete?.();
    }

    // Handle failures
    if (jobStatus.status === 'failed') {
      markStageFailed(currentStage, jobStatus.errorMessage);
    }
  }, [jobStatus]);

  const updateStageStatus = (stageId: string, status: ProcessingStage['status'], substep?: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          status,
          description: substep || stage.description,
          startedAt: status === 'processing' && !stage.startedAt ? new Date() : stage.startedAt,
          completedAt: status === 'completed' ? new Date() : undefined,
        };
      }
      return stage;
    }));
  };

  const markAllStagesCompleted = () => {
    setStages(prev => prev.map(stage => ({ ...stage, status: 'completed' as const })));
  };

  const markStageFailed = (stageId: string, errorMessage?: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id === stageId) {
        return { ...stage, status: 'failed' as const, description: errorMessage || stage.description };
      }
      return stage;
    }));
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <ProcessingHero
        progress={progress}
        currentStage={currentStage}
        estimatedTimeRemaining={estimatedTimeRemaining}
      />

      {/* Stages Timeline */}
      <ProcessingStagesTimeline stages={stages} />

      {/* Activity Log */}
      <ProcessingActivityLog logs={logs} />
    </div>
  );
}
```

---

### Phase 4: Backend Progress Updates

**File:** `src/lib/queue/pdf-worker.ts` (update existing worker)

**Add Detailed Progress Reporting:**

```typescript
// Update job progress with detailed info
await job.updateProgress({
  progress: 25,
  currentStep: 'converting',
  currentSubStep: 'Extracting images from PDF',
  estimatedTimeRemaining: 120, // seconds
  logs: [
    { timestamp: new Date().toISOString(), message: 'Starting PDF conversion', level: 'info' },
    { timestamp: new Date().toISOString(), message: 'Extracted 5 images', level: 'success' },
  ],
});
```

**Map Worker Steps to UI Stages:**
- `extracting_audio` → "Downloading"
- `splitting_chunks` → "Converting"
- `transcribing` → "Analyzing"
- `submitting_to_assemblyai` → "Extracting"
- `uploading_audio` → "Saving"

---

### Phase 5: Visual Polish

**Add Animations:**
- Pulse effect on active stage
- Smooth progress transitions
- Fade in/out for status changes
- Skeleton loaders during initial load

**Add Components:**
- CircularProgress ring component
- Enhanced Badge with icons
- Timeline connector lines
- Smooth scroll areas for logs

**Color System:**
- `pending`: text-muted-foreground, border-muted
- `processing`: text-blue-500, border-blue-500, animate-pulse
- `completed`: text-green-500, border-green-500
- `failed`: text-red-500, border-red-500

---

## Testing Checklist

After implementation:

1. ✅ Upload a PDF → see it appear with "pending" status
2. ✅ Click into detail page → see live processing stages
3. ✅ Watch progress update in real-time (every 2s)
4. ✅ See estimated time remaining update
5. ✅ View activity logs scrolling
6. ✅ See each stage transition: pending → processing → completed
7. ✅ Test failed state → shows error message and retry button
8. ✅ Test completed state → shows extracted content
9. ✅ Verify animations are smooth
10. ✅ Test on mobile (responsive design)

---

## Success Criteria

**Before:**
- 😞 Shows "0% Queued" with no context
- 😞 No idea what's happening or how long it will take
- 😞 Boring, minimal UI

**After:**
- ✅ Live progress with 6 detailed stages
- ✅ Real-time activity logs
- ✅ Estimated time remaining
- ✅ Beautiful, polished UI with animations
- ✅ Clear visual feedback at every step
- ✅ Users know exactly what's happening

---

## Implementation Notes

- Use existing tRPC routers/services (don't change backend logic)
- Poll `getJobStatus` every 2 seconds for real-time updates
- Use shadcn/ui components for consistency
- Follow existing patterns in the codebase
- Keep animations subtle and performant
- Ensure mobile responsiveness
- Add proper loading states and error boundaries
