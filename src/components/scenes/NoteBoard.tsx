'use client';
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
      </div>
    </div>
  );
}
