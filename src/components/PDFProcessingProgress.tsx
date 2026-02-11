'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { usePDFProgress } from '@/hooks/usePDFProgress';
import { FileText, Download, Settings, FileSearch, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface PDFProcessingProgressProps {
  pdfId: string;
  filename?: string;
}

/**
 * Real-time PDF processing progress indicator
 * Connects to WebSocket server to display live updates
 */
export function PDFProcessingProgress({ pdfId, filename }: PDFProcessingProgressProps) {
  const { progress, status, details, isConnected, error } = usePDFProgress(pdfId);

  // Show toast on connection error (after retries exhausted)
  useEffect(() => {
    if (error && !isConnected) {
      toast.error('Connection lost', {
        description: 'Real-time updates unavailable. Your PDF is still processing. Refresh the page to check status.',
        duration: 10000, // Show for 10 seconds
      });
    }
  }, [error, isConnected]);

  // Map status codes to user-friendly labels and icons
  const statusConfig: Record<string, { label: string; icon: React.ElementType }> = {
    initializing: { label: 'Initializing', icon: Settings },
    downloading: { label: 'Downloading PDF', icon: Download },
    preprocessing: { label: 'Preprocessing', icon: Settings },
    marker_processing: { label: 'Converting to Markdown', icon: FileText },
    extracting: { label: 'Extracting Content', icon: FileSearch },
    completed: { label: 'Processing Complete', icon: CheckCircle },
    failed: { label: 'Processing Failed', icon: AlertCircle },
  };

  const currentStatus = statusConfig[status] || {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    icon: FileText,
  };

  const StatusIcon = currentStatus.icon;
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              {filename || 'Processing PDF'}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-muted-foreground" />
            ) : (
              <WifiOff className="h-3 w-3 text-muted-foreground" />
            )}
            <Badge variant={isComplete ? 'default' : isFailed ? 'destructive' : 'secondary'}>
              {isComplete ? '✓ Complete' : isFailed ? 'Failed' : 'Processing'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Connection Error</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Current Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {currentStatus.label}
          </span>
          <span className="text-muted-foreground">
            {progress}%
          </span>
        </div>

        {/* Progress Bar */}
        <Progress value={progress} className="h-2" />

        {/* Detailed Progress Info */}
        {details.currentPage !== undefined && details.totalPages !== undefined && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Page Progress</span>
              <span className="font-mono">
                {details.currentPage} / {details.totalPages}
              </span>
            </div>
            {details.stageProgress !== undefined && (
              <div className="flex items-center justify-between">
                <span>Stage Progress</span>
                <span className="font-mono">{details.stageProgress}%</span>
              </div>
            )}
          </div>
        )}

        {/* Stage Detail Message */}
        {details.detail && (
          <p className="text-xs text-muted-foreground italic">
            {details.detail}
          </p>
        )}

        {/* Items Found (if extraction is happening) */}
        {details.itemsFound && Object.keys(details.itemsFound).length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground mb-2">
              Content Discovered
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {details.itemsFound.spells !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">✨ Spells:</span>
                  <span className="font-mono font-medium">{details.itemsFound.spells}</span>
                </div>
              )}
              {details.itemsFound.items !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">⚔️ Items:</span>
                  <span className="font-mono font-medium">{details.itemsFound.items}</span>
                </div>
              )}
              {details.itemsFound.creatures !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">🐉 Creatures:</span>
                  <span className="font-mono font-medium">{details.itemsFound.creatures}</span>
                </div>
              )}
              {details.itemsFound.races !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">👤 Races:</span>
                  <span className="font-mono font-medium">{details.itemsFound.races}</span>
                </div>
              )}
              {details.itemsFound.classes !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">🎓 Classes:</span>
                  <span className="font-mono font-medium">{details.itemsFound.classes}</span>
                </div>
              )}
              {details.itemsFound.feats !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">⭐ Feats:</span>
                  <span className="font-mono font-medium">{details.itemsFound.feats}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Connection Status Footer */}
        {error && !isConnected ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 pt-2 border-t border-border">
            <WifiOff className="h-4 w-4" />
            <span>
              Connection lost. Your PDF is still processing.{' '}
              <button
                onClick={() => window.location.reload()}
                className="underline hover:text-amber-700 font-medium"
              >
                Refresh page
              </button>{' '}
              to check status.
            </span>
          </div>
        ) : !isConnected ? (
          <p className="text-xs text-muted-foreground text-center">
            Reconnecting to live updates...
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
