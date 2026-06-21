'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { SceneCreateForm } from '@/components/scenes/SceneCreateForm';
import { SceneLoading } from '@/components/scenes/SceneLoading';
import { NoteBoard } from '@/components/scenes/NoteBoard';
import { EMPTY_SCENE_FORM, type SceneFormState } from '@/components/scenes/scene-types';

const mono = 'font-[family-name:var(--qd-font-mono)]';

type Phase = { kind: 'idle' } | { kind: 'compose' } | { kind: 'loading' } | { kind: 'stage'; id: string };

interface SceneRow {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  isPresented: boolean;
  orderIndex: number;
}

/** Glyph for each scene type */
function typeGlyph(type: string): string {
  switch (type) {
    case 'battle':    return '⚔';
    case 'tavern':    return '⚱';
    case 'rp':        return '◈';
    case 'theatre':   return '◉';
    case 'description': return '◎';
    default:          return '◈';
  }
}

/** Status badge for ON DISPLAY / QUEUED */
function StatusBadge({ isPresented }: { isPresented: boolean }) {
  if (isPresented) {
    return (
      <span
        className={`${mono} flex-none text-[8px] uppercase tracking-[0.12em]`}
        style={{ color: 'var(--qd-accent-text)' }}
      >
        ● ON DISPLAY
      </span>
    );
  }
  return (
    <span
      className={`${mono} flex-none text-[8px] uppercase tracking-[0.1em]`}
      style={{ color: 'var(--qd-ink-faint)' }}
    >
      QUEUED
    </span>
  );
}

