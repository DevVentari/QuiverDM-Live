'use client';

import { useEffect, useState } from 'react';
import { usePDFProgress } from '@/hooks/usePDFProgress';
import { getStageLabel } from '@/types/pdf-progress';
import { Flex, Text, Progress, Badge, Box } from '@radix-ui/themes';
import { Loader2, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';

interface PDFProgressIndicatorProps {
  pdfId: string;
  initialProgress?: number;
  initialStatus?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  compact?: boolean;
}

export function PDFProgressIndicator({
  pdfId,
  initialProgress = 0,
  initialStatus = 'processing',
  onComplete,
  onError,
  compact = false,
}: PDFProgressIndicatorProps) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [stageDetail, setStageDetail] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Only enable WebSocket if we're showing progress (not already completed/failed)
  const shouldConnect = initialStatus === 'processing' || initialStatus === 'pending';

  const {
    progress,
    isConnected,
    isConnecting,
    lastUpdate,
  } = usePDFProgress({
    pdfId,
    enabled: shouldConnect,
    onProgress: (newProgress) => {
      console.log(`[PDFProgress] Progress update: ${newProgress}%`);
    },
    onComplete: (result) => {
      console.log('[PDFProgress] Processing complete', result);
      setCurrentStatus('completed');
      onComplete?.();
    },
    onError: (error) => {
      console.error('[PDFProgress] Processing error:', error);
      setCurrentStatus('failed');
      onError?.(error);
    },
    onStatusChange: (status) => {
      console.log(`[PDFProgress] Status changed: ${status}`);
      setCurrentStatus(status);
    },
  });

  // Update stage details from lastUpdate
  useEffect(() => {
    if (lastUpdate?.data) {
      if (lastUpdate.data.detail) {
        setStageDetail(lastUpdate.data.detail);
      }
      if (lastUpdate.data.currentPage !== undefined) {
        setCurrentPage(lastUpdate.data.currentPage);
      }
      if (lastUpdate.data.totalPages !== undefined) {
        setTotalPages(lastUpdate.data.totalPages);
      }
    }
  }, [lastUpdate]);

  // Use initial progress if no WebSocket progress yet
  const displayProgress = progress || initialProgress;

  // Get human-readable stage label
  const stageLabel = getStageLabel(currentStatus);

  if (compact) {
    // Compact inline view for list items
    return (
      <Flex direction="column" gap="1" style={{ width: '100%' }}>
        <Flex justify="between" align="center">
          <Flex gap="1" align="center">
            {currentStatus === 'completed' ? (
              <CheckCircle size={14} className="text-green-500" />
            ) : currentStatus === 'failed' ? (
              <XCircle size={14} className="text-red-500" />
            ) : (
              <Loader2 size={14} className="animate-spin text-purple-500" />
            )}
            <Text size="1" color="gray">
              {stageLabel}
            </Text>
          </Flex>
          <Text size="1" weight="medium">
            {displayProgress}%
          </Text>
        </Flex>
        <Progress
          value={displayProgress}
          size="1"
          color={currentStatus === 'failed' ? 'red' : currentStatus === 'completed' ? 'green' : 'purple'}
        />
        {stageDetail && (
          <Text size="1" color="gray" style={{ fontSize: '10px' }}>
            {stageDetail}
            {totalPages > 0 && ` (${currentPage}/${totalPages})`}
          </Text>
        )}
      </Flex>
    );
  }

  // Full view with more details
  return (
    <Box
      style={{
        background: 'var(--gray-2)',
        borderRadius: 'var(--radius-3)',
        padding: 'var(--space-3)',
      }}
    >
      <Flex direction="column" gap="3">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex gap="2" align="center">
            {currentStatus === 'completed' ? (
              <CheckCircle size={18} className="text-green-500" />
            ) : currentStatus === 'failed' ? (
              <XCircle size={18} className="text-red-500" />
            ) : (
              <Loader2 size={18} className="animate-spin text-purple-500" />
            )}
            <Text size="3" weight="medium">
              {stageLabel}
            </Text>
          </Flex>

          <Flex gap="2" align="center">
            {/* Connection status indicator */}
            {isConnected ? (
              <Badge color="green" variant="soft" size="1">
                <Wifi size={10} />
                Live
              </Badge>
            ) : isConnecting ? (
              <Badge color="yellow" variant="soft" size="1">
                <Loader2 size={10} className="animate-spin" />
                Connecting
              </Badge>
            ) : (
              <Badge color="gray" variant="soft" size="1">
                <WifiOff size={10} />
                Offline
              </Badge>
            )}

            <Text size="3" weight="bold" color="purple">
              {displayProgress}%
            </Text>
          </Flex>
        </Flex>

        {/* Progress bar */}
        <Progress
          value={displayProgress}
          size="2"
          color={currentStatus === 'failed' ? 'red' : currentStatus === 'completed' ? 'green' : 'purple'}
        />

        {/* Stage details */}
        {stageDetail && (
          <Flex justify="between" align="center">
            <Text size="1" color="gray">
              {stageDetail}
            </Text>
            {totalPages > 0 && (
              <Text size="1" color="gray">
                Page {currentPage} of {totalPages}
              </Text>
            )}
          </Flex>
        )}

        {/* Processing stages breakdown */}
        <Flex gap="1" wrap="wrap">
          <StageBadge
            label="Download"
            active={displayProgress >= 0 && displayProgress < 20}
            completed={displayProgress >= 20}
          />
          <StageBadge
            label="Prepare"
            active={displayProgress >= 20 && displayProgress < 40}
            completed={displayProgress >= 40}
          />
          <StageBadge
            label="Convert"
            active={displayProgress >= 40 && displayProgress < 85}
            completed={displayProgress >= 85}
          />
          <StageBadge
            label="Extract"
            active={displayProgress >= 85 && displayProgress < 100}
            completed={displayProgress >= 100}
          />
        </Flex>
      </Flex>
    </Box>
  );
}

interface StageBadgeProps {
  label: string;
  active: boolean;
  completed: boolean;
}

function StageBadge({ label, active, completed }: StageBadgeProps) {
  return (
    <Badge
      size="1"
      variant={active ? 'solid' : completed ? 'soft' : 'outline'}
      color={completed ? 'green' : active ? 'purple' : 'gray'}
    >
      {completed && <CheckCircle size={10} />}
      {active && <Loader2 size={10} className="animate-spin" />}
      {label}
    </Badge>
  );
}
