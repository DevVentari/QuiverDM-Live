'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { MultiTrackDropzone } from '@/components/recap/multi-track-dropzone';
import { MultiTrackProgress } from '@/components/recap/multi-track-progress';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';

type Step = 'campaign' | 'upload' | 'processing';

export default function RecapUploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('campaign');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [uploadGroupId, setUploadGroupId] = useState<string>('');

  const { data: dashboard, isLoading: dashLoading } = trpc.recap.getDashboard.useQuery();
  const createSession = trpc.sessions.create.useMutation();

  const campaigns = dashboard ?? [];
  const selectedCampaign = campaigns.find((c) => c.campaignId === selectedCampaignId);

  async function handleStartUpload() {
    if (!selectedCampaignId) return;
    const now = new Date();
    const title = `Session — ${now.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const session = await createSession.mutateAsync({
      campaignId: selectedCampaignId,
      title,
      status: 'in_progress',
    });
    setSessionId(session.id);
    setStep('upload');
  }

  function handleUploadComplete(groupId: string) {
    setUploadGroupId(groupId);
    setStep('processing');
  }

  function handleProcessingComplete() {
    router.push(`/campaigns/${selectedCampaign!.slug}/sessions/${sessionId}/recap`);
  }

  return (
    <div className="min-h-screen" style={{ background: 'hsl(240 8% 8%)' }}>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/recap">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs px-2">
              <ArrowLeft className="h-3 w-3" /> Recaps
            </Button>
          </Link>
          <div
            className="h-4 w-px"
            style={{ background: 'hsl(35 10% 20%)' }}
          />
          <p
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: 'hsl(35 40% 42%)', fontFamily: 'var(--font-cinzel)' }}
          >
            New Upload
          </p>
        </div>

        <div>
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 20% 88%)' }}
          >
            Upload Recording
          </h1>
          <p className="text-xs mt-1" style={{ color: 'hsl(35 5% 40%)' }}>
            Upload audio files to transcribe and generate a session recap.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'hsl(35 5% 38%)' }}>
          {(['campaign', 'upload', 'processing'] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: 'hsl(35 10% 25%)' }}>›</span>}
              <span
                style={{
                  color: step === s ? 'hsl(35 60% 56%)' : step > s ? 'hsl(35 5% 45%)' : 'hsl(35 5% 30%)',
                  fontFamily: 'var(--font-bricolage)',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'campaign' ? 'Campaign' : s === 'upload' ? 'Upload' : 'Processing'}
              </span>
            </span>
          ))}
        </div>

        {/* Step: Campaign picker */}
        {step === 'campaign' && (
          <div
            className="rounded-sm p-6 space-y-5"
            style={{
              background: 'hsl(35 10% 10% / 0.7)',
              border: '1px solid hsl(35 15% 18% / 0.5)',
            }}
          >
            <div>
              <label
                className="block text-xs mb-2"
                style={{ color: 'hsl(35 5% 55%)', fontFamily: 'var(--font-bricolage)' }}
              >
                Which campaign is this session for?
              </label>
              {dashLoading ? (
                <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>Loading campaigns…</p>
              ) : campaigns.length === 0 ? (
                <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>
                  No campaigns found.{' '}
                  <Link href="/campaigns/new" className="underline" style={{ color: 'hsl(35 60% 50%)' }}>
                    Create one first.
                  </Link>
                </p>
              ) : (
                <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                  <SelectTrigger
                    className="h-9 text-sm"
                    style={{
                      background: 'hsl(35 10% 8% / 0.8)',
                      border: '1px solid hsl(35 15% 20% / 0.6)',
                      color: 'hsl(35 10% 70%)',
                    }}
                  >
                    <SelectValue placeholder="Select campaign…" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.campaignId} value={c.campaignId}>
                        {c.campaignName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleStartUpload}
              disabled={!selectedCampaignId || createSession.isPending}
            >
              <Upload className="h-4 w-4" />
              {createSession.isPending ? 'Creating session…' : 'Continue to upload'}
            </Button>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && sessionId && (
          <div
            className="rounded-sm p-6 space-y-4"
            style={{
              background: 'hsl(35 10% 10% / 0.7)',
              border: '1px solid hsl(35 15% 18% / 0.5)',
            }}
          >
            <div>
              <p
                className="text-sm font-medium mb-1"
                style={{ fontFamily: 'var(--font-bricolage)', color: 'hsl(35 10% 78%)' }}
              >
                {selectedCampaign?.campaignName}
              </p>
              <p className="text-xs" style={{ color: 'hsl(35 5% 40%)' }}>
                Drop your audio files below. Add speaker names to each track for better attribution.
                For best results, use Craig bot recordings (one file per speaker).
              </p>
            </div>
            <MultiTrackDropzone
              campaignId={selectedCampaignId}
              sessionId={sessionId}
              onComplete={handleUploadComplete}
            />
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && sessionId && uploadGroupId && (
          <div
            className="rounded-sm p-6 space-y-4"
            style={{
              background: 'hsl(35 10% 10% / 0.7)',
              border: '1px solid hsl(35 15% 18% / 0.5)',
            }}
          >
            <div>
              <p
                className="text-sm font-medium mb-1"
                style={{ fontFamily: 'var(--font-bricolage)', color: 'hsl(35 10% 78%)' }}
              >
                Transcribing…
              </p>
              <p className="text-xs" style={{ color: 'hsl(35 5% 40%)' }}>
                This usually takes 1–3 minutes. You can leave this page — processing continues in the background.
              </p>
            </div>
            <MultiTrackProgress
              campaignId={selectedCampaignId}
              sessionId={sessionId}
              uploadGroupId={uploadGroupId}
              onComplete={handleProcessingComplete}
            />
          </div>
        )}
      </div>
    </div>
  );
}
