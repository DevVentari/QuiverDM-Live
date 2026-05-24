'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun, Check } from 'lucide-react';

function Toggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-36" />;
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 rounded-lg px-4 h-10 text-sm font-medium transition-colors border"
      style={{
        background: 'var(--q-surface-raised)',
        borderColor: 'var(--q-border)',
        color: 'var(--q-text)',
      }}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      Switch to {isDark ? 'Light' : 'Dark'}
      <span
        className="ml-1 text-xs rounded px-1.5 py-0.5"
        style={{ background: 'var(--q-surface-inset)', color: 'var(--q-text-faint)' }}
      >
        {isDark ? 'dark' : 'light'}
      </span>
    </button>
  );
}

function Row({ label, token, swatch }: { label: string; token: string; swatch?: boolean }) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg px-4 py-2 text-sm border"
      style={{ borderColor: 'var(--q-border-subtle)', background: 'var(--q-surface-inset)' }}
    >
      {swatch && (
        <div
          className="h-6 w-6 shrink-0 rounded border"
          style={{ background: `var(${token})`, borderColor: 'var(--q-border-subtle)' }}
        />
      )}
      <code style={{ color: 'var(--q-accent-primary)', fontSize: '0.72rem' }}>{token}</code>
      <span style={{ color: 'var(--q-text-faint)' }}>{label}</span>
    </div>
  );
}

