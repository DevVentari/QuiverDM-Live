'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { SessionRecordingUpload } from './SessionRecordingUpload';
import { formatFileSize, formatDate } from '@/lib/utils/format';

interface SessionRecordingManagerProps {
  sessionId: string;
  userId: string;
  campaignId: string;
}

export function SessionRecordingManager({
  sessionId,
  userId,
  campaignId,
}: SessionRecordingManagerProps) {
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Fetch recordings for this session
  const { data: recordings, refetch: refetchRecordings } =
    trpc.sessionRecordings.getBySessionId.useQuery(
      { sessionId },
      { refetchInterval: 5000 } // Refresh every 5 seconds
    );

  const transcribeMutation =
    trpc.sessionTranscription.transcribeSession.useMutation({
      onSuccess: () => {
        refetchRecordings();
        setTranscribing(false);
        setSelectedRecording(null);
      },
      onError: (error) => {
        setTranscribing(false);
        alert(`Transcription failed: ${error.message}`);
      },
    });

  const deleteRecordingMutation = trpc.sessionRecordings.delete.useMutation({
    onSuccess: () => {
      refetchRecordings();
    },
  });

  const handleUploadComplete = (recording: {
    id: string;
    url: string;
    type: string;
  }) => {
    console.log('Upload complete:', recording);
    refetchRecordings();
  };

  const handleTranscribe = async (recording: {
    id: string;
    originalUrl: string;
    type: string;
  }) => {
    setSelectedRecording(recording.id);
    setTranscribing(true);

    // In a real app, you'd need to get the actual file path
    // For now, we'll use a placeholder that would need to be implemented
    // based on your storage solution
    try {
      await transcribeMutation.mutateAsync({
        sessionId,
        recordingId: recording.id,
        filePath: '/path/to/local/file', // This would need to be resolved from the URL
        fileUrl: recording.originalUrl,
        modelSize: 'medium',
        useSpeakers: true,
        deleteOriginalFile: true, // Auto-delete video after transcription
      });
    } catch (error) {
      console.error('Transcription error:', error);
    }
  };

  const handleDelete = async (recordingId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this recording and all its files?'
      )
    ) {
      return;
    }

    await deleteRecordingMutation.mutateAsync({
      id: recordingId,
      deleteFiles: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <SessionRecordingUpload
        sessionId={sessionId}
        onUploadComplete={handleUploadComplete}
      />

      {/* Recordings List */}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">
          Session Recordings
        </h3>

        {!recordings || recordings.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No recordings uploaded yet
          </p>
        ) : (
          <div className="space-y-4">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gray-700 rounded-lg p-4 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {recording.type === 'video' ? '🎬' : '🎵'}{' '}
                        {recording.type.toUpperCase()}
                      </span>
                      {recording.originalDeleted && (
                        <span className="text-xs bg-green-900/30 text-green-300 px-2 py-1 rounded">
                          Original Deleted
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          recording.processingStatus === 'completed'
                            ? 'bg-green-900/30 text-green-300'
                            : recording.processingStatus === 'processing'
                            ? 'bg-blue-900/30 text-blue-300'
                            : recording.processingStatus === 'failed'
                            ? 'bg-red-900/30 text-red-300'
                            : 'bg-gray-900/30 text-gray-300'
                        }`}
                      >
                        {recording.processingStatus}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      Size: {formatFileSize(recording.fileSize)}
                      {recording.durationSeconds && (
                        <> • Duration: {Math.round(recording.durationSeconds / 60)} min</>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Uploaded: {formatDate(recording.createdAt)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {recording.transcripts.length === 0 && (
                      <button
                        onClick={() => handleTranscribe(recording)}
                        disabled={
                          transcribing ||
                          recording.processingStatus === 'processing'
                        }
                        className="px-3 py-1 text-sm bg-violet-600 text-white rounded
                          hover:bg-violet-700 disabled:bg-gray-600 disabled:cursor-not-allowed
                          transition-colors"
                      >
                        {transcribing && selectedRecording === recording.id
                          ? 'Transcribing...'
                          : 'Transcribe'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(recording.id)}
                      disabled={transcribing}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded
                        hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed
                        transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Transcripts */}
                {recording.transcripts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <p className="text-sm text-gray-300 mb-2">
                      {recording.transcripts.length} Transcript(s)
                    </p>
                    {recording.transcripts.map((transcript) => (
                      <div
                        key={transcript.id}
                        className="bg-gray-800 rounded p-2 mb-2"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs text-gray-400">
                              {transcript.hasSpeakers
                                ? '👥 With speakers'
                                : '📝 Plain text'}
                              {transcript.language && (
                                <> • Language: {transcript.language}</>
                              )}
                            </p>
                            {transcript.durationSeconds && (
                              <p className="text-xs text-gray-500">
                                Duration: {Math.round(transcript.durationSeconds / 60)} min
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              // Navigate to transcript view or show modal
                              console.log('View transcript:', transcript.id);
                            }}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error Message */}
                {recording.errorMessage && (
                  <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded">
                    <p className="text-xs text-red-300">
                      Error: {recording.errorMessage}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storage Stats */}
      {recordings && recordings.length > 0 && (
        <StorageStats sessionId={sessionId} />
      )}
    </div>
  );
}

function StorageStats({ sessionId }: { sessionId: string }) {
  const { data: stats } = trpc.sessionRecordings.getStorageStats.useQuery({
    sessionId,
  });

  if (!stats) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h3 className="text-xl font-bold mb-4 text-white">Storage Statistics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-400">Total Storage</p>
          <p className="text-2xl font-bold text-white">
            {formatFileSize(stats.totalSize)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Total Recordings</p>
          <p className="text-2xl font-bold text-white">
            {stats.totalRecordings}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Originals Deleted</p>
          <p className="text-2xl font-bold text-green-400">
            {stats.originalDeletedCount}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Average Size</p>
          <p className="text-2xl font-bold text-white">
            {formatFileSize(stats.averageSize)}
          </p>
        </div>
      </div>
    </div>
  );
}
