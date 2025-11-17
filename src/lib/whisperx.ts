import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Enhanced segment interface with word-level timestamps and speaker info
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface SpeakerInfo {
  name: string;
  segmentCount: number;
}

// Progress event from Python script
export interface ProgressEvent {
  type: 'progress';
  stage: 'loading_model' | 'transcribing' | 'aligning' | 'diarizing';
  percentage: number | null;
  message: string | null;
  timestamp: number;
  details: Record<string, any>;
}

export interface WhisperXTranscriptionResult {
  success: boolean;
  text: string;
  textWithSpeakers?: string | null;
  segments: TranscriptionSegment[];
  language: string;
  language_probability: number;
  duration: number;
  hasSpeakers: boolean;
  speakers?: SpeakerInfo[] | null;
  error?: string;
}

export interface WhisperXOptions {
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';
  language?: string;
  device?: 'cuda' | 'cpu';
  computeType?: 'float16' | 'int8';
  batchSize?: number;
  // Speaker diarization options
  speakerNames?: string[];
  numSpeakers?: number;
  minSpeakers?: number;
  maxSpeakers?: number;
  // Progress callback
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

/**
 * Check if Python and WhisperX are available
 */
export async function checkWhisperXAvailability(): Promise<{
  available: boolean;
  pythonVersion?: string;
  error?: string;
}> {
  try {
    const { stdout } = await execAsync('python --version');
    const pythonVersion = stdout.trim();

    // Check if whisperx is installed
    try {
      await execAsync('python -c "import whisperx"');
      return { available: true, pythonVersion };
    } catch {
      return {
        available: false,
        pythonVersion,
        error: 'WhisperX not installed. Run: pip install -r requirements.txt',
      };
    }
  } catch {
    return {
      available: false,
      error: 'Python not found. Please install Python 3.8 or higher.',
    };
  }
}

/**
 * Parse progress events from Python script stderr
 * Events have format: __PROGRESS__{json}__END__
 */
function parseProgressEvents(stderr: string, onProgress?: (event: ProgressEvent) => void | Promise<void>): void {
  const progressRegex = /__PROGRESS__(.+?)__END__/g;
  let match;

  while ((match = progressRegex.exec(stderr)) !== null) {
    try {
      const event = JSON.parse(match[1]) as ProgressEvent;
      if (onProgress) {
        void onProgress(event);
      }
    } catch (error) {
      console.error('Failed to parse progress event:', match[1], error);
    }
  }
}

/**
 * Transcribe audio file using WhisperX with optional speaker diarization
 */
export async function transcribeWithWhisperX(
  audioPath: string,
  options: WhisperXOptions = {}
): Promise<WhisperXTranscriptionResult> {
  const {
    modelSize = 'medium',
    language,
    device = 'cuda',
    computeType = 'float16',
    batchSize = 16,
    speakerNames,
    numSpeakers,
    minSpeakers = 1,
    maxSpeakers = 8,
    onProgress,
  } = options;

  const scriptPath = path.join(process.cwd(), 'scripts', 'transcribe_whisperx.py');
  const outputPath = path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}_transcription.json`
  );

  // Build command arguments
  const args = [
    scriptPath,
    audioPath,
    '--model', modelSize,
    '--device', device,
    '--compute-type', computeType,
    '--batch-size', batchSize.toString(),
    '--output', outputPath,
  ];

  if (language) {
    args.push('--language', language);
  }

  // Speaker diarization arguments
  if (speakerNames && speakerNames.length > 0) {
    args.push('--speaker-names', ...speakerNames);
  }

  if (numSpeakers) {
    args.push('--num-speakers', numSpeakers.toString());
  } else {
    if (minSpeakers) {
      args.push('--min-speakers', minSpeakers.toString());
    }
    if (maxSpeakers) {
      args.push('--max-speakers', maxSpeakers.toString());
    }
  }

  return new Promise((resolve) => {
    let stderrBuffer = '';

    const pythonProcess = spawn('python', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Capture stderr for progress events
    pythonProcess.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderrBuffer += chunk;

      // Parse and emit progress events
      parseProgressEvents(chunk, onProgress);
    });

    // Capture stdout (not used, but prevent blocking)
    pythonProcess.stdout.on('data', () => {
      // Ignore stdout
    });

    pythonProcess.on('error', (error) => {
      console.error('Python process error:', error);
      resolve({
        success: false,
        text: '',
        segments: [],
        language: '',
        language_probability: 0,
        duration: 0,
        hasSpeakers: false,
        error: `Failed to spawn Python process: ${error.message}`,
      });
    });

    pythonProcess.on('close', async (code) => {
      try {
        if (code !== 0) {
          // Process failed
          console.error('WhisperX transcription failed with code:', code);
          console.error('stderr:', stderrBuffer);

          resolve({
            success: false,
            text: '',
            segments: [],
            language: '',
            language_probability: 0,
            duration: 0,
            hasSpeakers: false,
            error: `Python script exited with code ${code}`,
          });
          return;
        }

        // Read result from output file
        const resultJson = await fs.readFile(outputPath, 'utf-8');
        const result: WhisperXTranscriptionResult = JSON.parse(resultJson);

        // Cleanup output file
        await fs.unlink(outputPath).catch(() => {});

        resolve(result);
      } catch (error) {
        console.error('WhisperX result parsing error:', error);
        resolve({
          success: false,
          text: '',
          segments: [],
          language: '',
          language_probability: 0,
          duration: 0,
          hasSpeakers: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  });
}

/**
 * Transcribe multiple audio chunks and combine results with proper timestamp offsetting
 */
export async function transcribeChunksWithWhisperX(
  chunkPaths: string[],
  options: WhisperXOptions = {}
): Promise<WhisperXTranscriptionResult> {
  const results: WhisperXTranscriptionResult[] = [];
  let totalDuration = 0;
  const totalChunks = chunkPaths.length;
  const { onProgress } = options;

  // Transcribe each chunk
  for (let i = 0; i < chunkPaths.length; i++) {
    const chunkPath = chunkPaths[i];
    const chunkNumber = i + 1;

    // Create chunk-specific progress callback that includes chunk info
    const chunkProgressCallback = onProgress
      ? (event: ProgressEvent) => {
          // Enhance event with chunk information
          const enhancedEvent: ProgressEvent = {
            ...event,
            details: {
              ...event.details,
              currentChunk: chunkNumber,
              totalChunks,
              chunkPath: path.basename(chunkPath),
            },
          };
          return onProgress(enhancedEvent);
        }
      : undefined;

    const result = await transcribeWithWhisperX(chunkPath, {
      ...options,
      onProgress: chunkProgressCallback,
    });

    if (result.success) {
      results.push(result);
      totalDuration += result.duration;
    } else {
      // If any chunk fails, return the error
      return result;
    }
  }

  // Combine results
  const allSegments: TranscriptionSegment[] = [];
  const allText: string[] = [];
  const allTextWithSpeakers: string[] = [];
  let timeOffset = 0;

  // Track all unique speakers across chunks
  const speakerSegmentCounts = new Map<string, number>();

  for (const result of results) {
    // Adjust segment timestamps based on cumulative duration
    const adjustedSegments = result.segments.map((segment) => {
      const adjustedSegment: TranscriptionSegment = {
        start: segment.start + timeOffset,
        end: segment.end + timeOffset,
        text: segment.text,
      };

      if (segment.speaker) {
        adjustedSegment.speaker = segment.speaker;
        // Count segments per speaker
        speakerSegmentCounts.set(
          segment.speaker,
          (speakerSegmentCounts.get(segment.speaker) || 0) + 1
        );
      }

      return adjustedSegment;
    });

    allSegments.push(...adjustedSegments);
    allText.push(result.text);

    if (result.textWithSpeakers) {
      allTextWithSpeakers.push(result.textWithSpeakers);
    }

    timeOffset += result.duration;
  }

  // Build combined speaker info
  const hasSpeakers = results.some((r) => r.hasSpeakers);
  const speakers: SpeakerInfo[] | null = hasSpeakers
    ? Array.from(speakerSegmentCounts.entries()).map(([name, count]) => ({
        name,
        segmentCount: count,
      }))
    : null;

  return {
    success: true,
    text: allText.join(' '),
    textWithSpeakers: allTextWithSpeakers.length > 0 ? allTextWithSpeakers.join('\n\n') : null,
    segments: allSegments,
    language: results[0]?.language || 'en',
    language_probability: results[0]?.language_probability || 0,
    duration: totalDuration,
    hasSpeakers,
    speakers,
  };
}
