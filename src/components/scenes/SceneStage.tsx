'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import type { RegenSection } from '@/server/services/scene-generation.service';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const pl = `${mono} mb-2 text-[8px] uppercase tracking-[0.12em]`;

type Check = { skill: string; dc: number; note: string };

export function SceneStage({ campaignId, sceneId }: { campaignId: string; sceneId: string }) {
  const utils = trpc.useUtils();
  const stage = trpc.scenes.getStage.useQuery({ campaignId, id: sceneId });
  const invalidate = () => utils.scenes.getStage.invalidate({ campaignId, id: sceneId });

  const update = trpc.scenes.update.useMutation({ onSuccess: invalidate });
  const present = trpc.scenes.present.useMutation({
    onSuccess: () => {
      invalidate();
      utils.scenes.list.invalidate({ campaignId });
    },
  });
  const clear = trpc.scenes.clearPresented.useMutation({
    onSuccess: () => {
      invalidate();
      utils.scenes.list.invalidate({ campaignId });
    },
  });
  const regenerate = trpc.scenes.regenerate.useMutation({ onSuccess: invalidate });

  if (stage.isLoading) return <div className="px-6 py-12 text-qd-ink-muted">Drawing the scene…</div>;
  if (stage.error || !stage.data) return <div className="px-6 py-12 text-qd-ink-muted">The threads tangled. Try again.</div>;

  const { scene, entities, party } = stage.data;
  const checks = (scene.suggestedChecks as Check[]) ?? [];
  const beats = (scene.entityBeats as Record<string, { wantsInScene: string; secret: string | null }>) ?? {};
  const regenPending = regenerate.isPending;

  const reroll = (section: RegenSection) => regenerate.mutate({ campaignId, id: sceneId, section });

  return (
    <motion.div
      className="grid gap-4 p-6 md:grid-cols-2"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.12 } } }}
    >
      {/* LEFT — player-facing */}
      <Column>
        <span className={`${mono} text-[9px] uppercase tracking-[0.12em] text-qd-accent-text`}>{scene.type}</span>
        <h1 className="mt-1 font-qd-display text-[30px] leading-tight text-qd-ink-strong">{scene.title}</h1>

        <div className="mt-3 flex gap-2.5">
          {scene.isPresented ? (
            <button
              onClick={() => clear.mutate({ campaignId })}
              className="rounded-qd-md border border-qd-accent bg-[rgba(217,138,61,0.12)] px-4 py-2 font-qd-display text-[13px] font-bold text-qd-accent-text"
            >
              ● Live — clear
            </button>
          ) : (
            <button
              onClick={() => present.mutate({ campaignId, id: sceneId })}
              className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent"
            >
              Present to players ▸
            </button>
          )}
        </div>

        <SceneArt scene={scene} />

        <EditableBlock
          label="Read aloud"
          value={scene.description ?? ''}
          display={
            <p className="font-qd-display text-qd-narration italic leading-relaxed text-qd-ink">
              {scene.description || 'No narration set.'}
            </p>
          }
          onSave={(v) => update.mutate({ campaignId, id: sceneId, description: v })}
          onRegenerate={() => reroll('readAloud')}
          regenPending={regenPending}
        />

        {scene.musicCue && (
          <div className="mt-3 flex items-center gap-2">
            <span className={`${mono} text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted`}>🎵 cue</span>
            <span className="text-qd-body-sm text-qd-ink-2">{scene.musicCue}</span>
            <button
              onClick={() => reroll('music')}
              disabled={regenPending}
              className="text-qd-ink-faint hover:text-qd-accent-text"
            >
              ⟳
            </button>
          </div>
        )}
      </Column>

      {/* RIGHT — DM only */}
      <Column amber>
        <div className="flex items-center justify-between">
          <div className={`${pl} text-qd-accent-text`}>▸ DM only — the board</div>
          <button
            onClick={() => reroll('all')}
            disabled={regenPending}
            className={`${mono} text-[10px] text-qd-ink-faint hover:text-qd-accent-text`}
          >
            {regenPending ? 'Re-rolling…' : '⟳ Regenerate all'}
          </button>
        </div>

        {party.length > 0 && (
          <div className="mb-3">
            <div className={`${pl} text-qd-ink-muted`}>Party present</div>
            <div className="flex flex-wrap gap-2">
              {party.map((p: { id: string; name: string }) => (
                <span key={p.id} className="rounded-full border border-qd-faint px-2.5 py-1 text-[12px] text-qd-ink-2">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {entities.length > 0 && (
          <div className="mb-3">
            <div className={`${pl} text-qd-ink-muted`}>Cast &amp; locations</div>
            <div className="flex flex-col gap-2">
              {entities.map(
                (e: {
                  id: string;
                  name: string;
                  type: string;
                  description?: string | null;
                  statBlock: { id: string } | null;
                }) => (
                  <NpcCard key={e.id} entity={e} beat={beats[e.id]} />
                ),
              )}
            </div>
          </div>
        )}

        <EditableBlock
          label="Secret beats"
          value={scene.dmNotes ?? ''}
          display={
            <p className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">
              {scene.dmNotes || 'No secret notes.'}
            </p>
          }
          onSave={(v) => update.mutate({ campaignId, id: sceneId, dmNotes: v })}
          onRegenerate={() => reroll('dmNotes')}
          regenPending={regenPending}
        />

        {checks.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className={`${pl} text-qd-ink-muted`}>Possible checks</div>
              <button
                onClick={() => reroll('checks')}
                disabled={regenPending}
                className="mb-2 text-qd-ink-faint hover:text-qd-accent-text"
              >
                ⟳
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {checks.map((c, i) => (
                <span
                  key={i}
                  className="rounded-full border border-qd-faint px-2.5 py-1 text-[11px] text-qd-ink-2"
                  title={c.note}
                >
                  {c.skill} DC {c.dc}
                </span>
              ))}
            </div>
          </div>
        )}
      </Column>
    </motion.div>
  );
}

function Column({ children, amber }: { children: React.ReactNode; amber?: boolean }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
      className="rounded-qd-xl border p-5"
      style={
        amber
          ? {
              borderColor: 'var(--qd-border-accent)',
              background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))',
            }
          : { borderColor: 'var(--qd-border-faint)', background: 'var(--qd-grad-card), var(--qd-card)' }
      }
    >
      {children}
    </motion.div>
  );
}

