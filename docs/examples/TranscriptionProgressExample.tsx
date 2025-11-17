/**
 * Example: Real-Time Transcription Progress Display
 *
 * This example shows how to integrate the TranscriptionProgress component
 * into a page that starts a transcription job and monitors progress.
 */

'use client';

import { useState } from 'react';
import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes';
import { TranscriptionProgress } from '@/components/TranscriptionProgress';
import { trpc } from '@/lib/trpc';

export default function TranscriptionExample() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // tRPC mutation for starting transcription
  const transcribeMutation = trpc.sessionTranscription.transcribeSession.useMutation({
    onSuccess: (data) => {
      console.log('Transcription job started:', data.jobId);
      setJobId(data.jobId);
      setIsStarting(false);
    },
    onError: (error) => {
      console.error('Failed to start transcription:', error);
      setIsStarting(false);
      alert(`Error: ${error.message}`);
    },
  });

  const handleStartTranscription = async () => {
    setIsStarting(true);

    // Example: Start transcription with speaker diarization
    transcribeMutation.mutate({
      sessionId: 'example_session_id',
      filePath: '/path/to/your/audio.mp3',
      modelSize: 'medium',
      useGPU: true,
      useSpeakers: true,
      speakerNames: ['Dungeon Master', 'Player 1', 'Player 2', 'Player 3'],
      numSpeakers: 4, // Optional: exact number of speakers
      batchSize: 16,
      deleteOriginalFile: false, // Keep original for this example
    });
  };

  return (
    <Container size="3" py="6">
      <Flex direction="column" gap="6">
        <Box>
          <Heading size="6" mb="2">
            Real-Time Transcription Progress Example
          </Heading>
          <Text color="gray" size="2">
            This example demonstrates how to start a transcription job and monitor its progress
            in real-time using WebSocket updates.
          </Text>
        </Box>

        {/* Start Transcription Button */}
        {!jobId && (
          <Button
            size="3"
            onClick={handleStartTranscription}
            disabled={isStarting}
          >
            {isStarting ? 'Starting Transcription...' : 'Start Transcription'}
          </Button>
        )}

        {/* Progress Display */}
        {jobId && (
          <Box>
            <Heading size="4" mb="3">
              Transcription Progress
            </Heading>
            <TranscriptionProgress jobId={jobId} />
          </Box>
        )}

        {/* Instructions */}
        <Box>
          <Heading size="3" mb="2">
            How It Works
          </Heading>
          <Flex direction="column" gap="2">
            <Text size="2">
              1. Click "Start Transcription" to begin processing
            </Text>
            <Text size="2">
              2. The component connects to WebSocket server on port 3001
            </Text>
            <Text size="2">
              3. Real-time progress updates are displayed as they occur
            </Text>
            <Text size="2">
              4. You'll see: current step, substep details, percentage, and ETA
            </Text>
            <Text size="2">
              5. Progress persists even if you refresh the page (WebSocket reconnects)
            </Text>
          </Flex>
        </Box>

        {/* Progress Stages */}
        <Box>
          <Heading size="3" mb="2">
            Progress Stages
          </Heading>
          <Flex direction="column" gap="2">
            <Text size="2">
              <strong>Extracting Audio:</strong> Converting video to audio format
            </Text>
            <Text size="2">
              <strong>Splitting Chunks:</strong> Dividing audio into 10-minute segments
            </Text>
            <Text size="2">
              <strong>Loading Model:</strong> Initializing WhisperX model on GPU/CPU
            </Text>
            <Text size="2">
              <strong>Transcribing:</strong> Processing audio with batched inference
            </Text>
            <Text size="2">
              <strong>Aligning:</strong> Aligning timestamps to word level
            </Text>
            <Text size="2">
              <strong>Diarizing:</strong> Detecting and assigning speakers (optional)
            </Text>
            <Text size="2">
              <strong>Saving:</strong> Writing results to database
            </Text>
          </Flex>
        </Box>
      </Flex>
    </Container>
  );
}

/**
 * Alternative: Using the Custom Hook
 *
 * If you want more control over the UI, use the hook directly:
 */

import { useTranscriptionProgress } from '@/hooks/useTranscriptionProgress';

export function CustomProgressDisplay({ jobId }: { jobId: string }) {
  const { progress, isConnected, error } = useTranscriptionProgress({
    jobId,
    wsUrl: 'ws://localhost:3001',
  });

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!progress) {
    return <div>Loading progress...</div>;
  }

  const isProcessing = progress.status === 'processing';
  const isComplete = progress.status === 'completed';
  const hasFailed = progress.status === 'failed';

  return (
    <div>
      {/* Connection Status */}
      <div>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* Status Badge */}
      <div>
        Status: {progress.status.toUpperCase()}
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div>
          <progress value={progress.progress} max={100} />
          <span>{progress.progress}%</span>
        </div>
      )}

      {/* Current Activity */}
      <div>
        <strong>Current Step:</strong> {progress.currentStep}
      </div>

      {progress.currentSubStep && (
        <div>
          <strong>Details:</strong> {progress.currentSubStep}
        </div>
      )}

      {/* Chunk Progress */}
      {progress.totalChunks > 0 && (
        <div>
          Processing chunk {progress.currentChunk} of {progress.totalChunks}
        </div>
      )}

      {/* ETA */}
      {progress.estimatedTimeRemaining && (
        <div>
          Estimated time remaining: {Math.floor(progress.estimatedTimeRemaining / 60)}m{' '}
          {progress.estimatedTimeRemaining % 60}s
        </div>
      )}

      {/* Additional Details */}
      {progress.progressDetails && (
        <div>
          <h4>Details:</h4>
          <pre>{JSON.stringify(progress.progressDetails, null, 2)}</pre>
        </div>
      )}

      {/* Error Message */}
      {hasFailed && progress.errorMessage && (
        <div style={{ color: 'red' }}>
          Error: {progress.errorMessage}
        </div>
      )}

      {/* Success Message */}
      {isComplete && (
        <div style={{ color: 'green' }}>
          ✅ Transcription completed successfully!
        </div>
      )}
    </div>
  );
}
