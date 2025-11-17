'use client';

import { Box, Card, Flex, Progress, Text, Badge } from '@radix-ui/themes';
import { useTranscriptionProgress } from '@/hooks/useTranscriptionProgress';
import { Loader2, CheckCircle2, XCircle, WifiOff } from 'lucide-react';

interface TranscriptionProgressProps {
  jobId: string;
  wsUrl?: string;
}

/**
 * Real-time transcription progress display component
 * Shows detailed progress updates via WebSocket connection
 */
export function TranscriptionProgress({ jobId, wsUrl }: TranscriptionProgressProps) {
  const { progress, isConnected, error } = useTranscriptionProgress({
    jobId,
    wsUrl,
  });

  // Don't render anything if job doesn't exist or is completed/failed
  if (!progress) {
    return null;
  }

  // Don't show UI for completed or failed jobs
  if (progress.status === 'completed' || progress.status === 'failed') {
    return null;
  }

  const { status, currentStep, currentSubStep, progress: percentage, estimatedTimeRemaining } = progress;

  // Format ETA
  const formatETA = (seconds?: number) => {
    if (!seconds || seconds <= 0) return null;

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${secs}s remaining`;
    }
    return `${secs}s remaining`;
  };

  // Get status color and icon
  const getStatusInfo = () => {
    switch (status) {
      case 'completed':
        return {
          color: 'green' as const,
          icon: <CheckCircle2 size={20} />,
          label: 'Completed',
        };
      case 'failed':
        return {
          color: 'red' as const,
          icon: <XCircle size={20} />,
          label: 'Failed',
        };
      case 'processing':
        return {
          color: 'blue' as const,
          icon: <Loader2 className="animate-spin" size={20} />,
          label: 'Processing',
        };
      default:
        return {
          color: 'gray' as const,
          icon: <Loader2 size={20} />,
          label: 'Queued',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Card>
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          <Flex align="center" gap="2">
            {statusInfo.icon}
            <Text size="3" weight="bold">
              Transcription Progress
            </Text>
          </Flex>

          <Flex gap="2" align="center">
            <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
            {!isConnected && (
              <Badge color="orange" variant="soft">
                <WifiOff size={12} />
                <Text ml="1">Disconnected</Text>
              </Badge>
            )}
          </Flex>
        </Flex>

        {/* Progress Bar */}
        {status === 'processing' && (
          <Box>
            <Progress value={percentage} size="3" />
            <Flex justify="between" mt="2">
              <Text size="2" color="gray">
                {percentage}%
              </Text>
              {estimatedTimeRemaining && (
                <Text size="2" color="gray">
                  {formatETA(estimatedTimeRemaining)}
                </Text>
              )}
            </Flex>
          </Box>
        )}

        {/* Current Step */}
        {currentStep && (
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="gray">
              Current Step
            </Text>
            <Text size="2">{currentStep.replace(/_/g, ' ').toUpperCase()}</Text>
          </Flex>
        )}

        {/* Current Substep */}
        {currentSubStep && (
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="gray">
              Details
            </Text>
            <Text size="2">{currentSubStep}</Text>
          </Flex>
        )}

        {/* Chunk Progress */}
        {progress.currentChunk > 0 && progress.totalChunks > 0 && (
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="gray">
              Audio Chunks
            </Text>
            <Text size="2">
              Processing chunk {progress.currentChunk} of {progress.totalChunks}
            </Text>
          </Flex>
        )}

        {/* Error Message */}
        {progress.errorMessage && (
          <Flex direction="column" gap="1">
            <Text size="2" weight="medium" color="red">
              Error
            </Text>
            <Text size="2" color="red">
              {progress.errorMessage}
            </Text>
          </Flex>
        )}

        {/* Additional Details */}
        {progress.progressDetails && Object.keys(progress.progressDetails).length > 0 && (
          <Box>
            <Text size="2" weight="medium" color="gray" mb="2">
              Additional Information
            </Text>
            <Flex direction="column" gap="1">
              {progress.progressDetails.speakers_detected && (
                <Text size="1" color="gray">
                  • {progress.progressDetails.speakers_detected} speakers detected
                </Text>
              )}
              {progress.progressDetails.language && (
                <Text size="1" color="gray">
                  • Language: {progress.progressDetails.language}
                </Text>
              )}
              {progress.progressDetails.batch_size && (
                <Text size="1" color="gray">
                  • Batch size: {progress.progressDetails.batch_size}
                </Text>
              )}
            </Flex>
          </Box>
        )}
      </Flex>
    </Card>
  );
}
