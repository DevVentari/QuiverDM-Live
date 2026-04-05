'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { Upload, X, Mic } from 'lucide-react';

interface FileEntry {
  file: File;
  speakerTag: string;
  recordingId?: string;
  uploadUrl?: string;
  r2Key?: string;
  isLocalMode?: boolean;
  status: 'pending' | 'initiating' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface MultiTrackDropzoneProps {
  sessionId: string;
  campaignId: string;
  onComplete: (uploadGroupId: string) => void;
}

const ACCEPTED_AUDIO = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  'audio/mp4': ['.m4a'],
  'audio/webm': ['.webm'],
  'audio/flac': ['.flac'],
  'audio/aac': ['.aac'],
};

export function MultiTrackDropzone({
  sessionId,
  campaignId,
  onComplete,
}: MultiTrackDropzoneProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploadGroupId] = useState(() => crypto.randomUUID());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initiate = trpc.multiTrackUpload.initiate.useMutation();
  const process = trpc.multiTrackUpload.process.useMutation();

  const onDrop = useCallback((accepted: File[]) => {
    setEntries((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        file,
        speakerTag: '',
        status: 'pending' as const,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_AUDIO,
    maxSize: 500 * 1024 * 1024,
  });

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTag = (index: number, tag: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, speakerTag: tag } : e))
    );
  };

  const handleSubmit = async () => {
    if (entries.length === 0 || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // 1. Initiate upload for each file (sequential to avoid rate limits)
      const withUrls: FileEntry[] = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setEntries((prev) =>
          prev.map((e, idx) => (idx === i ? { ...e, status: 'initiating' } : e))
        );

        const result = await initiate.mutateAsync({
          campaignId,
          sessionId,
          fileName: entry.file.name,
          fileSize: entry.file.size,
          contentType: entry.file.type,
          uploadGroupId,
          speakerTag: entry.speakerTag || undefined,
        });

        withUrls.push({
          ...entry,
          recordingId: result.recordingId,
          uploadUrl: result.uploadUrl,
          r2Key: result.r2Key,
          isLocalMode: result.isLocalMode,
          status: 'uploading',
        });

        setEntries((prev) =>
          prev.map((e, idx) =>
            idx === i ? { ...e, status: 'uploading', recordingId: result.recordingId } : e
          )
        );
      }

      // 2. Upload all files to R2 in parallel (or local endpoint for dev)
      await Promise.all(
        withUrls.map(async (entry, i) => {
          if (!entry.uploadUrl) return;
          let res: Response;
          if (entry.isLocalMode) {
            const form = new FormData();
            form.append('file', entry.file);
            form.append('sessionId', sessionId);
            res = await fetch(entry.uploadUrl, { method: 'POST', body: form });
          } else {
            res = await fetch(entry.uploadUrl, {
              method: 'PUT',
              body: entry.file,
              headers: { 'Content-Type': entry.file.type },
            });
          }
          if (!res.ok) throw new Error(`Upload failed for ${entry.file.name}`);
          setEntries((prev) =>
            prev.map((e) => (e.recordingId === entry.recordingId ? { ...e, status: 'done' } : e))
          );
        })
      );

      // 3. Trigger merge worker
      await process.mutateAsync({ campaignId, sessionId, uploadGroupId });

      onComplete(uploadGroupId);
    } catch (err) {
      setIsSubmitting(false);
      setEntries((prev) =>
        prev.map((e) =>
          e.status !== 'done' ? { ...e, status: 'error', error: String(err) } : e
        )
      );
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-amber-500/60 bg-amber-500/5'
            : 'border-white/10 hover:border-amber-500/30'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 h-8 w-8 text-amber-500/60" />
        <p className="text-sm text-white/60">
          Drop audio files here, or click to select
        </p>
        <p className="mt-1 text-xs text-white/30">MP3, WAV, OGG, FLAC, M4A, WEBM, AAC — up to 500MB each</p>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div
              key={entry.recordingId ?? `${entry.file.name}-${entry.file.size}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <Mic className="h-4 w-4 shrink-0 text-amber-500/60" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                {entry.file.name}
              </span>
              <Input
                placeholder="Speaker name (optional)"
                value={entry.speakerTag}
                onChange={(e) => updateTag(i, e.target.value)}
                className="w-40 h-7 text-xs border-white/10 bg-white/5"
                disabled={isSubmitting}
              />
              <span className="text-xs text-white/30 shrink-0">
                {entry.status === 'initiating' && 'Preparing…'}
                {entry.status === 'uploading' && 'Uploading…'}
                {entry.status === 'done' && '✓'}
                {entry.status === 'error' && '✗'}
              </span>
              {!isSubmitting && (
                <button
                  onClick={() => removeEntry(i)}
                  className="text-white/30 hover:text-white/60"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-amber-500 text-black hover:bg-amber-400"
        >
          {isSubmitting
            ? 'Uploading…'
            : `Upload ${entries.length} file${entries.length > 1 ? 's' : ''}`}
        </Button>
      )}
    </div>
  );
}
