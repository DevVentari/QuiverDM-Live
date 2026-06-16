'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { SCENE_TYPES, MOOD_LABELS, EMPTY_SCENE_FORM, type SceneFormState, type SceneType } from './scene-types';

const mono = 'font-[family-name:var(--qd-font-mono)]';
const lab = `${mono} mb-1.5 block text-[9px] uppercase tracking-wide text-qd-ink-muted`;

// getCampaignCharacters returns CampaignCharacter rows — the Character fields are nested under .character
type CampaignCharacterRow = {
  character: { id: string; name: string };
};

type TaggableEntity = { id: string; name: string; type: string };

export function SceneCreateForm({
  campaignId, onCreate, onCancel, pending,
}: {
  campaignId: string;
  onCreate: (form: SceneFormState) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<SceneFormState>(EMPTY_SCENE_FORM);
  const party = trpc.characters.getCampaignCharacters.useQuery({ campaignId }, { staleTime: 60_000 });
  const entities = trpc.scenes.taggableEntities.useQuery({ campaignId }, { staleTime: 60_000 });

  const toggle = (key: 'partyPresentIds' | 'linkedEntityIds', id: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));

  const canSubmit = form.description.trim().length > 0 && !pending;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-1 font-qd-display text-2xl text-qd-ink-strong">New scene</div>
      <p className="mb-5 text-qd-body-sm text-qd-ink-muted">Describe the moment. The world fills in the rest.</p>

      <label className={lab}>Title <span className="lowercase tracking-normal text-qd-ink-faint">— optional</span></label>
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Leave blank — the world will name it"
        className="mb-4 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
      />

      <label className={lab}>Party present</label>
      <ChipRow loading={party.isLoading}>
        {(party.data as CampaignCharacterRow[] | undefined ?? []).map((cc) => (
          <Chip key={cc.character.id} on={form.partyPresentIds.includes(cc.character.id)} onClick={() => toggle('partyPresentIds', cc.character.id)}>
            {cc.character.name}
          </Chip>
        ))}
      </ChipRow>

      <label className={`${lab} mt-4`}>In this scene — tag from the compendium</label>
      <ChipRow loading={entities.isLoading}>
        {(entities.data as TaggableEntity[] | undefined ?? []).map((e) => (
          <Chip key={e.id} on={form.linkedEntityIds.includes(e.id)} onClick={() => toggle('linkedEntityIds', e.id)}>
            {e.name}
          </Chip>
        ))}
      </ChipRow>
      <p className={`${mono} mt-1.5 text-[10px] italic text-qd-ink-faint`}>Whatever you tag, the AI pulls in and weaves into the scene.</p>

      <label className={`${lab} mt-4`}>Describe the scene</label>
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={4}
        placeholder="The party reaches the castle gates at dusk. Strahd is watching but won't reveal himself yet…"
        className="mb-4 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
      />

      <label className={lab}>Mood <span className="lowercase tracking-normal text-qd-ink-faint">— optional, inferred if blank</span></label>
      <ChipRow>
        {SCENE_TYPES.map((t: SceneType) => (
          <Chip key={t} on={form.mood === t} onClick={() => setForm({ ...form, mood: form.mood === t ? null : t })}>
            {MOOD_LABELS[t]}
          </Chip>
        ))}
      </ChipRow>

      <div className="mt-6 flex items-center gap-2.5">
        <button
          disabled={!canSubmit}
          onClick={() => onCreate(form)}
          className="rounded-qd-md bg-qd-accent px-5 py-2.5 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50"
        >
          ✦ {pending ? 'Setting the stage…' : 'Create scene'}
        </button>
        <button onClick={onCancel} className="rounded-qd-md border border-qd-strong px-4 py-2 font-qd-display text-[13px] text-qd-ink-2">Cancel</button>
      </div>
    </div>
  );
}

function ChipRow({ children, loading }: { children?: React.ReactNode; loading?: boolean }) {
  if (loading) return <div className="text-qd-body-sm text-qd-ink-faint">Gathering…</div>;
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] transition-colors"
      style={on
        ? { borderColor: 'var(--qd-border-accent)', background: 'rgba(217,138,61,.12)', color: 'var(--qd-accent-text)' }
        : { borderColor: 'var(--qd-border-strong)', background: 'rgba(255,255,255,.02)', color: 'var(--qd-ink-2)' }}
    >
      {children}
    </button>
  );
}
