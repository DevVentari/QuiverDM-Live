'use client';

import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';

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
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createRecordingMutation = trpc.sessionRecordings.create.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const isVideo = selectedFile.type.startsWith('video/');
    const isAudio = selectedFile.type.startsWith('audio/');

    if (!isVideo && !isAudio) {
      setError('Please select a video or audio file');
      return;
    }

    // Validate file size (1GB max)
    const maxSize = 1024 * 1024 * 1024; // 1GB
    if (selectedFile.size > maxSize) {
      setError('File size must be less than 1GB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const uploadFile = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Upload file to server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      });

      // Handle completion
      const uploadPromise = new Promise<{
        url: string;
        type: string;
        fileSize: number;
      }>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });
      });

      xhr.open('POST', '/api/recordings/upload');
      xhr.send(formData);

      const uploadResult = await uploadPromise;

      // Create database record
      const recording = await createRecordingMutation.mutateAsync({
        sessionId,
        type: uploadResult.type as 'audio' | 'video',
        url: uploadResult.url,
        fileSize: uploadResult.fileSize,
      });

      console.log('Recording created:', recording);

      // Reset form
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Callback
      if (onUploadComplete) {
        onUploadComplete({
          id: recording.id,
          url: uploadResult.url,
          type: uploadResult.type,
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isVideo = file && file.type.startsWith('video/');

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
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileChange}
              disabled={uploading}
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
          {file && (
            <div className="p-3 bg-gray-700 rounded-md">
              <p className="text-sm text-gray-300">
                <strong>File:</strong> {file.name}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Size:</strong> {formatFileSize(file.size)}
              </p>
              <p className="text-sm text-gray-300">
                <strong>Type:</strong>{' '}
                {file.type.startsWith('video/') ? 'Video' : 'Audio'}
              </p>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-md">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={uploadFile}
            disabled={!file || uploading}
            className="w-full px-4 py-2 bg-violet-600 text-white rounded-md
              hover:bg-violet-700 disabled:bg-gray-600 disabled:cursor-not-allowed
              transition-colors font-medium"
          >
            {uploading ? `Uploading... ${uploadProgress}%` : 'Upload Recording'}
          </button>
        </div>
      </div>
    </div>
  );
}
