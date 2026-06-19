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

interface SceneRow { id: string; title: string; type: string; isPresented: boolean }

export default function ScenesPage() {
  const { campaignId, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const scenes = trpc.scenes.list.useQuery({ campaignId }, { staleTime: 30_000 });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<SceneFormState>(EMPTY_SCENE_FORM);

  const generate = trpc.scenes.generate.useMutation({
    onSuccess: (scene) => {
      utils.scenes.list.invalidate({ campaignId });
      setSelectedId(scene.id);
      setPhase({ kind: 'stage', id: scene.id });
      setForm(EMPTY_SCENE_FORM);
    },
    onError: () => setPhase({ kind: 'compose' }),
  });

  const rows = (scenes.data as SceneRow[] | undefined) ?? [];
  const stageId = phase.kind === 'stage' ? phase.id : selectedId ?? rows[0]?.id ?? null;

  const onCreate = (form: SceneFormState) => {
    setPhase({ kind: 'loading' });
    generate.mutate({
      campaignId,
      title: form.title.trim() || undefined,
      description: form.description.trim(),
      type: form.mood ?? undefined,
      linkedEntityIds: form.linkedEntityIds,
      partyPresentIds: form.partyPresentIds,
    });
  };

  if (scenes.isLoading) return <div className="px-8 py-16 text-qd-ink-muted">Setting the stage…</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Scenes</div>
          <div className={`${mono} text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>{rows.length} scenes · Theatre of the Mind</div>
        </div>
        <span className="flex-1" />
        {isDM && (
          <button onClick={() => { setForm(EMPTY_SCENE_FORM); setPhase({ kind: 'compose' }); setSelectedId(null); }}
            className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">+ New Scene</button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          {rows.length === 0 && <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No scenes set. The stage is dark.</p>}
          {rows.map((s) => {
            const active = phase.kind === 'stage' ? phase.id === s.id : stageId === s.id && phase.kind === 'idle';
            return (
              <button key={s.id} onClick={() => { setSelectedId(s.id); setPhase({ kind: 'stage', id: s.id }); }}
                className="rounded-qd-lg border p-2.5 text-left transition-colors"
                style={active
                  ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' }
                  : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-qd-ink-strong">{s.title}</span>
                  {s.isPresented && <span className={`${mono} flex-none text-[8px] uppercase tracking-wide text-qd-accent-text`}>● live</span>}
                </div>
                <span className={`${mono} mt-1 block text-[8px] uppercase tracking-[0.1em] text-qd-ink-muted`}>{s.type}</span>
              </button>
            );
          })}
        </aside>

        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {phase.kind === 'compose' ? (
              <motion.div key="compose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                {generate.isError && <p className="mx-auto mb-3 max-w-xl text-qd-body-sm text-qd-danger-bright">The vision wouldn&apos;t hold — try again.</p>}
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
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SceneLoading />
              </motion.div>
            ) : stageId ? (
              <motion.div key={stageId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NoteBoard campaignId={campaignId} sceneId={stageId} />
              </motion.div>
            ) : (
              <p key="empty" className="p-6 text-qd-ink-muted">Choose a scene, or set a new one.</p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
