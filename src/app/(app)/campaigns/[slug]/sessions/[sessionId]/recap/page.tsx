'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, RefreshCw, ScrollText, Copy, CheckCircle2, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

const STYLES = [
  { key: 'NARRATIVE' as const, label: 'Narrative' },
  { key: 'SESSION_LOG' as const, label: 'Session Log' },
  { key: 'BARDS_TALE' as const, label: "Bard's Tale" },
  { key: 'PREVIOUSLY_ON' as const, label: 'Previously On\u2026' },
];

type StyleKey = 'NARRATIVE' | 'SESSION_LOG' | 'BARDS_TALE' | 'PREVIOUSLY_ON';

export default function RecapPage() {
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const { campaignId } = useCampaign();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [activeStyle, setActiveStyle] = useState<StyleKey>('NARRATIVE');
  const [copied, setCopied] = useState(false);
  const [localSections, setLocalSections] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [regenKey, setRegenKey] = useState<string | null>(null);
  const [regenNote, setRegenNote] = useState('');

  const { data: session } = trpc.sessions.getById.useQuery(
    { id: sessionId },
    { staleTime: 60_000 }
  );

  const { data: recaps } = trpc.recap.getBySession.useQuery(
    { campaignId, sessionId },
    {
      refetchInterval: (query) => {
        const data = query.state.data as Array<{ status: string }> | undefined;
        return data?.some((r) => r.status === 'GENERATING') ? 3000 : false;
      },
    }
  );

  const generateMutation = trpc.recap.generate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
    onError: (e) => toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }),
  });

  const regenerateMutation = trpc.recap.regenerate.useMutation({
    onSuccess: () => void utils.recap.getBySession.invalidate({ campaignId, sessionId }),
    onError: (e) => toast({ title: 'Regeneration failed', description: e.message, variant: 'destructive' }),
  });

  const regenSectionMutation = trpc.recap.regenSection.useMutation({
    onSuccess: (data) => {
      if (regenKey) {
        setLocalSections((prev) => ({ ...prev, [regenKey]: data.content }));
      }
      setRegenKey(null);
      setRegenNote('');
    },
    onError: (e) => {
      setRegenKey(null);
      toast({ title: 'Regen failed', description: e.message, variant: 'destructive' });
    },
  });

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const shareToDiscordMutation = trpc.recap.shareToDiscord.useMutation({
    onSuccess: () => {
      setShareDialogOpen(false);
      toast({ title: 'Posted to Discord' });
    },
    onError: (e) => {
      setShareDialogOpen(false);
      const msg =
        e.message === 'NO_CHANNEL_LINKED'
          ? 'No Discord channel linked. Go to Campaign Settings → Discord Integration.'
          : e.message;
      toast({ title: 'Share failed', description: msg, variant: 'destructive' });
    },
  });

  const updateSectionsMutation = trpc.recap.updateSections.useMutation({
    onSuccess: () => {
      setLocalSections({});
      setEditingKey(null);
      void utils.recap.getBySession.invalidate({ campaignId, sessionId });
    },
    onError: (e) =>
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' }),
  });

  const s = session as any;
  const transcriptId = (s?.transcripts as Array<{ id: string }> | undefined)?.[0]?.id;
  const sessionTitle = s?.title ?? (s?.sessionNumber != null ? `Session ${s.sessionNumber}` : '…');

  const activeRecap =
    recaps?.find((r) => r.style === activeStyle && r.status === 'AUTO_GENERATED') ??
    recaps?.find((r) => r.style === activeStyle);

  const isGenerating = activeRecap?.status === 'GENERATING';
  const isStuck =
    isGenerating &&
    activeRecap &&
    Date.now() - (activeRecap.createdAt as Date).getTime() > 5 * 60 * 1000;

  const sections = activeRecap?.sections as
    | Array<{ key: string; title: string; content: string }>
    | undefined;

  const isDirty =
    sections?.some(
      (s) => s.key in localSections && localSections[s.key] !== s.content
    ) ?? false;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const effectiveSections = sections?.map((s) => ({
    ...s,
    content: s.key in localSections ? localSections[s.key]! : s.content,
  }));

  const handleGenerate = () => {
    if (!transcriptId) return;
    generateMutation.mutate({ campaignId, sessionId, transcriptId, style: activeStyle });
  };

  const handleRegenerate = () => {
    if (!activeRecap) return;
    regenerateMutation.mutate({ campaignId, recapId: activeRecap.id as string, style: activeStyle });
  };

  const handleCopyMarkdown = async () => {
    if (!activeRecap) return;
    try {
      const result = await utils.recap.exportMarkdown.fetch({
        campaignId,
        recapId: activeRecap.id as string,
      });
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast({ title: 'Export failed', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="px-6 py-8 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/campaigns/${slug}/sessions/${sessionId}`}
          className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
          style={{ color: 'hsl(35 10% 42%)' }}
        >
          <ArrowLeft className="h-3 w-3" /> {sessionTitle}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className="text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'hsl(35 80% 48%)' }}
            >
              Session Recap
            </span>
            <h1
              className="font-display text-2xl font-bold mt-0.5"
              style={{ color: 'hsl(35 20% 90%)' }}
            >
              {sessionTitle}
            </h1>
            {s?.date && (
              <p className="text-xs mt-0.5" style={{ color: 'hsl(35 10% 45%)' }}>
                {format(new Date(s.date as string), 'd MMM yyyy')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-1">
            {activeRecap &&
              ['AUTO_GENERATED', 'REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  style={
                    activeRecap.status === 'REVIEWED'
                      ? { borderColor: 'hsl(35 60% 35%)', color: 'hsl(35 70% 58%)' }
                      : {}
                  }
                  onClick={() => {
                    setEditingKey(null);
                    updateSectionsMutation.mutate({
                      campaignId,
                      recapId: activeRecap.id as string,
                      sections: effectiveSections ?? [],
                      status: 'REVIEWED',
                    });
                  }}
                  disabled={updateSectionsMutation.isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  style={
                    activeRecap.status === 'QUICK_FIRE'
                      ? { borderColor: 'hsl(50 80% 40%)', color: 'hsl(50 80% 62%)' }
                      : {}
                  }
                  onClick={() => {
                    setEditingKey(null);
                    updateSectionsMutation.mutate({
                      campaignId,
                      recapId: activeRecap.id as string,
                      sections: effectiveSections ?? [],
                      status: 'QUICK_FIRE',
                    });
                  }}
                  disabled={updateSectionsMutation.isPending}
                >
                  Quick-fire
                </Button>
              </>
            )}
            {activeRecap &&
              ['REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShareDialogOpen(true)}
                disabled={isDirty}
                title={isDirty ? 'Save changes first (Approve or Quick-fire)' : undefined}
              >
                <MessageSquare className="h-3 w-3" /> Share to Discord
              </Button>
            )}
            {activeRecap?.status === 'AUTO_GENERATED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void handleCopyMarkdown()}
                  disabled={copied}
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Export MD'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleRegenerate}
                  disabled={regenerateMutation.isPending || isGenerating}
                >
                  <RefreshCw className="h-3 w-3" /> Regenerate
                </Button>
              </>
            )}
            {!activeRecap && transcriptId && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                <ScrollText className="h-3 w-3" /> Generate
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Amber rule */}
      <div
        className="h-px"
        style={{ background: 'linear-gradient(90deg, hsl(35 60% 28%) 0%, transparent 60%)' }}
      />

      {/* Style picker */}
      <div className="flex gap-2 flex-wrap">
        {STYLES.map((style) => {
          const bestRecap =
            recaps?.find((r) => r.style === style.key && r.status === 'QUICK_FIRE') ??
            recaps?.find((r) => r.style === style.key && r.status === 'REVIEWED') ??
            recaps?.find((r) => r.style === style.key && r.status === 'AUTO_GENERATED');
          const dotColor = bestRecap
            ? bestRecap.status === 'QUICK_FIRE'
              ? 'bg-yellow-400/70'
              : bestRecap.status === 'REVIEWED'
              ? 'bg-amber-500/60'
              : 'bg-green-500/60'
            : null;
          const isActive = activeStyle === style.key;
          return (
            <button
              key={style.key}
              onClick={() => setActiveStyle(style.key)}
              className="px-3 py-1.5 rounded-sm text-xs font-medium transition-colors"
              style={{
                background: isActive ? 'hsl(35 80% 18%)' : 'hsl(240 10% 11%)',
                border: `1px solid ${isActive ? 'hsl(35 60% 30%)' : 'hsl(240 10% 20%)'}`,
                color: isActive
                  ? 'hsl(35 80% 70%)'
                  : bestRecap
                  ? 'hsl(35 20% 60%)'
                  : 'hsl(35 5% 40%)',
              }}
            >
              {style.label}
              {dotColor && !isActive && (
                <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Stuck state */}
      {isStuck && (
        <div className="rounded-sm border border-destructive/30 px-6 py-8 text-center">
          <p className="text-sm text-destructive">Generation timed out.</p>
          {transcriptId && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {/* Generating skeletons */}
      {isGenerating && !isStuck && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-sm border border-border/40 px-6 py-5"
              style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
            >
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
          <div className="flex items-center gap-2 justify-center pt-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ color: 'hsl(35 80% 55%)' }} />
            <span className="text-xs" style={{ color: 'hsl(35 10% 48%)' }}>
              Generating recap…
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!activeRecap && !isStuck && !generateMutation.isPending && (
        <div
          className="rounded-sm border border-border/40 px-6 py-12 text-center"
          style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
        >
          <ScrollText className="h-8 w-8 mx-auto mb-3" style={{ color: 'hsl(35 10% 30%)' }} />
          <p className="text-sm" style={{ color: 'hsl(35 10% 42%)' }}>
            No {STYLES.find((s) => s.key === activeStyle)?.label} recap yet.
          </p>
          {transcriptId ? (
            <Button size="sm" className="mt-4" onClick={handleGenerate}>
              <ScrollText className="h-3.5 w-3.5 mr-1.5" /> Generate
            </Button>
          ) : (
            <p className="mt-2 text-xs" style={{ color: 'hsl(35 5% 30%)' }}>
              Transcribe a session recording first.
            </p>
          )}
        </div>
      )}

      {/* Recap sections */}
      {activeRecap &&
        ['AUTO_GENERATED', 'REVIEWED', 'QUICK_FIRE'].includes(activeRecap.status as string) &&
        effectiveSections &&
        effectiveSections.length > 0 && (
        <div className="space-y-4">
          {effectiveSections.map((section) => {
            const isEditing = editingKey === section.key;
            return (
              <div
                key={section.key}
                className="rounded-sm border border-border/40 overflow-hidden"
                style={{ background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 9%) 100%)' }}
              >
                <div className="px-6 py-3.5 border-b border-border/20 flex items-center justify-between">
                  <span
                    className="text-[10px] uppercase tracking-widest font-semibold"
                    style={{ color: 'hsl(35 80% 48%)' }}
                  >
                    {section.title}
                  </span>
                  <button
                    onClick={() => setEditingKey(isEditing ? null : section.key)}
                    className="text-[10px] transition-opacity opacity-40 hover:opacity-80"
                    style={{ color: 'hsl(35 20% 68%)' }}
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                <div className="px-6 py-5">
                  {isEditing ? (
                    <>
                      <textarea
                        autoFocus
                        value={section.content}
                        onChange={(e) =>
                          setLocalSections((prev) => ({ ...prev, [section.key]: e.target.value }))
                        }
                        className="w-full min-h-[120px] bg-transparent text-sm leading-relaxed resize-y outline-none"
                        style={{ color: 'hsl(35 15% 72%)', border: '1px solid hsl(35 30% 22%)', borderRadius: 2, padding: '8px 10px' }}
                      />
                      <div className="mt-3 flex gap-2 items-start">
                        <input
                          type="text"
                          placeholder="DM note for regen (optional)"
                          value={regenKey === section.key ? regenNote : ''}
                          onChange={(e) => {
                            setRegenKey(section.key);
                            setRegenNote(e.target.value);
                          }}
                          className="flex-1 bg-transparent text-xs outline-none px-2 py-1.5 rounded-sm"
                          style={{ border: '1px solid hsl(35 20% 20%)', color: 'hsl(35 10% 55%)' }}
                        />
                        <button
                          onClick={() => {
                            setRegenKey(section.key);
                            regenSectionMutation.mutate({
                              campaignId,
                              recapId: activeRecap!.id as string,
                              sectionKey: section.key,
                              dmNote: regenNote || undefined,
                            });
                          }}
                          disabled={regenSectionMutation.isPending && regenKey === section.key}
                          className="text-xs px-3 py-1.5 rounded-sm transition-opacity disabled:opacity-40"
                          style={{ background: 'hsl(35 50% 16%)', border: '1px solid hsl(35 40% 24%)', color: 'hsl(35 70% 58%)' }}
                        >
                          {regenSectionMutation.isPending && regenKey === section.key ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            'Regen'
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap cursor-text"
                      style={{ color: 'hsl(35 15% 72%)' }}
                      onClick={() => setEditingKey(section.key)}
                    >
                      {section.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: 'hsl(35 20% 88%)' }}>Share to Discord</DialogTitle>
            <DialogDescription style={{ color: 'hsl(35 5% 48%)' }}>
              This recap will be posted to your linked Discord channel.
            </DialogDescription>
          </DialogHeader>
          <div
            className="rounded-sm border border-border/30 px-4 py-3 max-h-48 overflow-y-auto text-xs leading-relaxed"
            style={{ background: 'hsl(240 10% 9%)', color: 'hsl(35 10% 60%)' }}
          >
            <p className="font-semibold mb-2" style={{ color: 'hsl(35 20% 78%)' }}>
              {sessionTitle}
            </p>
            {effectiveSections?.slice(0, 2).map((s) => (
              <div key={s.key} className="mb-2">
                <p
                  className="font-semibold text-[10px] uppercase tracking-widest mb-1"
                  style={{ color: 'hsl(35 60% 42%)' }}
                >
                  {s.title}
                </p>
                <p className="line-clamp-3">{s.content}</p>
              </div>
            ))}
            {(effectiveSections?.length ?? 0) > 2 && (
              <p className="opacity-50 italic">
                + {(effectiveSections?.length ?? 0) - 2} more sections…
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShareDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                shareToDiscordMutation.mutate({
                  campaignId,
                  recapId: activeRecap!.id as string,
                })
              }
              disabled={shareToDiscordMutation.isPending}
            >
              {shareToDiscordMutation.isPending ? 'Posting…' : 'Post to Discord'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
