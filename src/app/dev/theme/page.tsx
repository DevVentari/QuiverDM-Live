'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun, Check } from 'lucide-react';

function Toggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-40" />;
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors border"
      style={{ background: 'var(--q-surface-raised)', borderColor: 'var(--q-border)', color: 'var(--q-text)' }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      Switch to {isDark ? 'Light' : 'Dark'}
    </button>
  );
}

function Section({ title, children }: { children: React.ReactNode; title: string }) {
  return (
    <div className="space-y-2">
      <div className="mb-3">
        <p className="label-overline">{title}</p>
        <div className="section-rule mt-1" />
      </div>
      {children}
    </div>
  );
}

const SURFACES = [
  { label: 'Page background',    token: '--q-bg' },
  { label: 'Sunken / well',      token: '--q-surface-sunken' },
  { label: 'Flat',               token: '--q-surface-flat' },
  { label: 'Raised / card',      token: '--q-surface-raised' },
  { label: 'Inset panel',        token: '--q-surface-inset' },
  { label: 'Utility (semi)',     token: '--q-surface-utility' },
  { label: 'Feature (semi)',     token: '--q-surface-feature' },
  { label: 'Hero (semi)',        token: '--q-surface-hero' },
  { label: 'Signature (semi)',   token: '--q-surface-signature' },
  { label: 'Shell bar',          token: '--q-shell-bar' },
  { label: 'Shell rail',         token: '--q-shell-rail' },
];

const BORDERS = [
  { label: 'Default',    token: '--q-border' },
  { label: 'Subtle',     token: '--q-border-subtle' },
  { label: 'Feature',    token: '--q-border-feature' },
  { label: 'Hero',       token: '--q-border-hero' },
  { label: 'Signature',  token: '--q-border-signature' },
];

const TEXT_TOKENS = [
  { label: 'Primary',    token: '--q-text',         sample: 'The quick brown fox jumps over the lazy dog' },
  { label: 'Dim',        token: '--q-text-dim',     sample: 'Supporting copy, captions, metadata' },
  { label: 'Faint',      token: '--q-text-faint',   sample: 'Placeholder, ghost, disabled' },
  { label: 'Info/amber', token: '--q-text-info',    sample: 'Informational callouts, DM hints' },
  { label: 'Warning',    token: '--q-text-warning', sample: 'Warning messages, caution' },
  { label: 'Danger',     token: '--q-text-danger',  sample: 'Error states, destructive actions' },
];

const BADGE_TOKENS = [
  { label: 'Primary',  bg: '--q-accent-primary-trace', fg: '--q-accent-primary', border: '--q-accent-primary-border' },
  { label: 'Quest',    bg: '--q-accent-quest-trace',   fg: '--q-accent-quest',   border: '--q-accent-quest-border' },
  { label: 'Success',  bg: '--q-accent-success-trace', fg: '--q-accent-success', border: '--q-accent-success-border' },
  { label: 'Danger',   bg: '--q-accent-danger-trace',  fg: '--q-accent-danger',  border: '--q-accent-danger-border' },
  { label: 'Arcane',   bg: '--q-accent-arcane-trace',  fg: '--q-accent-arcane',  border: '--q-accent-arcane-border' },
  { label: 'Neutral',  bg: '--q-accent-neutral-trace', fg: '--q-accent-neutral', border: '--q-accent-neutral-border' },
];