/** A single reveal-card in the broadcast deck */
function BroadcastCard({
  scene,
  onSend,
  onHide,
  onEdit,
  sendPending,
  clearPending,
}: {
  scene: SceneRow;
  onSend: () => void;
  onHide: () => void;
  onEdit: () => void;
  sendPending: boolean;
  clearPending: boolean;
}) {
  const isOn = scene.isPresented;

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
      {/* left accent rail */}
      <span
        style={{
          width: '10px',
          borderRadius: '4px',
          flexShrink: 0,
          background: isOn
            ? 'repeating-linear-gradient(0deg,rgba(217,138,61,.55) 0 2px,transparent 2px 5px)'
            : 'rgba(255,255,255,.05)',
        }}
      />

      {/* card body */}
      <div
        className="flex flex-1 flex-col rounded-qd-lg border p-3.5 transition-colors"
        style={
          isOn
            ? {
                borderColor: 'var(--qd-border-accent)',
                background: 'rgba(217,138,61,.08)',
                boxShadow: '0 0 20px rgba(217,138,61,.10)',
              }
            : {
                borderColor: 'var(--qd-border-faint)',
                background: 'rgba(0,0,0,.18)',
              }
        }
      >
        {/* header row */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span
              className={`${mono} text-[9px] uppercase tracking-[0.12em]`}
              style={{ color: isOn ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}
            >
              {typeGlyph(scene.type)} {scene.type}
            </span>
          </span>
          <StatusBadge isPresented={isOn} />
        </div>

        {/* title */}
        <div
          className="mt-2 font-qd-display text-[15px]"
          style={{ color: isOn ? 'var(--qd-ink-strong)' : 'var(--qd-ink-2)' }}
        >
          {scene.title}
        </div>

        {/* snippet */}
        {scene.description && (
          <div
            className="mt-1 line-clamp-2 text-[12px] leading-snug"
            style={{ color: 'var(--qd-ink-muted)' }}
          >
            {scene.description}
          </div>
        )}

        {/* actions */}
        <div className="mt-3 flex items-center gap-2">
          {isOn ? (
            <button
              onClick={onHide}
              disabled={clearPending}
              className={`${mono} rounded-qd-md border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50`}
              style={{
                borderColor: 'rgba(255,255,255,.14)',
                background: 'rgba(255,255,255,.04)',
                color: 'var(--qd-ink-2)',
              }}
            >
              {clearPending ? 'Clearing…' : 'Hide / Clear'}
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={sendPending}
              className={`${mono} flex-1 rounded-qd-md border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50`}
              style={{
                borderColor: 'rgba(217,138,61,.45)',
                background: 'rgba(217,138,61,.10)',
                color: 'var(--qd-accent-text)',
              }}
            >
              {sendPending ? 'Sending…' : 'Send to Players ▸'}
            </button>
          )}
          <button
            onClick={onEdit}
            className={`${mono} rounded-qd-md border px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors`}
            style={{
              borderColor: 'var(--qd-border-strong)',
              background: 'rgba(255,255,255,.02)',
              color: 'var(--qd-ink-muted)',
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact "now showing" banner displayed when a scene is presented */
function NowShowingBanner({ scene }: { scene: SceneRow }) {
  return (
    <div
      className={`${mono} flex items-center gap-2.5 rounded-qd-md border px-3 py-2 text-[10px] uppercase tracking-[0.14em]`}
      style={{
        borderColor: 'rgba(217,138,61,.3)',
        background: 'rgba(217,138,61,.06)',
        color: 'var(--qd-accent-text)',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: 'var(--qd-accent-text)',
          boxShadow: '0 0 6px var(--qd-accent-text)',
          flexShrink: 0,
          animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
      <span>Now showing —</span>
      <span className="normal-case font-qd-display text-[11px] tracking-normal" style={{ color: 'var(--qd-ink-strong)' }}>
        {scene.title}
      </span>
    </div>
  );
}

export default function ScenesPage() {
  const { campaignId, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const scenes = trpc.scenes.list.useQuery({ campaignId }, { staleTime: 30_000 });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SceneFormState>(EMPTY_SCENE_FORM);

  const invalidateList = () => utils.scenes.list.invalidate({ campaignId });

  const generate = trpc.scenes.generate.useMutation({
    onSuccess: (scene) => {
      invalidateList();
      setSelectedId(scene.id);
      setPhase({ kind: 'stage', id: scene.id });
      setForm(EMPTY_SCENE_FORM);
    },
    onError: () => setPhase({ kind: 'compose' }),
  });

  const present = trpc.scenes.present.useMutation({
    onSuccess: invalidateList,
  });

  const clearPresented = trpc.scenes.clearPresented.useMutation({
    onSuccess: invalidateList,
  });

  const rows = (scenes.data as SceneRow[] | undefined) ?? [];
  const presentedScene = rows.find((s) => s.isPresented) ?? null;

  const stageId =
    phase.kind === 'stage'
      ? phase.id
      : selectedId ?? rows[0]?.id ?? null;

  const onCreate = (f: SceneFormState) => {
    setPhase({ kind: 'loading' });
    generate.mutate({
      campaignId,
      title: f.title.trim() || undefined,
      description: f.description.trim(),
      type: f.mood ?? undefined,
      linkedEntityIds: f.linkedEntityIds,
      partyPresentIds: f.partyPresentIds,
    });
  };

  if (scenes.isLoading) return <div className="px-8 py-16 text-qd-ink-muted">Setting the stage…</div>;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Scenes</div>
          <div className={`${mono} text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>
            {rows.length} scenes · Theatre of the Mind
          </div>
        </div>
        <span className="flex-1" />
        {isDM && (
          <button
            onClick={() => {
              setForm(EMPTY_SCENE_FORM);
              setPhase({ kind: 'compose' });
              setSelectedId(null);
            }}
            className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent"
          >
            + New Scene
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Left: Broadcast Deck ────────────────────────────────── */}
        <aside className="flex w-[300px] flex-none flex-col border-r border-qd-faint bg-[rgba(0,0,0,0.22)]">
          {/* Deck header */}
          <div className="border-b border-qd-faint px-4 py-3">
            <div className="font-qd-display text-[13px] text-qd-ink-strong">Broadcast Deck</div>
            <div className={`${mono} mt-0.5 text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>
              Push a scene to the player display
            </div>
          </div>

          {/* Now-showing banner */}
          {presentedScene && (
            <div className="px-3 pt-3">
              <NowShowingBanner scene={presentedScene} />
            </div>
          )}

          {/* Scene cards */}
          <div className="flex flex-1 flex-col gap-2.5 overflow-auto p-3">
            {rows.length === 0 && (
              <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">
                No scenes set. The stage is dark.
              </p>
            )}
            {rows.map((s) => (
              <BroadcastCard
                key={s.id}
                scene={s}
                sendPending={present.isPending && present.variables?.id === s.id}
                clearPending={clearPresented.isPending}
                onSend={() => {
                  present.mutate({ campaignId, id: s.id });
                }}
                onHide={() => {
                  clearPresented.mutate({ campaignId });
                }}
                onEdit={() => {
                  setSelectedId(s.id);
                  setPhase({ kind: 'stage', id: s.id });
                }}
              />
            ))}
          </div>
        </aside>

        {/* ── Right: Scene detail / compose / notes ───────────────── */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {phase.kind === 'compose' ? (
              <motion.div
                key="compose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-6"
              >
                {generate.isError && (
                  <p className="mx-auto mb-3 max-w-xl text-qd-body-sm text-qd-danger-bright">
                    The vision wouldn&apos;t hold — try again.
                  </p>
                )}
                <SceneCreateForm
                  campaignId={campaignId}
                  form={form}
                  onChange={setForm}
                  pending={generate.isPending}
                  onSubmit={() => onCreate(form)}
                  onCancel={() => setPhase({ kind: 'idle' })}
                />
              </motion.div>
            ) : phase.kind === 'loading' ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <SceneLoading />
              </motion.div>
            ) : stageId ? (
              <motion.div
                key={stageId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <NoteBoard campaignId={campaignId} sceneId={stageId} />
              </motion.div>
            ) : (
              <p key="empty" className="p-6 text-qd-ink-muted">
                Choose a scene from the deck, or create a new one.
              </p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
