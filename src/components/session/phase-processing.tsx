'use client';

import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/components/session/audio-recorder';

interface PhaseProcessingProps {
  session: { id: string };
  campaignId: string;
  onUploadComplete: () => void;
}

function FileUploader({ sessionId, onUploadComplete }: { sessionId: string; onUploadComplete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const createRecording = trpc.sessionRecordings.create.useMutation();
  const utils = trpc.useUtils();

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      let recordingUrl: string;

      if (process.env.NEXT_PUBLIC_STORAGE_MODE === 'r2') {
        const res = await fetch('/api/recordings/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, filename: selectedFile.name, contentType: selectedFile.type, fileSize: selectedFile.size }),
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const { uploadUrl, key } = (await res.json()) as { uploadUrl: string; key: string };
        const r2Res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
        if (!r2Res.ok) throw new Error('Upload to storage failed');
        recordingUrl = `/api/storage/${key}`;
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('sessionId', sessionId);
        const res = await fetch('/api/recordings/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        const data = (await res.json()) as { url: string };
        recordingUrl = data.url;
      }

      await createRecording.mutateAsync({ sessionId, type: 'audio', url: recordingUrl, fileSize: selectedFile.size });
      toast.success('Recording uploaded. Transcription will begin shortly.');
      void utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
      onUploadComplete();
      setSelectedFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="audio/*,video/*"
        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        className="flex-1 text-sm text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
      />
      {selectedFile && (
        <Button size="sm" onClick={handleUpload} disabled={uploading}>
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="h-3.5 w-3.5 mr-1" /> Upload</>
          )}
        </Button>
      )}
    </div>
  );
}

export function PhaseProcessing({ session, campaignId, onUploadComplete }: PhaseProcessingProps) {
  return (
    <div className="stone-card glass-panel">
      <div className="stone-card-header">
        <span className="stone-card-title text-sm">Session Recording</span>
      </div>
      <div className="stone-card-body space-y-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Record live</p>
          <AudioRecorder
            sessionId={session.id}
            campaignId={campaignId}
            onUploadComplete={onUploadComplete}
          />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-border/40" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">or</span>
          <div className="flex-1 border-t border-border/40" />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Upload a file</p>
          <FileUploader sessionId={session.id} onUploadComplete={onUploadComplete} />
        </div>
      </div>
    </div>
  );
}
