'use client';

/**
 * v3 Homebrew Creator — wired to real homebrew data.
 *  - LEFT: existing homebrew for the campaign (trpc.homebrew.getContent), grouped/
 *    filtered by the active creator type. Reads each row defensively.
 *  - RIGHT: a controlled creation form (type selector + name + description + a few
 *    key statblock fields) with a live preview. SUBMIT wires to
 *    trpc.homebrew.createContent and invalidates the list on success.
 * AI-assist stat generation and PDF import are OUT OF SCOPE here — rendered as
 * disabled placeholder affordances (see // TODO markers).
 * The design's brand header is dropped — the app shell provides that chrome.
 */

import { useMemo, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import type { GeneratedStatblock } from '@/lib/ai/generate-statblock';

/**
 * Import a sourcebook/homebrew PDF. Posts the file to /api/homebrew/upload-pdf,
 * which stores it (local or R2 via the storage abstraction), creates the
 * HomebrewPDF record, and queues the BullMQ extraction job in one call. Extracted
 * entries land in the campaign's homebrew list asynchronously as the worker runs.
 */
function PdfImportButton({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const onFile = async (file: File) => {
    setStatus('uploading');
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('campaignId', campaignId);
      fd.append('useAIExtraction', 'true');
      const res = await fetch('/api/homebrew/upload-pdf', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) throw new Error(json?.error || 'Upload failed');
      setStatus('done');
      setMessage('Imported — extracting entries in the background.');
      void utils.homebrew.getContent.invalidate();
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        data-testid="pdf-file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === 'uploading'}
        title="Import a PDF — sourcebook or homebrew"
        data-testid="import-pdf"
        className={`${mono} rounded-[8px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-[9px] text-[var(--qd-ink-2)] transition-colors hover:border-[var(--qd-border-accent)] disabled:opacity-50`}
      >
        {status === 'uploading' ? '⬆ Uploading…' : '⬆ Import PDF'}
      </button>
      {message && (
        <span
          className={`${mono} max-w-[180px] text-[8.5px] leading-tight`}
          style={{ color: status === 'error' ? 'var(--qd-danger-bright)' : 'var(--qd-ink-muted)' }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

const mono = 'font-[family-name:var(--qd-font-mono)]';
const display = 'font-[family-name:var(--qd-font-display)]';

// Creator types offered in the header tabs. These map 1:1 onto homebrew `type`.
const CREATOR_TYPES = [
  { type: 'creature' as const, label: 'Monster' },
  { type: 'item' as const, label: 'Item' },
  { type: 'spell' as const, label: 'Spell' },
];
type CreatorType = (typeof CREATOR_TYPES)[number]['type'];

// Per-type icon for the existing list (same names the compendium proves exist).
const ICON_FOR_TYPE: Record<string, string> = {
  creature: 'monster/aberration',
  spell: 'spell/abjuration',
  item: 'weapon/sword',
};
const iconForType = (type: string) => ICON_FOR_TYPE[type] ?? 'monster/aberration';

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
type AbilityKey = (typeof ABILITY_KEYS)[number];

// ---- Existing homebrew row (subset of HomebrewContent) ----
interface HomebrewRow {
  id: string;
  name: string;
  type: string;
  tags?: string[] | null;
  sourceType?: string | null;
  data?: unknown;
}
const isHomebrew = (r: HomebrewRow) => (r.sourceType ?? 'manual') !== 'dndbeyond_import';

// ---- Controlled form state ----
interface FormState {
  name: string;
  description: string;
  size: string;
  creatureType: string;
  cr: string;
  ac: string;
  hp: string;
  speed: string;
  abilities: Record<AbilityKey, string>;
}

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  size: 'Medium',
  creatureType: 'humanoid',
  cr: '1',
  ac: '',
  hp: '',
  speed: '',
  abilities: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
});

// ---- field primitives ----
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${mono} mb-1.5 text-[8px] tracking-[0.14em] text-[var(--qd-ink-muted)]`}>{children}</div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 text-[15px] text-[var(--qd-ink-strong)] placeholder:text-[var(--qd-ink-faint)] focus:border-[var(--qd-border-accent)] focus:outline-none"
        style={{ borderColor: accent ? 'var(--qd-border-accent)' : 'var(--qd-border)' }}
      />
    </div>
  );
}

/**
 * Generate a draft statblock from a concept prompt via homebrew.generateStatblock.
 * The result fills the creator form for the DM to review/edit before saving — it
 * never persists on its own.
 */
function AiGenerateButton({
  type,
  onGenerated,
}: {
  type: CreatorType;
  onGenerated: (sb: GeneratedStatblock) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  const generate = trpc.homebrew.generateStatblock.useMutation({
    onSuccess: (sb) => {
      onGenerated(sb as GeneratedStatblock);
      setPrompt('');
      setOpen(false);
    },
  });

  const submit = () => {
    const p = prompt.trim();
    if (p.length < 3 || generate.isPending) return;
    generate.mutate({ prompt: p, type });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="ai-generate"
        title="Generate a draft statblock with AI"
        className={`${mono} rounded-[8px] border border-[var(--qd-border-accent)] bg-[rgba(217,138,61,0.08)] px-3 py-2 text-[9px] text-[var(--qd-accent-text)] transition-colors hover:bg-[rgba(217,138,61,0.14)]`}
      >
        ✦ AI generate
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder={`Concept for a ${type}… e.g. "a festival wraith, CR 4 undead"`}
        data-testid="ai-generate-input"
        className={`${mono} w-[320px] rounded-[8px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-[11px] text-[var(--qd-ink)] placeholder:text-[var(--qd-ink-faint)] focus:border-[var(--qd-border-accent)] focus:outline-none`}
      />
      <button
        onClick={submit}
        disabled={generate.isPending || prompt.trim().length < 3}
        data-testid="ai-generate-submit"
        className={`${mono} rounded-[8px] border border-[var(--qd-border-accent)] bg-[rgba(217,138,61,0.12)] px-3 py-2 text-[9px] font-bold text-[var(--qd-accent-text)] disabled:opacity-50`}
      >
        {generate.isPending ? 'Conjuring…' : 'Generate'}
      </button>
      <button
        onClick={() => { setOpen(false); generate.reset(); }}
        className={`${mono} rounded-[8px] border border-[var(--qd-border-faint)] px-2 py-2 text-[9px] text-[var(--qd-ink-muted)]`}
      >
        ✕
      </button>
      {generate.error && (
        <span className={`${mono} max-w-[160px] text-[8.5px] leading-tight text-[var(--qd-danger-bright)]`}>
          {generate.error.message}
        </span>
      )}
    </div>
  );
}

export default function HomebrewCreatorPage() {
  const { campaignId } = useCampaign();
  const utils = trpc.useUtils();

  const [activeType, setActiveType] = useState<CreatorType>('creature');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const query = trpc.homebrew.getContent.useQuery(
    { campaignId, limit: 100 },
    { staleTime: 60_000 },
  );

  const create = trpc.homebrew.createContent.useMutation({
    onSuccess: () => {
      void utils.homebrew.getContent.invalidate();
      setForm(emptyForm());
      setError(null);
    },
    onError: (e) => setError(e.message || 'The ritual failed. Try again.'),
  });

  const allRows = (query.data?.items as HomebrewRow[] | undefined) ?? [];
  const filtered = useMemo(
    () => allRows.filter((r) => r.type === activeType),
    [allRows, activeType],
  );

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const patchAbility = (k: AbilityKey, v: string) =>
    setForm((f) => ({ ...f, abilities: { ...f.abilities, [k]: v } }));

  // Fill the form from an AI-generated statblock (numbers → form strings). The DM
  // reviews and edits before saving; nothing is persisted here.
  const applyGenerated = (sb: GeneratedStatblock) => {
    setError(null);
    setForm((f) => ({
      ...f,
      name: sb.name || f.name,
      description: sb.description ?? f.description,
      size: sb.size ?? f.size,
      creatureType: sb.creatureType ?? f.creatureType,
      cr: sb.cr ?? f.cr,
      ac: sb.ac != null ? String(sb.ac) : f.ac,
      hp: sb.hp != null ? String(sb.hp) : f.hp,
      speed: sb.speed ?? f.speed,
      abilities: {
        str: sb.abilities?.str != null ? String(sb.abilities.str) : f.abilities.str,
        dex: sb.abilities?.dex != null ? String(sb.abilities.dex) : f.abilities.dex,
        con: sb.abilities?.con != null ? String(sb.abilities.con) : f.abilities.con,
        int: sb.abilities?.int != null ? String(sb.abilities.int) : f.abilities.int,
        wis: sb.abilities?.wis != null ? String(sb.abilities.wis) : f.abilities.wis,
        cha: sb.abilities?.cha != null ? String(sb.abilities.cha) : f.abilities.cha,
      },
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setError('A name is required to bind this creation.');
      return;
    }
    setError(null);

    // Build the free-form `data` blob from the typed fields. Numeric fields are
    // parsed defensively — empty strings are simply omitted.
    const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));
    const abilities: Partial<Record<AbilityKey, number>> = {};
    for (const k of ABILITY_KEYS) {
      const n = num(form.abilities[k]);
      if (n !== undefined) abilities[k] = n;
    }

    const data: Record<string, unknown> = { description: form.description.trim() || undefined };
    if (activeType === 'creature') {
      Object.assign(data, {
        size: form.size || undefined,
        type: form.creatureType || undefined,
        cr: form.cr.trim() || undefined,
        ac: num(form.ac),
        hp: num(form.hp),
        speed: form.speed.trim() || undefined,
        abilities: Object.keys(abilities).length ? abilities : undefined,
      });
    }

    create.mutate({
      type: activeType,
      name: form.name.trim(),
      data,
      tags: [],
      addToCampaignId: campaignId,
      sourceType: 'manual',
    });
  };

  const activeLabel = CREATOR_TYPES.find((t) => t.type === activeType)?.label ?? 'Monster';
  const isCreature = activeType === 'creature';

  return (
    <div className="flex h-full flex-col">
      {/* header — creator type tabs (replaces the design brand header) */}
      <div
        className="flex items-center gap-3.5 border-b border-[var(--qd-border-faint)] px-5 py-3.5"
        style={{ background: 'linear-gradient(180deg,rgba(217,138,61,.05),transparent)' }}
      >
        <div>
          <div className={`${display} text-lg text-[var(--qd-ink-strong)]`}>Homebrew Creator</div>
          <div className={`${mono} mt-0.5 text-[9px] uppercase tracking-[0.08em] text-[var(--qd-ink-muted)]`}>
            CRAFT A {activeLabel.toUpperCase()} · live statblock preview
          </div>
        </div>
        <span className="flex-1" />
        <AiGenerateButton type={activeType} onGenerated={applyGenerated} />
        <PdfImportButton campaignId={campaignId} />
        <div className="flex gap-1.5">
          {CREATOR_TYPES.map((t) => {
            const active = t.type === activeType;
            return (
              <button
                key={t.type}
                onClick={() => setActiveType(t.type)}
                className={`${mono} rounded-[8px] px-3 py-2 text-[9px]`}
                style={
                  active
                    ? { color: 'var(--qd-on-accent)', background: 'linear-gradient(180deg,var(--qd-accent),var(--qd-accent-deep))' }
                    : { color: 'var(--qd-ink-2)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--qd-border-strong)' }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ===== EXISTING HOMEBREW LIST ===== */}
        <aside className="flex w-[282px] flex-none flex-col gap-[7px] overflow-auto border-r border-[var(--qd-border-faint)] bg-[rgba(0,0,0,0.2)] p-3">
          <div className={`${mono} pl-0.5 text-[8px] tracking-[0.16em] text-[var(--qd-ink-faint)]`}>
            {activeLabel.toUpperCase()}S · {filtered.length}
          </div>

          {query.isLoading && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">Turning the pages…</p>
          )}
          {query.error && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">The threads tangled. Try again.</p>
          )}
          {!query.isLoading && !query.error && filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-[var(--qd-ink-muted)]">The grimoire is blank.</p>
          )}

          {filtered.map((e) => {
            const homebrew = isHomebrew(e);
            const meta = (e.tags && e.tags.length ? e.tags.slice(0, 2).join(' · ') : e.type).toUpperCase();
            return (
              <div
                key={e.id}
                className="flex items-center gap-2.5 rounded-[11px] border p-2.5 text-left"
                style={{ background: 'rgba(255,255,255,.02)', borderColor: 'var(--qd-border-faint)' }}
              >
                <span
                  className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[8px] text-[var(--qd-ink-2)]"
                  style={{ background: 'rgba(196,69,58,.1)' }}
                >
                  <MaskedDndIcon name={iconForType(e.type)} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-[var(--qd-ink)]">
                    {e.name}
                    {homebrew && <span className={`${mono} ml-1 text-[7px] text-[var(--qd-accent-text)]`}>✦</span>}
                  </span>
                  <span className={`${mono} block truncate text-[7.5px] text-[var(--qd-ink-faint)]`}>{meta}</span>
                </span>
              </div>
            );
          })}
        </aside>

        {/* ===== CREATION FORM ===== */}
        <div className="flex-1 overflow-auto p-6">
          <div className={`${mono} mb-3 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>IDENTITY</div>
          <div className="flex max-w-[640px] flex-col gap-3">
            <TextField label="NAME" value={form.name} onChange={(v) => patch({ name: v })} placeholder="Festival Wraith" accent />
            <TextField
              label="DESCRIPTION"
              value={form.description}
              onChange={(v) => patch({ description: v })}
              placeholder="A sliver of mourning given malevolent shape…"
            />

            {isCreature && (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <TextField label="SIZE" value={form.size} onChange={(v) => patch({ size: v })} placeholder="Medium" />
                  <TextField label="TYPE" value={form.creatureType} onChange={(v) => patch({ creatureType: v })} placeholder="Undead" />
                  <TextField label="CR" value={form.cr} onChange={(v) => patch({ cr: v })} placeholder="4" />
                </div>

                <div className={`${mono} mt-2 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>DEFENSE</div>
                <div className="grid grid-cols-3 gap-2.5">
                  <TextField label="ARMOR CLASS" value={form.ac} onChange={(v) => patch({ ac: v })} placeholder="14" />
                  <TextField label="HIT POINTS" value={form.hp} onChange={(v) => patch({ hp: v })} placeholder="66" />
                  <TextField label="SPEED" value={form.speed} onChange={(v) => patch({ speed: v })} placeholder="0, fly 40 (hover)" />
                </div>

                <div className={`${mono} mt-2 text-[8px] tracking-[0.16em] text-[var(--qd-ink-muted)]`}>ABILITY SCORES</div>
                <div className="grid grid-cols-6 gap-2">
                  {ABILITY_KEYS.map((k) => (
                    <div key={k}>
                      <FieldLabel>{k.toUpperCase()}</FieldLabel>
                      <input
                        value={form.abilities[k]}
                        onChange={(e) => patchAbility(k, e.target.value)}
                        placeholder="10"
                        className="w-full rounded-[9px] border border-[var(--qd-border)] bg-[rgba(255,255,255,0.03)] py-2 text-center text-[15px] text-[var(--qd-ink-strong)] placeholder:text-[var(--qd-ink-faint)] focus:border-[var(--qd-border-accent)] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== LIVE PREVIEW + SUBMIT ===== */}
        <div className="flex w-[420px] flex-none flex-col gap-3 overflow-auto bg-[rgba(0,0,0,0.16)] p-5">
          <div className="flex items-center justify-between">
            <span className={`${mono} text-[8px] tracking-[0.14em] text-[var(--qd-accent-bright)]`}>▸ LIVE PREVIEW</span>
            <span className={`${mono} text-[8px] text-[var(--qd-ink-muted)]`}>{activeLabel.toUpperCase()}</span>
          </div>

          <div
            className="rounded-[16px] border p-5"
            style={{
              borderColor: 'var(--qd-border-accent)',
              background: 'linear-gradient(180deg,rgba(36,23,18,.92),rgba(16,12,10,.92))',
              boxShadow: '0 20px 50px rgba(0,0,0,.45)',
            }}
          >
            <div className={`${display} text-[23px] leading-none text-[var(--qd-ink-strong)]`}>
              {form.name.trim() || 'Unnamed creation'}
            </div>
            <div className={`${mono} mt-1.5 text-[9px] italic text-[var(--qd-accent-bright)]`}>
              {isCreature
                ? `${[form.size, form.creatureType].filter(Boolean).join(' ') || '—'} · CR ${form.cr || '—'} · ✦ homebrew`
                : `${activeLabel} · ✦ homebrew`}
            </div>

            {isCreature && (
              <>
                <div
                  className="mt-3 flex gap-5 border-t pt-3 text-[13.5px] text-[var(--qd-ink-2)]"
                  style={{ borderTopColor: 'rgba(217,138,61,.3)' }}
                >
                  <span><b className="text-[var(--qd-accent-hi)]">AC</b> {form.ac || '—'}</span>
                  <span><b className="text-[var(--qd-accent-hi)]">HP</b> {form.hp || '—'}</span>
                  <span><b className="text-[var(--qd-accent-hi)]">Speed</b> {form.speed || '—'}</span>
                </div>
                <div className="mt-3 grid grid-cols-6 gap-1.5">
                  {ABILITY_KEYS.map((k) => (
                    <div key={k} className="text-center">
                      <div className={`${mono} text-[7px] text-[var(--qd-ink-muted)]`}>{k.toUpperCase()}</div>
                      <div className="text-[13px] text-[var(--qd-ink-2)]">{form.abilities[k] || '—'}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {form.description.trim() && (
              <div
                className="mt-3 border-t pt-3 text-[13px] leading-[1.55] text-[var(--qd-ink-2)]"
                style={{ borderTopColor: 'rgba(217,138,61,.2)' }}
              >
                {form.description.trim()}
              </div>
            )}
          </div>

          {error && (
            <div className={`${mono} rounded-[10px] border border-[var(--qd-border-strong)] bg-[rgba(196,69,58,.08)] px-3 py-2 text-[10px] text-[var(--qd-danger)]`}>
              {error}
            </div>
          )}

          <div className="flex gap-2.5">
            <button
              onClick={handleSubmit}
              disabled={create.isPending}
              className={`${display} flex-1 rounded-[11px] border-none px-3 py-3 text-[14px] font-bold text-[var(--qd-on-accent)] disabled:opacity-60`}
              style={{ background: 'linear-gradient(180deg,var(--qd-accent),var(--qd-accent-deep))' }}
            >
              {create.isPending ? 'Binding…' : 'Save to compendium'}
            </button>
            <button
              disabled
              title="Coming soon"
              className={`${display} w-[120px] flex-none cursor-not-allowed rounded-[11px] border border-[var(--qd-border-strong)] bg-[rgba(255,255,255,0.05)] px-3 py-3 text-[14px] text-[var(--qd-ink-faint)]`}
            >
              {/* TODO: wire test fight / encounter sim */}
              Test fight
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
