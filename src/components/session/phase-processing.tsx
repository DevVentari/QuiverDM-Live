'use client';

import { AudioRecorder } from '@/components/session/audio-recorder';

interface PhaseProcessingProps {
  session: { id: string };
  campaignId: string;
  onUploadComplete: () => void;
}

export function PhaseProcessing({ session, campaignId, onUploadComplete }: PhaseProcessingProps) {
  return (
    <div className="space-y-4">
      <div className="stone-card glass-panel">
        <div className="stone-card-header">
          <span className="stone-card-title text-sm">Upload Recording</span>
        </div>
        <div className="stone-card-body">
          <p className="text-sm text-muted-foreground mb-4">
            Upload your session audio to generate a transcript and AI summary. Multi-track files are supported.
          </p>
          <AudioRecorder
            sessionId={session.id}
            campaignId={campaignId}
            onUploadComplete={onUploadComplete}
          />
        </div>
      </div>
    </div>
  );
}
