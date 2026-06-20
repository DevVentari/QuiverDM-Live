'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useCampaign } from '@/components/campaign/campaign-context';
import { V3CharacterSheet } from '@/components/character/v3/V3CharacterSheet';
import type { CampaignCharacterRow, CharacterLite } from '@/components/character/v3/V3CharacterSheet';

const STATUS_COLOR: Record<string, string> = {
  active: 'var(--qd-success)',
  pending: 'var(--qd-warn)',
  retired: 'var(--qd-ink-muted)',
  deceased: 'var(--qd-danger)',
};
const statusColor = (s?: string | null) =>
  STATUS_COLOR[(s ?? 'active').toLowerCase()] ?? 'var(--qd-ink-muted)';

const classLine = (c: CharacterLite): string => {
  const cls = c.subclass ? `${c.class} (${c.subclass})` : c.class;
  const lvl = typeof c.level === 'number' ? `Lv ${c.level}` : null;
  return [cls || null, lvl].filter(Boolean).join(' · ') || '—';
};

// ---------------------------------------------------------------------------
// Import form — lets the DM pull a character from D&D Beyond by URL
// ---------------------------------------------------------------------------

function DndBeyondImport({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  const importChar = trpc.charactersDndBeyond.importCharacter.useMutation({
    onSuccess: async () => {
      await utils.characters.getCampaignCharacters.invalidate({ campaignId });
      setUrl('');
      setOpen(false);
    },
  });

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed || importChar.isPending) return;
    importChar.mutate({ url: trimmed, campaignId });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.05)] px-3.5 py-2 font-qd-display text-[13px] text-qd-ink-2 transition-colors hover:border-qd-accent"
      >
        Import from D&amp;D Beyond
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="https://www.dndbeyond.com/characters/12345678"
          className="w-[340px] rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 font-qd-mono text-[11px] text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={importChar.isPending || !url.trim()}
          className="rounded-qd-md bg-qd-accent px-3.5 py-2 font-qd-display text-[13px] font-bold text-qd-on-accent disabled:opacity-50"
        >
          {importChar.isPending ? 'Summoning…' : 'Import'}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            importChar.reset();
          }}
          className="rounded-qd-md border border-qd-faint px-2.5 py-2 font-qd-mono text-[11px] text-qd-ink-muted transition-colors hover:border-qd-strong"
        >
          ✕
        </button>
      </div>
      {importChar.error && (
        <span className="font-qd-mono text-[10px] text-qd-danger-bright">
          {importChar.error.message || 'The summoning failed. Check the link and try again.'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — roster rail + 3-column V3CharacterSheet detail pane
// ---------------------------------------------------------------------------

export default function CharactersPage() {
  const { campaignId, isDM } = useCampaign();
  const chars = trpc.characters.getCampaignCharacters.useQuery(
    { campaignId },
    { staleTime: 60_000 },
  );
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = (chars.data as CampaignCharacterRow[] | undefined) ?? [];
  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        r.character.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );
  const selected = filtered.find((r) => r.character.id === selectedId) ?? filtered[0] ?? null;

  if (chars.isLoading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Gathering the party…</div>;
  }
  if (chars.error) {
    return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;
  }

  return (
    <div className="flex h-full flex-col">

      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-qd-faint px-6 py-3.5">
        <div>
          <div className="font-qd-display text-lg text-qd-ink-strong">The Party</div>
          <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
            {rows.length} {rows.length === 1 ? 'hero' : 'heroes'}
          </div>
        </div>
        <span className="flex-1" />
        {isDM && <DndBeyondImport campaignId={campaignId} />}
      </div>

      <div className="flex min-h-0 flex-1">

        {/* ROSTER RAIL */}
        <aside className="flex w-[282px] flex-none flex-col gap-2 overflow-auto border-r border-qd-faint bg-[rgba(0,0,0,0.2)] p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="⌕ Search the party…"
            className="rounded-qd-md border border-qd-strong bg-[rgba(255,255,255,0.03)] px-3 py-2 font-qd-mono text-[11px] text-qd-ink placeholder:text-qd-ink-faint focus:border-qd-accent focus:outline-none"
          />
          {filtered.length === 0 && (
            <p className="px-1 py-6 text-center text-qd-body-sm text-qd-ink-muted">
              No souls walk this world yet.
            </p>
          )}
          {filtered.map((r) => {
            const c = r.character;
            const active = selected?.character.id === c.id;
            const col = statusColor(r.status);
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(c.id)}
                className="flex items-center gap-2.5 rounded-qd-lg border p-2 text-left transition-colors"
                style={
                  active
                    ? {
                        background:
                          'linear-gradient(180deg,rgba(217,138,61,.16),rgba(184,69,58,.06))',
                        borderColor: 'var(--qd-border-accent)',
                      }
                    : {
                        background: 'rgba(255,255,255,.02)',
                        borderColor: 'var(--qd-border-faint)',
                      }
                }
              >
                <span
                  className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full text-[13px] font-bold text-qd-on-accent"
                  style={{
                    background: `radial-gradient(circle, ${col}, var(--qd-danger-deep))`,
                  }}
                >
                  {c.portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.portraitUrl} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    c.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-qd-ink-strong">{c.name}</span>
                  <span className="block truncate font-qd-mono text-[7.5px] text-qd-ink-muted">
                    {classLine(c).toUpperCase()}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* DETAIL — 3-column V3CharacterSheet */}
        {!selected ? (
          <div className="flex-1 overflow-auto p-6">
            <p className="text-qd-ink-muted">Select a hero from the party.</p>
          </div>
        ) : (
          <V3CharacterSheet key={selected.character.id} row={selected} isDM={isDM} />
        )}
      </div>
    </div>
  );
}
