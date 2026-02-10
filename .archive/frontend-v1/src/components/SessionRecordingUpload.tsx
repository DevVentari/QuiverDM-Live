'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { formatFileSize } from '@/lib/utils/format';
import { useFileUpload } from '@/hooks/useFileUpload';

interface SessionRecordingUploadProps {
  sessionId: string;
  onUploadComplete?: (recording: {
    id: string;
    url: string;
    type: string;
  }) => void;
}

export function SessionRecordingUpload({
  sessionId,
  onUploadComplete,
}: SessionRecordingUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const createRecordingMutation = trpc.sessionRecordings.create.useMutation();

  const upload = useFileUpload({
    endpoint: '/api/recordings/upload',
    accept: 'video/*,audio/*',
    maxSize: 1024 * 1024 * 1024,
    formData: { sessionId },
  });

  const handleUpload = async () => {
    if (!upload.file) return;
    setError(null);

    try {
      const uploadResult = await upload.upload();
      const recording = await createRecordingMutation.mutateAsync({
        sessionId,
        type: uploadResult.type as 'audio' | 'video',
        url: uploadResult.url,
        fileSize: uploadResult.fileSize,
      });

      upload.reset();

      onUploadComplete?.({
        id: recording.id,
        url: uploadResult.url,
        type: uploadResult.type,
      });
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const isVideo = upload.file && upload.file.type.startsWith('video/');
  const inputProps = upload.getInputProps();

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">
          Upload Session Recording
        </h3>

        {isVideo && (
          <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-md">
            <p className="text-sm text-blue-300">
              🎬 Video file detected. Audio will be extracted for transcription,
              and the original video will be deleted after processing to save
              storage space.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Select Video or Audio File
            </label>
            <input
              {...inputProps}
              style={{ ...inputProps.style, display: 'block' }}
              disabled={upload.isUploading}
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
              Supports video (MP4, WebM, AVI, MOV) and audio files (MP3, WAV,
              M4A). Max size: 1GB
            </p>
          </div>

          {/* File Info */}
          {upload.file && (
            <div className="p-3 bg-gray-700 rounded-md">
              <p className="text-sm text-gray-300">
                <strong>File:</strong> {upload.file.name}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Size:</strong> {formatFileSize(upload.file.size)}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Type:</strong>{' '}
                {upload.file.type.startsWith('video/') ? 'Video' : 'Audio'}
              </p>
            </div>
          )}

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

          {/* Error Message */}
          {(error || upload.error) && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
              <p className="text-sm text-red-300">{error || upload.error}</p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!upload.file || upload.isUploading}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-md
              hover:bg-violet-700 disabled:bg-gray-600 disabled:cursor-not-allowed
              transition-colors font-medium"
          >
            {upload.isUploading
              ? `Uploading... ${upload.progress}%`
              : 'Upload Recording'}
          </button>
        </div>
      </div>
    </div>
  );
}
