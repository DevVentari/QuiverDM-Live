'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

// Result shape from search.global (MeiliSearch-backed, membership-scoped).
interface GlobalResult {
  type: 'campaign' | 'session' | 'npc' | 'world_entity' | 'world_entry' | 'homebrew';
  id: string;
  title: string;
  subtitle?: string;
  campaignId?: string;
  href: string;
}

const TYPE_META: Record<GlobalResult['type'], { label: string; icon: string; v3seg: string | null }> = {
  campaign: { label: 'Campaign', icon: 'entity/world', v3seg: 'overview' },
  session: { label: 'Session', icon: 'entity/scroll', v3seg: 'sessions' },
  npc: { label: 'NPC', icon: 'entity/person', v3seg: 'npcs' },
  world_entity: { label: 'World', icon: 'entity/location', v3seg: 'locations' },
  world_entry: { label: 'Lore', icon: 'entity/book', v3seg: 'locations' },
  homebrew: { label: 'Homebrew', icon: 'game/source-book', v3seg: 'compendium' },
};

/**
 * Map a v2 search href onto the equivalent v3 campaign-scoped screen so results
 * keep the user inside the v3 shell. v3 has no per-entity detail routes for every
 * type yet, so we land on the relevant list/screen for that campaign. Falls back
 * to the raw href when no slug can be derived.
 */
function toV3Href(r: GlobalResult, currentSlug: string | null): string {
  const seg = TYPE_META[r.type]?.v3seg;
  const slugInHref = r.href.match(/^\/campaigns\/([^/]+)/)?.[1] ?? null;
  const slug = slugInHref ?? currentSlug;
  if (seg && slug) return `/v3/campaigns/${slug}/${seg}`;
  return r.href;
}

/**
 * v3 global command bar — ⌘K / Ctrl-K opens a search palette over search.global.
 * Results are grouped by type and route into the v3 shell. Mounted once by the
 * app shell, so it's available on every v3 surface.
 */
export function V3CommandBar() {
  const router = useRouter();
  const pathname = usePathname();
  const currentSlug = pathname.match(/^\/v3\/campaigns\/([^/]+)/)?.[1] ?? null;

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K toggles; Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else { setQ(''); setDebouncedQ(''); }
  }, [open]);

  // Debounce the query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const search = trpc.search.global.useQuery(
    { q: debouncedQ, limitPerType: 5 },
    { enabled: open && debouncedQ.length >= 2, staleTime: 30_000 },
  );

  const results = (search.data?.results as GlobalResult[] | undefined) ?? [];
  const grouped = useMemo(() => {
    const m = new Map<GlobalResult['type'], GlobalResult[]>();
    for (const r of results) {
      const arr = m.get(r.type) ?? [];
      arr.push(r);
      m.set(r.type, arr);
    }
    return [...m.entries()];
  }, [results]);

  const go = (r: GlobalResult) => {
    setOpen(false);
    router.push(toV3Href(r, currentSlug));
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-[rgba(0,0,0,0.55)] pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
      role="dialog"
      aria-label="Search"
    >
      <div
        className="w-[min(620px,92vw)] overflow-hidden rounded-qd-xl border border-qd-strong bg-qd-card shadow-qd-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-qd-faint px-4 py-3">
          <MaskedDndIcon name="util/search" size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the chronicle — NPCs, sessions, lore, homebrew…"
            data-testid="v3-search-input"
            className="flex-1 bg-transparent font-qd-body text-qd-ink placeholder:text-qd-ink-faint focus:outline-none"
          />
          <kbd className="rounded-qd-sm border border-qd-faint px-1.5 py-0.5 font-qd-mono text-[9px] text-qd-ink-muted">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-auto p-2">
          {debouncedQ.length < 2 ? (
            <p className="px-3 py-6 text-center font-qd-mono text-[10px] uppercase tracking-[0.14em] text-qd-ink-faint">
              Speak a name…
            </p>
          ) : search.isLoading ? (
            <p className="px-3 py-6 text-center text-qd-body-sm text-qd-ink-muted">Searching the weave…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-qd-body-sm text-qd-ink-muted">The chronicle holds no such thing.</p>
          ) : (
            grouped.map(([type, items]) => (
              <div key={type} className="mb-1">
                <div className="px-3 pb-1 pt-2 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-faint">
                  {TYPE_META[type]?.label ?? type}
                </div>
                {items.map((r) => (
                  <button
                    key={`${type}:${r.id}`}
                    onClick={() => go(r)}
                    className="flex w-full items-center gap-3 rounded-qd-md px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    <MaskedDndIcon name={TYPE_META[type]?.icon ?? 'entity/scroll'} size={15} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-qd-body-sm text-qd-ink-strong">{r.title}</span>
                      {r.subtitle && (
                        <span className="block truncate font-qd-mono text-[9px] text-qd-ink-muted">{r.subtitle}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
