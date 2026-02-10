'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Upload, Trash2, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { campaignId, slug, isDM } = useCampaign();
  const sessionId = params.sessionId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const session = trpc.sessions.getById.useQuery({ id: sessionId });
  const recordings = trpc.sessionRecordings.getBySessionId.useQuery({ sessionId });
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => router.push(`/campaigns/${slug}/sessions`),
  });

  const completeSession = trpc.sessions.complete.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', sessionId);
      formData.append('type', file.type.startsWith('video/') ? 'video' : 'audio');

      await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      });

      utils.sessionRecordings.getBySessionId.invalidate({ sessionId });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (session.isLoading) {
    return <Skeleton className="h-64 rounded-lg" />;
  }

  if (!session.data) {
    return <p className="text-destructive">Session not found</p>;
  }

  const data = session.data as any;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {data.title || `Session ${data.sessionNumber || ''}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.createdAt && format(new Date(data.createdAt), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.status && (
            <Badge variant="secondary">{data.status.replace('_', ' ')}</Badge>
          )}
          {isDM && data.status !== 'completed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => completeSession.mutate({ id: sessionId })}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete
            </Button>
          )}
          {isDM && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm('Delete this session?')) {
                  deleteSession.mutate({ id: sessionId });
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Notes */}
      {isDM && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              defaultValue={data.quickNotes || ''}
              placeholder="Session notes..."
              rows={4}
              onBlur={(e) => {
                if (e.target.value !== (data.quickNotes || '')) {
                  updateSession.mutate({
                    id: sessionId,
                    quickNotes: e.target.value,
                  });
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Recap */}
      {data.recap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recap</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{data.recap}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Recordings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recordings</h3>
          {isDM && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Recording'}
              </Button>
            </div>
          )}
        </div>

        {recordings.data && (recordings.data as any[]).length > 0 ? (
          <div className="space-y-2">
            {(recordings.data as any[]).map((rec) => (
              <Card key={rec.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{rec.type} recording</p>
                    <p className="text-xs text-muted-foreground">
                      {rec.durationSeconds
                        ? `${Math.floor(rec.durationSeconds / 60)}m ${rec.durationSeconds % 60}s`
                        : 'Duration unknown'}
                      {rec.processingStatus && ` · ${rec.processingStatus}`}
                    </p>
                  </div>
                  <Badge variant="secondary">{rec.processingStatus || 'pending'}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recordings yet.</p>
        )}
      </div>
    </div>
  );
}