export default function ThemePage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  return (
    /* Full-width bg-fill so the atmospheric body image doesn't bleed through on the right */
    <div className="min-h-full w-full" style={{ background: 'var(--q-bg)', color: 'var(--q-text)' }}>
      <div className="p-8 max-w-4xl space-y-10">

        {/* Header */}
        <div>
          <p className="label-overline">Dev</p>
          <div className="section-rule mt-1 mb-3" />
          <div className="flex items-center justify-between">
            <h1 style={{ fontFamily: 'var(--q-font-display)', fontSize: '1.75rem' }}>
              Theme Testing
            </h1>
            <Toggle />
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--q-text-dim)' }}>
            Mode: <strong style={{ color: 'var(--q-accent-primary)' }}>{mounted ? (isDark ? 'dark' : 'light') : '…'}</strong>
            {' '}— toggle to compare. Each surface row uses its own token as background.
          </p>
        </div>

        {/* Surfaces — each row IS the surface color */}
        <Section title="Surfaces">
          <div className="space-y-1">
            {SURFACES.map(({ label, token }) => (
              <div
                key={token}
                className="flex items-center gap-4 rounded-lg px-4 py-2.5 border"
                style={{
                  background: `var(${token})`,
                  borderColor: 'var(--q-border)',
                  color: 'var(--q-text)',
                }}
              >
                <code style={{ color: 'var(--q-accent-primary)', fontSize: '0.72rem', minWidth: '14rem' }}>{token}</code>
                <span className="text-sm" style={{ color: 'var(--q-text-dim)' }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Borders — show thickness variation */}
        <Section title="Borders">
          <div className="space-y-3">
            {BORDERS.map(({ label, token }) => (
              <div key={token} className="flex items-center gap-4">
                <div
                  className="h-8 rounded flex-1"
                  style={{ border: `2px solid var(${token})`, background: 'var(--q-surface-flat)' }}
                />
                <code className="w-56 shrink-0 text-xs" style={{ color: 'var(--q-accent-primary)' }}>{token}</code>
                <span className="w-32 shrink-0 text-sm" style={{ color: 'var(--q-text-faint)' }}>{label}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Text */}
        <Section title="Typography">
          <div className="space-y-2">
            {TEXT_TOKENS.map(({ label, token, sample }) => (
              <div
                key={token}
                className="flex items-baseline gap-4 rounded-lg px-4 py-2 border"
                style={{ borderColor: 'var(--q-border-subtle)', background: 'var(--q-surface-flat)' }}
              >
                <span className="w-24 shrink-0 text-xs" style={{ color: 'var(--q-text-faint)' }}>{label}</span>
                <code className="w-48 shrink-0 text-xs" style={{ color: 'var(--q-accent-primary)' }}>{token}</code>
                <span className="text-sm" style={{ color: `var(${token})` }}>{sample}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Accent badges */}
        <Section title="Accent Tokens">
          <div className="flex flex-wrap gap-2">
            {BADGE_TOKENS.map(({ label, bg, fg, border }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border"
                style={{ background: `var(${bg})`, color: `var(${fg})`, borderColor: `var(${border})` }}
              >
                <Check className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>

          {/* Solid accent dots for contrast check */}
          <div className="flex gap-3 mt-3">
            {['--q-accent-primary','--q-accent-quest','--q-accent-success','--q-accent-danger','--q-accent-arcane','--q-accent-neutral'].map(t => (
              <div
                key={t}
                className="h-8 w-8 rounded-full"
                title={t}
                style={{ background: `var(${t})` }}
              />
            ))}
          </div>
        </Section>

        {/* Components */}
        <Section title="Components">

          <div className="space-y-1 mb-1">
            <p className="text-xs" style={{ color: 'var(--q-text-faint)' }}>Buttons</p>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium"
              style={{ background: 'var(--q-accent-primary)', color: 'oklch(0.1 0.005 240)' }}
            >
              Primary Action
            </button>
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium border"
              style={{ background: 'var(--q-surface-raised)', borderColor: 'var(--q-border)', color: 'var(--q-text)' }}
            >
              Secondary
            </button>
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium border"
              style={{ background: 'var(--q-accent-danger-trace)', borderColor: 'var(--q-accent-danger-border)', color: 'var(--q-accent-danger)' }}
            >
              Destructive
            </button>
          </div>

          <div className="space-y-1 mb-1">
            <p className="text-xs" style={{ color: 'var(--q-text-faint)' }}>Feature card</p>
          </div>
          <div
            className="rounded-xl p-5 border mb-6"
            style={{ background: 'var(--q-surface-feature)', borderColor: 'var(--q-border-feature)' }}
          >
            <p className="label-overline mb-1">Section Title</p>
            <div className="section-rule mb-3" />
            <p className="text-sm" style={{ color: 'var(--q-text-dim)' }}>
              Feature card body — used throughout the app for grouped content areas.
            </p>
            <div
              className="mt-3 rounded-lg p-3 border"
              style={{ background: 'var(--q-surface-inset)', borderColor: 'var(--q-border-subtle)' }}
            >
              <p className="text-xs" style={{ color: 'var(--q-text-faint)' }}>Inset panel — --q-surface-inset</p>
            </div>
          </div>

          <div className="space-y-1 mb-1">
            <p className="text-xs" style={{ color: 'var(--q-text-faint)' }}>Input</p>
          </div>
          <input
            readOnly
            value="Sample input text"
            className="w-full rounded-lg px-3 h-9 text-sm border outline-none"
            style={{ background: 'var(--q-surface-sunken)', borderColor: 'var(--q-border)', color: 'var(--q-text)' }}
          />

        </Section>

      </div>
    </div>
  );
}
