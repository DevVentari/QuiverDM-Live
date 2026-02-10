'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { TranscriptionProgress } from './TranscriptionProgress';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';

export function WhisperUpload() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [transcriptionWithSpeakers, setTranscriptionWithSpeakers] = useState<string>('');
  const [language, setLanguage] = useState<string>('en');
  const [useSpeakers, setUseSpeakers] = useState(false);
  const [localFileKey, setLocalFileKey] = useState<string>('');
  const [localFileUrl, setLocalFileUrl] = useState<string>('');
  const [jobId, setJobId] = useState<string | null>(null);
  const { isRecording, audioBlob, startRecording, stopRecording, clearRecording } =
    useMediaRecorder();

  const upload = useFileUpload({
    endpoint: '/api/recordings/upload',
    accept: 'audio/*,video/*',
    maxSize: 1024 * 1024 * 1024,
    formData: { sessionId: 'temp-session' },
    onSuccess: (result) => {
      setLocalFileKey(result.key);
      setLocalFileUrl(result.url);
    },
    onError: () => {
      alert('Failed to upload file');
    },
  });

  // Check for existing jobs on mount
  const { data: existingJobs } = trpc.sessionTranscription.getSessionTranscriptionJobs.useQuery({
    sessionId: 'temp-session',
  });

  // Set job ID if there's an active transcription
  useEffect(() => {
    if (existingJobs && existingJobs.length > 0) {
      const activeJob = existingJobs.find(
        (job) => job.status === 'processing' || job.status === 'queued'
      );
      if (activeJob) {
        setJobId(activeJob.jobId);
      } else if (jobId && !activeJob) {
        // Clear job ID if no active jobs found
        setJobId(null);
      }
    } else if (existingJobs && existingJobs.length === 0 && jobId) {
      // Clear job ID if no jobs at all
      setJobId(null);
    }
  }, [existingJobs, jobId]);

  const transcribeMutation = trpc.sessionTranscription.transcribeSession.useMutation({
    onSuccess: (data) => {
      setTranscription(data.transcription);
      if (data.transcriptionWithSpeakers) {
        setTranscriptionWithSpeakers(data.transcriptionWithSpeakers);
      }
      upload.reset();
      setJobId(null); // Clear job ID when complete
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
      upload.reset();
      setJobId(null); // Clear job ID on error
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setTranscription('');
    setTranscriptionWithSpeakers('');
    setLocalFileKey('');
    setLocalFileUrl('');

    try {
      await upload.upload(file);
    } catch {
      // Error handled by hook onError
    }
  };

  useEffect(() => {
    if (!audioBlob) return;

    const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
    setAudioFile(file);
    setTranscription('');
    setTranscriptionWithSpeakers('');
    setLocalFileKey('');
    setLocalFileUrl('');

    upload.upload(file).catch(() => undefined);
    clearRecording();
  }, [audioBlob, clearRecording, upload]);

  const handleTranscribe = async () => {
    if (!audioFile || !localFileUrl || !localFileKey) return;

    try {
      transcribeMutation.mutate(
        {
          sessionId: 'temp-session',
          filePath: localFileKey, // Server will resolve absolute path from key
          fileUrl: localFileUrl,
          modelSize: 'medium',
          language: language || undefined,
          useSpeakers,
          deleteOriginalFile: false, // Don't delete for quick tests
        },
        {
          onSuccess: (data) => {
            // Set job ID for progress tracking
            if (data.jobId) {
              setJobId(data.jobId);
            }
          },
        }
      );
    } catch (error) {
      alert('Error processing audio file');
    }
  };

  const isVideo = audioFile && audioFile.type.startsWith('video/');
  const inputProps = upload.getInputProps();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-white">WhisperX Local Transcription</h2>
        <div className="mb-4 p-3 bg-violet-900/30 border border-violet-700 rounded-md">
          <p className="text-sm text-violet-300">
            ⚡ Using local WhisperX for fast, accurate transcription with speaker diarization support.
          </p>
        </div>

        {isVideo && (
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-md">
            <p className="text-sm text-blue-300">
              🎬 Video file detected. Audio will be extracted automatically before transcription.
            </p>
          </div>
        )}

        {/* File Upload */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Upload Audio or Video File
            </label>
            <input
              {...inputProps}
              style={{ ...inputProps.style, display: 'block' }}
              onChange={handleFileChange}
              disabled={upload.isUploading || transcribeMutation.isPending}
              className="block w-full text-sm text-gray-300
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-violet-600 file:text-white
                hover:file:bg-violet-700
                disabled:opacity-50 disabled:cursor-not-allowed
                cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-500">
              Supports audio (MP3, WAV, WebM) and video files (MP4, WebM, AVI, MOV).
              Max size: 1GB. Uses local WhisperX for transcription.
            </p>
          </div>

          {/* Upload Progress */}
          {upload.isUploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Uploading...</span>
                <span>{upload.progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={upload.isUploading || transcribeMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700
                  disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              >
                🎤 Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                ⏹️ Stop Recording
              </button>
            )}
          </div>

          {/* Language Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Language (optional)
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={upload.isUploading || transcribeMutation.isPending}
                className="block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-violet-600"
              >
                <option value="">Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
                <option value="pt">Portuguese</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Speaker Diarization
              </label>
              <label className="flex items-center space-x-2 p-3 bg-gray-700 rounded-md cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSpeakers}
                  onChange={(e) => setUseSpeakers(e.target.checked)}
                  disabled={upload.isUploading || transcribeMutation.isPending}
                  className="w-4 h-4 text-violet-600 bg-gray-600 border-gray-500 rounded focus:ring-violet-500"
                />
                <span className="text-sm text-gray-300">Identify speakers</span>
              </label>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleTranscribe}
            disabled={
              !audioFile ||
              !localFileUrl ||
              transcribeMutation.isPending ||
              upload.isUploading
            }
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {transcribeMutation.isPending
              ? 'Transcribing with WhisperX...'
              : upload.isUploading
              ? `Uploading... ${upload.progress}%`
              : 'Transcribe with WhisperX'}
          </button>

          {audioFile && (
            <p className="text-sm text-gray-400">
              Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
      </div>

      {/* Real-Time Progress Tracking */}
      {jobId && (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-white">Real-Time Progress</h3>
          <TranscriptionProgress jobId={jobId} />
        </div>
      )}

      {/* Transcription Results */}
      {transcription && (
        <div className="space-y-4">
          {/* Plain Text Transcription */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-bold mb-3 text-white">Transcription (Plain Text)</h3>
            <div className="bg-gray-900 p-4 rounded-md max-h-96 overflow-y-auto">
              <p className="text-gray-200 whitespace-pre-wrap">{transcription}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(transcription)}
              className="mt-3 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
            >
              📋 Copy Plain Text
            </button>
          </div>

          {/* Speaker Diarization Results */}
          {transcriptionWithSpeakers && (
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-3 text-white">
                Transcription (With Speakers) 👥
              </h3>
              <div className="bg-gray-900 p-4 rounded-md max-h-96 overflow-y-auto">
                <p className="text-gray-200 whitespace-pre-wrap">{transcriptionWithSpeakers}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(transcriptionWithSpeakers)}
                className="mt-3 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
              >
                📋 Copy With Speakers
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
