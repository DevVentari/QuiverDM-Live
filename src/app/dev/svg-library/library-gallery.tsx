'use client';

import { useMemo, useState } from 'react';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

export interface IconEntry {
  name: string;
  path: string;
  token: string;
}

export interface CategoryEntry {
  category: string;
  icons: IconEntry[];
}

export type IconManifest = CategoryEntry[];

type TintMode = 'amber' | 'foreground' | 'school';

const TINT: Record<TintMode, string> = {
  amber: 'oklch(0.78 0.16 70)',
  foreground: 'oklch(0.92 0.005 60)',
  school: 'oklch(0.78 0.13 240)',
};

export function LibraryGallery({
  manifest,
  totalCount,
}: {
  manifest: IconManifest;
  totalCount: number;
}) {
  const [query, setQuery] = useState('');
  const [tint, setTint] = useState<TintMode>('amber');
  const [size, setSize] = useState<number>(40);
  const [bg, setBg] = useState<'dark' | 'parchment' | 'light'>('dark');
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return manifest;
    return manifest
      .map((cat) => ({
        ...cat,
        icons: cat.icons.filter(
          (i) => i.token.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.icons.length > 0);
  }, [manifest, query]);

  const filteredCount = filtered.reduce((s, c) => s + c.icons.length, 0);

  const onCopy = (token: string) => {
    void navigator.clipboard.writeText(token);
    setCopied(token);
    setTimeout(() => setCopied(null), 1200);
  };

  const tile = `oklch(0.14 0.012 60 / 0.6)`;
  const pageBg =
    bg === 'parchment'
      ? 'oklch(0.78 0.04 70)'
      : bg === 'light'
      ? 'oklch(0.95 0.005 60)'
      : 'var(--q-bg, oklch(0.12 0.005 265))';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: pageBg,
        color: bg === 'dark' ? 'var(--q-text)' : 'oklch(0.18 0.012 60)',
        fontFamily: 'var(--q-font-body, system-ui)',
      }}
    >
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '20px 32px',
          backdropFilter: 'blur(12px)',
          background:
            bg === 'dark'
              ? 'oklch(0.1 0.005 265 / 0.85)'
              : 'oklch(1 0 0 / 0.7)',
          borderBottom: `1px solid ${bg === 'dark' ? 'oklch(0.7 0.16 55 / 0.18)' : 'oklch(0 0 0 / 0.1)'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--q-font-display, "Cinzel", serif)',
                fontSize: 24,
                letterSpacing: '0.04em',
                margin: 0,
              }}
            >
              SVG Library
            </h1>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
              {filteredCount === totalCount
                ? `${totalCount} icons across ${manifest.length} categories`
                : `${filteredCount} of ${totalCount} icons`}
            </p>
          </div>

          <input
            type="search"
            placeholder="Search icons (e.g. fire, abjuration, sword)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: '1 1 280px',
              padding: '8px 12px',
              borderRadius: 4,
              border: `1px solid ${
                bg === 'dark' ? 'oklch(0.7 0.16 55 / 0.3)' : 'oklch(0 0 0 / 0.2)'
              }`,
              background: bg === 'dark' ? 'oklch(0.18 0.012 60 / 0.5)' : 'oklch(1 0 0 / 0.6)',
              color: 'inherit',
              fontSize: 13,
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Label>Tint</Label>
            <Pill on={tint === 'amber'} onClick={() => setTint('amber')}>amber</Pill>
            <Pill on={tint === 'foreground'} onClick={() => setTint('foreground')}>fg</Pill>
            <Pill on={tint === 'school'} onClick={() => setTint('school')}>blue</Pill>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Label>BG</Label>
            <Pill on={bg === 'dark'} onClick={() => setBg('dark')}>dark</Pill>
            <Pill on={bg === 'parchment'} onClick={() => setBg('parchment')}>parchment</Pill>
            <Pill on={bg === 'light'} onClick={() => setBg('light')}>light</Pill>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Label>Size</Label>
            <input
              type="range"
              min={20}
              max={96}
              step={4}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              style={{ width: 120 }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.7 }}>{size}px</span>
          </div>
        </div>
      </header>

      <main style={{ padding: '24px 32px 96px' }}>
        {filtered.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 13 }}>No icons match &ldquo;{query}&rdquo;.</p>
        ) : (
          filtered.map((cat) => (
            <section key={cat.category} style={{ marginBottom: 40 }}>
              <header style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2
                  style={{
                    fontFamily: 'var(--q-font-display, "Cinzel", serif)',
                    fontSize: 14,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: bg === 'dark' ? 'oklch(0.78 0.16 70)' : 'oklch(0.4 0.12 55)',
                    margin: 0,
                  }}
                >
                  {cat.category}
                </h2>
                <span style={{ fontSize: 11, opacity: 0.5 }}>{cat.icons.length}</span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: `linear-gradient(90deg, ${
                      bg === 'dark' ? 'oklch(0.7 0.16 55 / 0.4)' : 'oklch(0 0 0 / 0.15)'
                    }, transparent)`,
                  }}
                />
              </header>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(96, size + 56)}px, 1fr))`,
                  gap: 8,
                }}
              >
                {cat.icons.map((icon) => {
                  const isCopied = copied === icon.token;
                  return (
                    <button
                      key={icon.token}
                      type="button"
                      onClick={() => onCopy(icon.token)}
                      title={`${icon.token}\n${icon.path}\n(click to copy token)`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: 12,
                        borderRadius: 4,
                        border: `1px solid ${
                          isCopied
                            ? 'oklch(0.78 0.16 70 / 0.7)'
                            : bg === 'dark'
                            ? 'oklch(0.28 0.02 60 / 0.4)'
                            : 'oklch(0 0 0 / 0.1)'
                        }`,
                        background: isCopied
                          ? 'oklch(0.7 0.16 55 / 0.12)'
                          : bg === 'dark'
                          ? tile
                          : 'oklch(1 0 0 / 0.5)',
                        cursor: 'pointer',
                        transition: 'all 140ms ease',
                        color: TINT[tint],
                        font: 'inherit',
                      }}
                    >
                      <MaskedDndIcon name={icon.token} size={size} />
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          fontSize: 10,
                          color: bg === 'dark' ? 'oklch(0.65 0.01 60)' : 'oklch(0.35 0.01 60)',
                          textAlign: 'center',
                          lineHeight: 1.3,
                          wordBreak: 'break-all',
                        }}
                      >
                        {icon.name}
                      </span>
                      {isCopied ? (
                        <span
                          style={{
                            fontSize: 9,
                            color: 'oklch(0.78 0.16 70)',
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          Copied
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        opacity: 0.6,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Pill({
  children,
  on,
  onClick,
}: {
  children: React.ReactNode;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${on ? 'oklch(0.78 0.16 70)' : 'oklch(0.7 0.16 55 / 0.25)'}`,
        background: on ? 'oklch(0.7 0.16 55 / 0.18)' : 'transparent',
        color: on ? 'oklch(0.86 0.16 70)' : 'inherit',
        fontSize: 11,
        cursor: 'pointer',
        fontWeight: on ? 700 : 500,
        letterSpacing: '0.04em',
        font: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