function Section({ title, children }: { children: React.ReactNode; title: string }) {
  return (
    <div className="space-y-2">
      <div className="mb-3">
        <p className="label-overline">{title}</p>
        <div className="section-rule mt-1" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const BADGE_TOKENS = [
  { label: 'Primary / Amber', bg: '--q-accent-primary-trace', fg: '--q-accent-primary', border: '--q-accent-primary-border' },
  { label: 'Quest',           bg: '--q-accent-quest-trace',   fg: '--q-accent-quest',   border: '--q-accent-quest-border' },
  { label: 'Success',         bg: '--q-accent-success-trace', fg: '--q-accent-success', border: '--q-accent-success-border' },
  { label: 'Danger',          bg: '--q-accent-danger-trace',  fg: '--q-accent-danger',  border: '--q-accent-danger-border' },
  { label: 'Arcane',          bg: '--q-accent-arcane-trace',  fg: '--q-accent-arcane',  border: '--q-accent-arcane-border' },
  { label: 'Neutral',         bg: '--q-accent-neutral-trace', fg: '--q-accent-neutral', border: '--q-accent-neutral-border' },
];

export default function ThemePage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="p-8 max-w-4xl space-y-10" style={{ color: 'var(--q-text)' }}>

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
          Current mode: <strong style={{ color: 'var(--q-accent-primary)' }}>{mounted ? (isDark ? 'dark' : 'light') : '…'}</strong>
          {' '}&mdash; toggle above to preview both themes. Tokens are live CSS vars.
        </p>
      </div>

      {/* Surfaces */}
      <Section title="Surfaces">
        {[
          { label: 'Page background',   token: '--q-bg' },
          { label: 'Sunken / inset well', token: '--q-surface-sunken' },
          { label: 'Flat surface',      token: '--q-surface-flat' },
          { label: 'Raised / card',     token: '--q-surface-raised' },
          { label: 'Inset panel (new)', token: '--q-surface-inset' },
          { label: 'Utility (semi)',    token: '--q-surface-utility' },
          { label: 'Feature (semi)',    token: '--q-surface-feature' },
          { label: 'Hero (semi)',       token: '--q-surface-hero' },
          { label: 'Signature (semi)',  token: '--q-surface-signature' },
          { label: 'Shell bar',         token: '--q-shell-bar' },
          { label: 'Shell rail',        token: '--q-shell-rail' },
        ].map(({ label, token }) => <Row key={token} label={label} token={token} swatch />)}
      </Section>

      {/* Borders */}
      <Section title="Borders">
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Default border',    token: '--q-border' },
            { label: 'Subtle border',     token: '--q-border-subtle' },
            { label: 'Feature border',    token: '--q-border-feature' },
            { label: 'Hero border',       token: '--q-border-hero' },
            { label: 'Signature border',  token: '--q-border-signature' },
          ].map(({ label, token }) => (
            <div key={token} className="flex items-center gap-4">
              <div
                className="h-8 flex-1 rounded"
                style={{
                  border: `1px solid var(${token})`,
                  background: 'var(--q-surface-inset)',
                }}
              />
              <code className="w-56 shrink-0 text-xs" style={{ color: 'var(--q-accent-primary)' }}>{token}</code>
              <span className="w-40 shrink-0 text-sm" style={{ color: 'var(--q-text-faint)' }}>{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Text */}
      <Section title="Typography">
        {[
          { label: 'Primary text',  token: '--q-text',         sample: 'The quick brown fox jumps over the lazy dog' },
          { label: 'Dim text',      token: '--q-text-dim',     sample: 'Supporting copy, captions, metadata' },
          { label: 'Faint text',    token: '--q-text-faint',   sample: 'Placeholder, ghost, disabled labels' },
          { label: 'Info / amber',  token: '--q-text-info',    sample: 'Informational callouts, DM hints' },
          { label: 'Warning',       token: '--q-text-warning', sample: 'Warning messages, caution' },
          { label: 'Danger',        token: '--q-text-danger',  sample: 'Error states, destructive actions' },
        ].map(({ label, token, sample }) => (
          <div key={token} className="flex items-baseline gap-4">
            <span className="w-36 shrink-0 text-xs" style={{ color: 'var(--q-text-faint)' }}>{label}</span>
            <code className="w-52 shrink-0 text-xs" style={{ color: 'var(--q-accent-primary)' }}>{token}</code>
            <span className="text-sm" style={{ color: `var(${token})` }}>{sample}</span>
          </div>
        ))}
      </Section>

      {/* Accent badges */}
      <Section title="Accent Badges">
        <div className="flex flex-wrap gap-2">
          {BADGE_TOKENS.map(({ label, bg, fg, border }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border"
              style={{
                background: `var(${bg})`,
                color: `var(${fg})`,
                borderColor: `var(${border})`,
              }}
            >
              <Check className="h-3 w-3" />
              {label}
            </span>
          ))}
        </div>
      </Section>

      {/* Component previews */}
      <Section title="Component Previews">

        {/* Buttons */}
        <div className="space-y-1">
          <p className="text-xs mb-2" style={{ color: 'var(--q-text-faint)' }}>Buttons</p>
          <div className="flex flex-wrap gap-3">
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--q-accent-primary)', color: 'oklch(0.1 0.005 240)' }}
            >
              Primary Action
            </button>
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium transition-colors border"
              style={{ background: 'var(--q-surface-raised)', borderColor: 'var(--q-border)', color: 'var(--q-text)' }}
            >
              Secondary
            </button>
            <button
              className="px-4 h-9 rounded-lg text-sm font-medium transition-colors border"
              style={{ background: 'var(--q-accent-danger-trace)', borderColor: 'var(--q-accent-danger-border)', color: 'var(--q-accent-danger)' }}
            >
              Destructive
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="mt-4 space-y-1">
          <p className="text-xs mb-2" style={{ color: 'var(--q-text-faint)' }}>Card (feature)</p>
          <div
            className="rounded-xl p-5 border"
            style={{
              background: 'var(--q-surface-feature)',
              borderColor: 'var(--q-border-feature)',
            }}
          >
            <p className="label-overline mb-1">Section Title</p>
            <div className="section-rule mb-3" />
            <p className="text-sm" style={{ color: 'var(--q-text-dim)' }}>
              This is a feature card with a section rule and label-overline header. Used throughout the app for grouped content areas.
            </p>
            <div
              className="mt-3 rounded-lg p-3 border"
              style={{ background: 'var(--q-surface-inset)', borderColor: 'var(--q-border-subtle)' }}
            >
              <p className="text-xs" style={{ color: 'var(--q-text-faint)' }}>Inset panel inside feature card — uses --q-surface-inset</p>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="mt-4 space-y-1">
          <p className="text-xs mb-2" style={{ color: 'var(--q-text-faint)' }}>Input</p>
          <input
            readOnly
            value="Sample input text"
            className="w-full rounded-lg px-3 h-9 text-sm border outline-none"
            style={{
              background: 'var(--q-surface-sunken)',
              borderColor: 'var(--q-border)',
              color: 'var(--q-text)',
            }}
          />
        </div>

      </Section>

    </div>
  );
}
