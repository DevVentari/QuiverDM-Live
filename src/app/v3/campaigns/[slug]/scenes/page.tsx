'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';

const SCENE_TYPES = ['rp', 'description', 'tavern', 'battle', 'theatre'] as const;
type SceneType = (typeof SCENE_TYPES)[number];

const TYPE_TINT: Record<string, string> = {
  rp: 'var(--qd-arcane)',
  description: 'var(--qd-accent-text)',
  tavern: 'var(--qd-success)',
  battle: 'var(--qd-danger-bright)',
  theatre: 'var(--qd-accent-bright)',
};

interface Scene {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  dmNotes?: string | null;
  isPresented: boolean;
}

const mono = 'font-[family-name:var(--qd-font-mono)]';

export default function ScenesPage() {
  const { campaignId, isDM } = useCampaign();
  const utils = trpc.useUtils();
  const scenes = trpc.scenes.list.useQuery({ campaignId }, { staleTime: 30_000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'rp' as SceneType, description: '', dmNotes: '' });

  const invalidate = () => utils.scenes.list.invalidate({ campaignId });
  const create = trpc.scenes.create.useMutation({ onSuccess: () => { invalidate(); setCreating(false); setForm({ title: '', type: 'rp', description: '', dmNotes: '' }); } });
  const present = trpc.scenes.present.useMutation({ onSuccess: invalidate });
  const clear = trpc.scenes.clearPresented.useMutation({ onSuccess: invalidate });

  const rows = (scenes.data as Scene[] | undefined) ?? [];
  const selected = rows.find((s) => s.id === selectedId) ?? rows[0] ?? null;

  if (scenes.isLoading) return <div className="px-8 py-16 text-qd-ink-muted">Setting the stage…</div>;
  if (scenes.error) return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">Scenes</div>
          <div className={`${mono} text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted`}>{rows.length} scenes · Theatre of the Mind</div>
        </div>
        <span className="flex-1" />
        {isDM && (
          <button onClick={() => { setCreating(true); setSelectedId(null); }} className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">+ New Scene</button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* gallery */}
        <aside className="flex w-[260px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          {rows.length === 0 && <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">No scenes set. The stage is dark.</p>}
          {rows.map((s) => {
            const active = !creating && selected?.id === s.id;
            return (
              <button key={s.id} onClick={() => { setCreating(false); setSelectedId(s.id); }}
                className="rounded-qd-lg border p-2.5 text-left transition-colors"
                style={active ? { background: 'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))', borderColor: 'var(--qd-border-accent)' } : { background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: TYPE_TINT[s.type] ?? 'var(--qd-ink-muted)' }} />
                  <span className="min-w-0 flex-1 truncate text-sm text-qd-ink-strong">{s.title}</span>
                  {s.isPresented && <span className={`${mono} flex-none text-[8px] uppercase tracking-wide text-qd-accent-text`}>● live</span>}
                </div>
                <span className={`${mono} mt-1 block text-[8px] uppercase tracking-[0.1em] text-qd-ink-muted`}>{s.type}</span>
              </button>
            );
          })}
        </aside>

        {/* detail / create */}
        <div className="flex-1 overflow-auto p-6">
          {creating ? (
            <div className="mx-auto max-w-xl">
              <div className="mb-4 font-qd-display text-2xl text-qd-ink-strong">New scene</div>
              <label className={`${mono} mb-1 block text-[9px] uppercase tracking-wide text-qd-ink-muted`}>Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink focus:border-qd-accent focus:outline-none" />
              <label className={`${mono} mb-1 block text-[9px] uppercase tracking-wide text-qd-ink-muted`}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SceneType })} className="mb-3 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink focus:border-qd-accent focus:outline-none">
                {SCENE_TYPES.map((t) => <option key={t} value={t} className="bg-qd-surface">{t}</option>)}
              </select>
              <label className={`${mono} mb-1 block text-[9px] uppercase tracking-wide text-qd-ink-muted`}>Read-aloud (player-facing)</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="mb-3 w-full rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-qd-ink focus:border-qd-accent focus:outline-none" />
              <label className={`${mono} mb-1 block text-[9px] uppercase tracking-wide text-qd-accent-text`}>DM notes (secret)</label>
              <textarea value={form.dmNotes} onChange={(e) => setForm({ ...form, dmNotes: e.target.value })} rows={3} className="mb-4 w-full rounded-qd-md border border-qd-accent bg-[rgba(217,138,61,0.05)] px-3 py-2 text-sm text-qd-ink focus:outline-none" />
              <div className="flex gap-2.5">
                <button disabled={!form.title.trim() || create.isPending} onClick={() => create.mutate({ campaignId, ...form })} className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50">{create.isPending ? 'Setting…' : 'Create scene'}</button>
                <button onClick={() => setCreating(false)} className="rounded-qd-md border border-qd-strong px-4 py-2 font-qd-display text-[13px] text-qd-ink-2">Cancel</button>
              </div>
            </div>
          ) : !selected ? (
            <p className="text-qd-ink-muted">Choose a scene, or set a new one.</p>
          ) : (
            <div className="mx-auto max-w-2xl">
              <span className={`${mono} text-[9px] uppercase tracking-[0.12em]`} style={{ color: TYPE_TINT[selected.type] ?? 'var(--qd-ink-muted)' }}>{selected.type}</span>
              <h1 className="mt-1 font-qd-display text-[34px] leading-tight text-qd-ink-strong">{selected.title}</h1>

              {isDM && (
                <div className="mt-4 flex gap-2.5">
                  {selected.isPresented ? (
                    <button onClick={() => clear.mutate({ campaignId })} className="rounded-qd-md border border-qd-accent bg-[rgba(217,138,61,0.12)] px-4 py-2 font-qd-display text-[13px] font-bold text-qd-accent-text">● Live — clear</button>
                  ) : (
                    <button onClick={() => present.mutate({ id: selected.id, campaignId })} className="rounded-qd-md bg-qd-accent px-4 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent">Present to players ▸</button>
                  )}
                </div>
              )}

              {/* player-facing read-aloud */}
              <div className="mt-6 rounded-qd-xl border border-qd-faint p-5" style={{ background: 'var(--qd-grad-card), var(--qd-card)' }}>
                <div className={`${mono} mb-2 text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted`}>Read aloud</div>
                <p className="font-qd-display text-qd-narration italic leading-relaxed text-qd-ink">{selected.description || 'No narration set.'}</p>
              </div>

              {/* DM secret notes */}
              {isDM && (
                <div className="mt-4 rounded-qd-xl border border-qd-accent p-5" style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))' }}>
                  <div className={`${mono} mb-2 text-[8px] uppercase tracking-[0.12em] text-qd-accent-text`}>▸ DM Notes</div>
                  <p className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">{selected.dmNotes || 'No secret notes.'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