function SceneArt({ scene }: { scene: { imageUrl: string | null; imageJobId: string | null } }) {
  const job = trpc.homebrewImage.getJobStatus.useQuery(
    { jobId: scene.imageJobId ?? '' },
    { enabled: !scene.imageUrl && !!scene.imageJobId, refetchInterval: 4000 },
  );
  const url = scene.imageUrl ?? job.data?.resultUrl;
  if (url) return <img src={url} alt="" className="mt-4 w-full rounded-qd-lg border border-qd-faint object-cover" />;
  if (scene.imageJobId && job.data?.status !== 'failed')
    return (
      <div className="mt-4 h-40 w-full animate-pulse rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,.03)]" />
    );
  return null;
}

function NpcCard({
  entity,
  beat,
}: {
  entity: { id: string; name: string; type: string; description?: string | null; statBlock: { id: string } | null };
  beat?: { wantsInScene: string; secret: string | null };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-qd-md border border-qd-faint p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-qd-display text-sm text-qd-ink-strong">{entity.name}</span>
        <span className={`${mono} text-[8px] uppercase tracking-wide text-qd-ink-faint`}>{entity.type}</span>
        {entity.statBlock && (
          <button onClick={() => setOpen((o) => !o)} className="ml-auto text-[10px] text-qd-accent-text">
            {open ? 'hide statblock' : 'reveal statblock'}
          </button>
        )}
      </div>
      {beat?.wantsInScene && (
        <p className="mt-1 text-[12px] text-qd-ink-2">
          <span className="text-qd-ink-faint">wants:</span> {beat.wantsInScene}
        </p>
      )}
      {beat?.secret && <p className="mt-0.5 text-[12px] text-qd-accent-text">secret: {beat.secret}</p>}
      {open && entity.statBlock && <StatBlockInline id={entity.statBlock.id} />}
    </div>
  );
}

function StatBlockInline({ id }: { id: string }) {
  // Uses homebrew.getContentById (not getById — that procedure does not exist)
  const sb = trpc.homebrew.getContentById.useQuery({ id }, { staleTime: 300_000 });
  if (sb.isLoading) return <p className="mt-2 text-[11px] text-qd-ink-faint">Summoning…</p>;
  const d = (sb.data?.data as Record<string, unknown> | undefined) ?? {};
  return (
    <div className={`${mono} mt-2 rounded bg-[rgba(0,0,0,.25)] p-2 text-[11px] text-qd-ink-2`}>
      {([['AC', d.ac], ['HP', d.hp], ['CR', d.cr]] as [string, unknown][])
        .filter(([, v]) => v != null)
        .map(([k, v]) => (
          <span key={k} className="mr-3">
            {k} {String(v)}
          </span>
        ))}
    </div>
  );
}

function EditableBlock({
  label,
  value,
  display,
  onSave,
  onRegenerate,
  regenPending,
}: {
  label: string;
  value: string;
  display: React.ReactNode;
  onSave: (v: string) => void;
  onRegenerate: () => void;
  regenPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center gap-2">
        <span className={`${mono} text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted`}>{label}</span>
        <button
          onClick={() => {
            setDraft(value);
            setEditing((e) => !e);
          }}
          className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text"
        >
          ✎ edit
        </button>
        <button onClick={onRegenerate} disabled={regenPending} className="text-[10px] text-qd-ink-faint hover:text-qd-accent-text">
          ⟳ regenerate
        </button>
      </div>
      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-qd-md border border-qd-accent bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink focus:outline-none"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="rounded-qd-md bg-qd-accent px-3 py-1.5 text-[12px] font-bold text-qd-on-accent"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-qd-md border border-qd-strong px-3 py-1.5 text-[12px] text-qd-ink-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        display
      )}
    </div>
  );
}
