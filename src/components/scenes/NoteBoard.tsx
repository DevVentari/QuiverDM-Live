'use client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { NOTE_TYPES, NOTE_LABEL, type NoteType, type SceneNote } from './note-constants';
import { NoteCard } from './NoteCard';

const mono = 'font-[family-name:var(--qd-font-mono)]';

function toSceneNote(n: {
  id: string;
  type: string;
  title: string | null;
  body: string;
  data: unknown;
  orderIndex: number;
  source: string;
}): SceneNote {
  return {
    id: n.id,
    type: n.type as NoteType,
    title: n.title,
    body: n.body,
    data: n.data,
    orderIndex: n.orderIndex,
    source: n.source,
  };
}

export function NoteBoard({ campaignId, sceneId }: { campaignId: string; sceneId: string }) {
  const utils = trpc.useUtils();
  const stage = trpc.scenes.getStage.useQuery({ campaignId, id: sceneId });
  const invalidate = () => utils.scenes.getStage.invalidate({ campaignId, id: sceneId });

  const create = trpc.scenes.notesCreate.useMutation({ onSuccess: invalidate });
  const update = trpc.scenes.notesUpdate.useMutation({ onSuccess: invalidate });
  const del = trpc.scenes.notesDelete.useMutation({ onSuccess: invalidate });
  const draft = trpc.scenes.notesDraft.useMutation();
  const refine = trpc.scenes.notesRefine.useMutation();
  const suggest = trpc.scenes.notesSuggest.useMutation();
  const [ghosts, setGhosts] = useState<Array<{ type: NoteType; title?: string; body: string; data?: unknown }>>([]);

  const askForgetting = async () => {
    const out = await suggest.mutateAsync({ campaignId, sceneId });
    setGhosts(out as Array<{ type: NoteType; title?: string; body: string; data?: unknown }>);
  };
  const keepGhost = async (g: { type: NoteType; title?: string; body: string; data?: unknown }, idx: number) => {
    await create.mutateAsync({ campaignId, sceneId, type: g.type, title: g.title, body: g.body, data: g.data ?? undefined, source: 'ai_suggested' });
    setGhosts((gs) => gs.filter((_, i) => i !== idx));
  };
  const dismissGhost = (idx: number) => setGhosts((gs) => gs.filter((_, i) => i !== idx));

  if (stage.isLoading) return <div className="px-6 py-12 text-qd-ink-muted">Drawing the scene…</div>;
  if (stage.error || !stage.data)
    return <div className="px-6 py-12 text-qd-ink-muted">The threads tangled. Try again.</div>;

  const scene = stage.data.scene;
  const notes: SceneNote[] = (scene.notes ?? []).map(toSceneNote);

  const addBlock = async (type: NoteType) => {
    const d = await draft.mutateAsync({ campaignId, sceneId, type });
    await create.mutateAsync({
      campaignId,
      sceneId,
      type,
      title: d.title ?? undefined,
      body: d.body,
      data: d.data ?? undefined,
      source: 'ai',
    });
  };

  const refineNote = async (id: string, instruction: string) => {
    const r = await refine.mutateAsync({ campaignId, id, instruction });
    await update.mutateAsync({ campaignId, id, body: r.body });
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      {scene.act && (
        <div className={`${mono} mb-1 text-[9px] uppercase tracking-[0.14em] text-qd-ink-muted`}>
          ▸ {scene.act}
        </div>
      )}
      <h1 className="mb-4 font-qd-display text-[28px] leading-tight text-qd-ink-strong">
        {scene.title}
      </h1>

      <div className="flex flex-col gap-2.5">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            onSave={(patch) => update.mutate({ campaignId, id: n.id, body: patch.body })}
            onDelete={() => del.mutate({ campaignId, id: n.id })}
            onRefine={(instr) => refineNote(n.id, instr)}
            refining={refine.isPending}
          />
        ))}
      </div>

      {ghosts.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {ghosts.map((g, i) => (
            <div key={i} className="rounded-qd-md border border-dashed p-3" style={{ borderColor: 'var(--qd-border-accent)', background: 'rgba(217,138,61,.05)' }}>
              <div className="mb-1 flex items-center gap-2">
                <span className={`${mono} text-[8px] uppercase tracking-[0.1em] text-qd-accent-text`}>✦ {NOTE_LABEL[g.type]}</span>
                <span className="ml-auto flex gap-2">
                  <button onClick={() => keepGhost(g, i)} className="text-[12px] text-qd-success">✓</button>
                  <button onClick={() => dismissGhost(i)} className="text-[12px] text-qd-ink-faint">✕</button>
                </span>
              </div>
              <p className="text-qd-body-sm italic text-qd-ink-2">{g.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {NOTE_TYPES.map((t) => (
          <button
            key={t}
            disabled={draft.isPending || create.isPending}
            onClick={() => addBlock(t)}
            className="rounded-full border border-dashed border-qd-strong px-3 py-1.5 text-[11px] text-qd-ink-2 hover:border-qd-accent hover:text-qd-accent-text disabled:opacity-50"
          >
            + {NOTE_LABEL[t]}
          </button>
        ))}
        <button disabled={suggest.isPending} onClick={askForgetting}
          className="ml-auto rounded-full border border-qd-accent px-3 py-1.5 text-[11px] text-qd-accent-text hover:bg-[rgba(217,138,61,0.08)] disabled:opacity-50">
          ✦ {suggest.isPending ? 'Listening…' : 'What am I forgetting?'}
        </button>
      </div>
    </div>
  );
}
