'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { CampaignCard } from '@/components/recap/campaign-card';
import { SessionListItem } from '@/components/recap/session-list-item';
import { RecapViewer } from '@/components/recap/recap-viewer';
import { RecapStats } from '@/components/recap/recap-stats';
import { PendingBadge } from '@/components/recap/pending-badge';
import { DiscordPreview } from '@/components/recap/discord-preview';
import { StyleSelector } from '@/components/recap/style-selector';
import type { RecapStyle, RecapStatus } from '@prisma/client';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2
        className="text-[10px] uppercase tracking-[0.2em]"
        style={{ color: 'hsl(35 40% 42%)', fontFamily: 'var(--font-cinzel)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Divider() {
  return (
    <div
      className="h-px"
      style={{ background: 'linear-gradient(to right, transparent, hsl(35 20% 20% / 0.5), transparent)' }}
    />
  );
}

export default function RecapDemoPage() {
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<RecapStyle>('NARRATIVE');
  const [charLimit, setCharLimit] = useState<2000 | 3000>(2000);
  const [threadMode, setThreadMode] = useState(false);
  const [localSections, setLocalSections] = useState<Record<string, string>>({});

  // Real data
  const { data: dashboard, isLoading: dashLoading } = trpc.recap.getDashboard.useQuery();
  const { data: recentData, isLoading: recentLoading } = trpc.recap.getRecentAcrossCampaigns.useQuery({
    limit: 10,
  });

  const campaigns = dashboard ?? [];
  const recentItems = recentData?.items ?? [];

  // Totals for stats
  const totalSessions = campaigns.reduce((s, c) => s + c.totalRecaps, 0);
  const totalPending = campaigns.reduce((s, c) => s + c.pendingReview, 0);

  // Pick first recap with sections for viewer demo
  const firstRecap = recentItems[0];
  const { data: recapDetail } = trpc.recap.getBySession.useQuery(
    { campaignId: firstRecap?.campaignId ?? '', sessionId: firstRecap?.sessionId ?? '' },
    { enabled: !!firstRecap },
  );
  const activeRecap = recapDetail?.[0];
  const rawSections = (activeRecap?.sections ?? []) as Array<{
    key: string;
    title: string;
    content: string;
  }>;
  const effectiveSections = rawSections.map((s) => ({
    ...s,
    content: localSections[s.key] ?? s.content,
  }));

  const updateMutation = trpc.recap.updateSections.useMutation();
  const regenMutation = trpc.recap.regenSection.useMutation();
  const [regenningKeys, setRegenningKeys] = useState<Set<string>>(new Set());

  return (
    <div
      className="min-h-screen p-8 space-y-10 max-w-4xl mx-auto"
      style={{ background: 'hsl(240 8% 8%)' }}
    >
      {/* Header */}
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.2em] mb-1"
          style={{ color: 'hsl(35 60% 42%)', fontFamily: 'var(--font-cinzel)' }}
        >
          RecapForge
        </p>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 20% 88%)' }}
        >
          Live Component Test
        </h1>
        <p className="text-xs mt-1" style={{ color: 'hsl(35 5% 40%)' }}>
          Real data from your DB · <code className="text-[11px]">src/components/recap/</code>
        </p>
      </div>

      <Divider />

      {/* PendingBadge */}
      <Section title="PendingBadge">
        <div className="flex items-center gap-4">
          <PendingBadge count={0} />
          <PendingBadge count={totalPending} />
          <span className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>
            {totalPending} pending across your campaigns (live)
          </span>
        </div>
      </Section>

      <Divider />

      {/* RecapStats — live */}
      <Section title="RecapStats (live)">
        {dashLoading ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>Loading…</p>
        ) : (
          <RecapStats
            totalHoursTranscribed={0}
            totalSessions={totalSessions}
            pendingReviews={totalPending}
          />
        )}
      </Section>

      <Divider />

      {/* StyleSelector */}
      <Section title="StyleSelector">
        <StyleSelector
          activeStyle={activeStyle}
          onChange={setActiveStyle}
          bestStatus={
            firstRecap
              ? { [firstRecap.style ?? 'NARRATIVE']: firstRecap.status as RecapStatus }
              : undefined
          }
        />
      </Section>

      <Divider />

      {/* CampaignCards — live */}
      <Section title="CampaignCard (live)">
        {dashLoading ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>No campaigns found.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.campaignId}
                campaign={{
                  id: c.campaignId,
                  name: c.campaignName,
                  slug: c.slug,
                  totalRecaps: c.totalRecaps,
                  pendingReview: c.pendingReview,
                  lastRecapDate: c.lastRecapDate ? new Date(c.lastRecapDate as unknown as string) : null,
                  lastSessionTitle: c.lastSessionTitle,
                }}
                isActive={activeCampaignId === c.campaignId}
                onClick={() =>
                  setActiveCampaignId(activeCampaignId === c.campaignId ? null : c.campaignId)
                }
              />
            ))}
          </div>
        )}
      </Section>

      <Divider />

      {/* SessionListItem — live */}
      <Section title="SessionListItem (live — 10 most recent)">
        {recentLoading ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>Loading…</p>
        ) : recentItems.length === 0 ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>No recaps found.</p>
        ) : (
          <div
            className="rounded-sm overflow-hidden"
            style={{ border: '1px solid hsl(35 10% 16% / 0.5)' }}
          >
            {recentItems.map((s) => (
              <SessionListItem
                key={s.recapId}
                session={{
                  ...s,
                  sessionTitle: s.sessionTitle,
                  sessionNumber: null,
                  sessionDate: new Date(s.sessionDate as unknown as string),
                }}
                showCampaignName
              />
            ))}
          </div>
        )}
      </Section>

      <Divider />

      {/* RecapViewer — live (first recap) */}
      <Section title={`RecapViewer (live${activeRecap ? ` — ${firstRecap?.sessionTitle}` : ' — loading first recap…'})`}>
        {!activeRecap ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>
            {recentItems.length === 0 ? 'No recaps available.' : 'Loading recap…'}
          </p>
        ) : (
          <RecapViewer
            recapId={activeRecap.id as string}
            sections={effectiveSections}
            activeStyle={activeStyle}
            status={activeRecap.status as RecapStatus}
            isDirty={rawSections.some(
              (s) => localSections[s.key] !== undefined && localSections[s.key] !== s.content,
            )}
            isApproving={updateMutation.isPending}
            isSharing={false}
            regenningKeys={regenningKeys}
            onStyleChange={setActiveStyle}
            onSectionChange={(key, content) =>
              setLocalSections((prev) => ({ ...prev, [key]: content }))
            }
            onApprove={(status) => {
              void updateMutation.mutateAsync({
                campaignId: firstRecap!.campaignId,
                recapId: activeRecap.id as string,
                sections: effectiveSections,
                status,
              });
            }}
            onShare={() => {}}
            onCopyMarkdown={() => {
              const text = effectiveSections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
              void navigator.clipboard.writeText(text);
            }}
            onExportMarkdown={() => {
              const text = effectiveSections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
              const blob = new Blob([text], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${firstRecap?.sessionTitle ?? 'recap'}.md`;
              a.click();
            }}
            onRegenSection={(key, dmNote) => {
              setRegenningKeys((prev) => new Set([...prev, key]));
              void regenMutation
                .mutateAsync({
                  campaignId: firstRecap!.campaignId,
                  recapId: activeRecap.id as string,
                  sectionKey: key,
                  dmNote: dmNote || undefined,
                })
                .then(({ content }) => {
                  setLocalSections((prev) => ({ ...prev, [key]: content }));
                })
                .finally(() => {
                  setRegenningKeys((prev) => {
                    const next = new Set(prev);
                    next.delete(key);
                    return next;
                  });
                });
            }}
          />
        )}
      </Section>

      <Divider />

      {/* DiscordPreview — live content */}
      <Section title="DiscordPreview (live content)">
        {effectiveSections.length === 0 ? (
          <p className="text-xs" style={{ color: 'hsl(35 5% 38%)' }}>No recap loaded.</p>
        ) : (
          <div className="max-w-lg">
            <DiscordPreview
              sessionTitle={firstRecap?.sessionTitle ?? 'Session Recap'}
              sections={effectiveSections}
              charLimit={charLimit}
              threadMode={threadMode}
              isPending={false}
              onCharLimitChange={setCharLimit}
              onThreadModeChange={setThreadMode}
              onShare={() => alert('This is a demo — real share uses the recap page.')}
              onCancel={() => {}}
            />
          </div>
        )}
      </Section>
    </div>
  );
}
