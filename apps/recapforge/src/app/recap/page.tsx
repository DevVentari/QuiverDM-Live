'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Masthead } from '@/components/manuscript/Masthead';
import type { RecapContent } from '@quiverdm/shared';

function RecapScreen() {
  const params = useSearchParams();
  const campaignId = params.get('campaign') ?? '';
  const sessionId = params.get('session') ?? '';
  const utils = trpc.useUtils();

  const recap = trpc.forgeRecap.get.useQuery(
    { campaignId, sessionId },
    {
      enabled: !!campaignId && !!sessionId,
      refetchInterval: (q) => (q.state.data?.status === 'generating' ? 4000 : false),
    },
  );
  const status = recap.data?.status;
  const ready = status === 'ready';

  const preview = trpc.forgeRecap.previewHtml.useQuery({ campaignId, sessionId }, { enabled: ready });
  const generate = trpc.forgeRecap.generate.useMutation({ onSuccess: () => utils.forgeRecap.get.invalidate({ campaignId, sessionId }) });
  const update = trpc.forgeRecap.update.useMutation({
    onSuccess: () => { utils.forgeRecap.get.invalidate({ campaignId, sessionId }); utils.forgeRecap.previewHtml.invalidate({ campaignId, sessionId }); },
  });
  const publish = trpc.forgeRecap.publish.useMutation({
    onSuccess: () => utils.forgeRecap.get.invalidate({ campaignId, sessionId }),
  });

  // Local editable copy of the content, synced from the server.
  const [draft, setDraft] = useState<RecapContent | null>(null);
  useEffect(() => { if (recap.data?.content) setDraft(recap.data.content); }, [recap.data?.content]);

  const saveField = (patch: Partial<RecapContent>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    update.mutate({ campaignId, sessionId, content: next });
  };

  return (
    <main className="rf-page">
      <div className="rf-page__inner" style={{ maxWidth: 1180 }}>
        <div className="rf-paper">
          <Masthead
            right={
              ready ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="rf-btn rf-btn--ghost" disabled={generate.isPending}
                    onClick={() => { if (confirm('Regenerate discards your manual edits. Continue?')) generate.mutate({ campaignId, sessionId }); }}>
                    Regenerate
                  </button>
                  <a className="rf-btn rf-btn--solid" href={`/api/recap/download?campaign=${campaignId}&session=${sessionId}`}>
                    Download session file
                  </a>
                  {recap.data?.publishedUrl ? (
                    <>
                      <a className="rf-btn rf-btn--solid" href={recap.data.publishedUrl} target="_blank" rel="noreferrer">Published · view →</a>
                      <button className="rf-btn rf-btn--ghost" disabled={publish.isPending}
                        onClick={() => { if (confirm('Re-publish overwrites the live page. Continue?')) publish.mutate({ campaignId, sessionId }); }}>
                        {publish.isPending ? 'Publishing…' : 'Re-publish'}
                      </button>
                    </>
                  ) : (
                    <button className="rf-btn rf-btn--solid"
                      disabled={!recap.data?.canPublish || publish.isPending}
                      title={recap.data?.canPublish ? undefined : 'No wiki configured for this campaign'}
                      onClick={() => publish.mutate({ campaignId, sessionId })}>
                      {publish.isPending ? 'Publishing…' : 'Publish to the wiki'}
                    </button>
                  )}
                  {(publish.error || recap.data?.publishError) && !publish.isPending && (
                    <span className="rf-masthead__meta" style={{ color: 'var(--rf-mark)' }}>
                      {publish.error?.message ?? recap.data?.publishError} — try again
                    </span>
                  )}
                </div>
              ) : (
                <span className="rf-masthead__meta">
                  {status === 'failed' ? 'the chronicle could not be composed' : 'composing the chronicle…'}
                </span>
              )
            }
          >
            <Link href={`/proof?campaign=${campaignId}&session=${sessionId}`} className="rf-masthead__crumb">← the galley</Link>
          </Masthead>

          {status === 'generating' && (
            <div className="rf-galley__titleblock">
              <div className="rf-eyebrow rf-eyebrow--accent">The chronicler at work</div>
              <h1 className="rf-galley__title">Composing the chronicle</h1>
              <div className="rf-galley__hr" />
              <div className="rf-galley__byline">the session is being distilled into a recap…</div>
            </div>
          )}

          {status === 'failed' && (
            <div className="rf-galley__titleblock">
              <div className="rf-eyebrow">The chronicle faltered</div>
              <h1 className="rf-galley__title">It could not be composed</h1>
              <div className="rf-galley__byline">{recap.data?.error ?? 'Unknown error.'}</div>
              <button className="rf-btn rf-btn--solid" style={{ marginTop: 14 }} onClick={() => generate.mutate({ campaignId, sessionId })}>
                Try again
              </button>
            </div>
          )}

          {ready && draft && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0, minHeight: 640 }}>
              {/* PREVIEW — byte-identical to the download */}
              <iframe title="recap preview" sandbox="allow-same-origin" style={{ width: '100%', height: '100%', minHeight: 640, border: 'none', background: '#0d0c0f' }}
                srcDoc={preview.data ?? '<p style="color:#aaa;padding:24px">rendering…</p>'} />
              {/* EDIT — the structured content */}
              <div style={{ borderLeft: '1px solid var(--rf-rule-dot)', padding: '20px 22px', overflowY: 'auto' }}>
                <div className="rf-eyebrow">Edit the chronicle</div>
                <label className="rf-label">Title</label>
                <input className="rf-input" value={draft.header.title}
                  onChange={(e) => setDraft({ ...draft, header: { ...draft.header, title: e.target.value } })}
                  onBlur={() => saveField({ header: draft.header })} />
                <label className="rf-label">Subtitle</label>
                <input className="rf-input" value={draft.header.subtitle ?? ''}
                  onChange={(e) => setDraft({ ...draft, header: { ...draft.header, subtitle: e.target.value } })}
                  onBlur={() => saveField({ header: draft.header })} />
                <label className="rf-label">Hero image URL (optional)</label>
                <input className="rf-input" value={draft.header.image?.url ?? ''} placeholder="https://…"
                  onChange={(e) => setDraft({ ...draft, header: { ...draft.header, image: e.target.value ? { url: e.target.value, alt: draft.header.image?.alt } : null } })}
                  onBlur={() => saveField({ header: draft.header })} />
                <label className="rf-label">The recap (lede)</label>
                <textarea className="rf-textarea" rows={5} value={draft.lede}
                  onChange={(e) => setDraft({ ...draft, lede: e.target.value })}
                  onBlur={() => saveField({ lede: draft.lede })} />
                <label className="rf-label">Where we left off</label>
                <textarea className="rf-textarea" rows={4} value={draft.panels.whereWeLeftOff}
                  onChange={(e) => setDraft({ ...draft, panels: { ...draft.panels, whereWeLeftOff: e.target.value } })}
                  onBlur={() => saveField({ panels: draft.panels })} />
                <p className="rf-masthead__meta" style={{ marginTop: 16 }}>
                  {update.isPending ? 'saving…' : 'edits save as you go · the preview updates on save'}
                </p>
                <p className="rf-masthead__meta" style={{ marginTop: 8, fontStyle: 'italic' }}>
                  Timeline, NPCs, locations, and adversaries are generated from the session. Regenerate to refresh them, or edit the downloaded file for fine detail. (Full panel editing lands in a later pass.)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function RecapPage() {
  return (
    <Suspense fallback={<main className="rf-page" />}>
      <RecapScreen />
    </Suspense>
  );
}
