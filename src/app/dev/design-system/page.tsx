'use client';

const ACCENTS = [
  { name: 'Primary / Amber', token: '--q-accent-primary', border: '--q-accent-primary-border', trace: '--q-accent-primary-trace' },
  { name: 'Quest',           token: '--q-accent-quest',   border: '--q-accent-quest-border',   trace: '--q-accent-quest-trace' },
  { name: 'Success',         token: '--q-accent-success', border: '--q-accent-success-border', trace: '--q-accent-success-trace' },
  { name: 'Danger',          token: '--q-accent-danger',  border: '--q-accent-danger-border',  trace: '--q-accent-danger-trace' },
  { name: 'Arcane',          token: '--q-accent-arcane',  border: '--q-accent-arcane-border',  trace: '--q-accent-arcane-trace' },
  { name: 'Neutral',         token: '--q-accent-neutral', border: '--q-accent-neutral-border', trace: '--q-accent-neutral-trace' },
];

const SURFACES = [
  { name: 'bg',          token: '--q-bg' },
  { name: 'sunken',      token: '--q-surface-sunken' },
  { name: 'flat',        token: '--q-surface-flat' },
  { name: 'raised',      token: '--q-surface-raised' },
  { name: 'utility',     token: '--q-surface-utility' },
  { name: 'feature',     token: '--q-surface-feature' },
  { name: 'hero',        token: '--q-surface-hero' },
  { name: 'signature',   token: '--q-surface-signature' },
];

const TEXT_TOKENS = [
  { name: 'text',         token: '--q-text',         label: 'Primary' },
  { name: 'text-dim',     token: '--q-text-dim',     label: 'Dim' },
  { name: 'text-faint',   token: '--q-text-faint',   label: 'Faint' },
  { name: 'text-info',    token: '--q-text-info',    label: 'Info / Amber' },
  { name: 'text-warning', token: '--q-text-warning', label: 'Warning' },
  { name: 'text-danger',  token: '--q-text-danger',  label: 'Danger' },
];

const BORDERS = [
  { name: 'border',           token: '--q-border' },
  { name: 'border-subtle',    token: '--q-border-subtle' },
  { name: 'border-feature',   token: '--q-border-feature' },
  { name: 'border-hero',      token: '--q-border-hero' },
  { name: 'border-signature', token: '--q-border-signature' },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="section-rule" />
      <h2 className="label-overline">{children}</h2>
    </div>
  );
}

function StyleCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`stone-card q-panel-grain ${className ?? ''}`}
      style={{ padding: '1.25rem' }}
    >
      {children}
    </div>
  );
}

function TokenLabel({ token }: { token: string }) {
  return (
    <code className="text-[9px] tracking-[.04em] opacity-50 font-mono">
      {token}
    </code>
  );
}

export default function DesignSystemPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        padding: '2rem 2.5rem',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <div className="mb-8">
        <div className="label-overline mb-2">Dev</div>
        <h1
          className="text-fluid-2xl"
          style={{ fontFamily: 'var(--q-font-display)', color: 'var(--q-text)' }}
        >
          Design System
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--q-text-dim)' }}>
          Token reference — typography, colour, surfaces, borders
        </p>
      </div>

      {/* ── Typography ─────────────────────────────────────────────────── */}
      <SectionHeading>Typography</SectionHeading>
      <div className="space-y-3 mb-10">

        <StyleCard>
          <TokenLabel token="--q-font-display · Cinzel" />
          <div className="mt-3 space-y-2">
            {[
              { cls: 'text-fluid-4xl', label: '4xl fluid · Display title' },
              { cls: 'text-fluid-3xl', label: '3xl fluid · Page heading' },
              { cls: 'text-fluid-2xl', label: '2xl fluid · Section heading' },
              { cls: 'text-fluid-xl',  label: 'xl fluid · Sub-heading' },
              { cls: 'text-lg',        label: 'lg · Card title' },
              { cls: 'text-sm',        label: 'sm · UI label' },
            ].map(({ cls, label }) => (
              <div key={cls} className="flex items-baseline gap-3">
                <span
                  className={`${cls} leading-none`}
                  style={{ fontFamily: 'var(--q-font-display)', color: 'var(--q-text)', minWidth: 220 }}
                >
                  Campaign Begins
                </span>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--q-text-faint)' }}>
                  {label} · <code>{cls}</code>
                </span>
              </div>
            ))}
          </div>
        </StyleCard>

        <StyleCard>
          <TokenLabel token="--q-font-body · Bricolage Grotesque" />
          <div className="mt-3 space-y-2">
            {[
              { size: 'text-base', weight: 'font-normal',    label: 'base / normal — body copy' },
              { size: 'text-base', weight: 'font-semibold',  label: 'base / semibold — emphasis' },
              { size: 'text-sm',   weight: 'font-normal',    label: 'sm / normal — secondary text' },
              { size: 'text-xs',   weight: 'font-medium',    label: 'xs / medium — captions, badges' },
            ].map(({ size, weight, label }) => (
              <div key={label} className="flex items-baseline gap-3">
                <span
                  className={`${size} ${weight} leading-snug`}
                  style={{ color: 'var(--q-text)', minWidth: 260 }}
                >
                  The dungeon master calls for a perception check.
                </span>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--q-text-faint)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </StyleCard>

        <StyleCard>
          <TokenLabel token="--q-font-mono · JetBrains Mono" />
          <div className="mt-3 space-y-2">
            {[
              { text: 'AC 17 · HP 136 · Speed 30 ft',     label: 'stat line' },
              { text: '+4 STR  +2 DEX  −1 CON',            label: 'ability mods' },
              { text: '4d6 + 3 bludgeoning',               label: 'damage roll' },
              { text: 'd20 → 14 · DC 15 → fail',           label: 'roll result' },
            ].map(({ text, label }) => (
              <div key={label} className="flex items-baseline gap-3">
                <code
                  className="text-sm leading-none"
                  style={{ color: 'var(--q-text-info)', minWidth: 260 }}
                >
                  {text}
                </code>
                <span className="text-[10px]" style={{ color: 'var(--q-text-faint)' }}>{label}</span>
              </div>
            ))}
          </div>
        </StyleCard>

        <StyleCard>
          <TokenLabel token="Utilities — label-overline · section-rule · text-gradient-amber" />
          <div className="mt-4 space-y-4">
            <div>
              <div className="section-rule" />
              <div className="label-overline">Session Prep</div>
            </div>
            <div>
              <span className="text-fluid-3xl text-gradient-amber" style={{ fontFamily: 'var(--q-font-display)' }}>
                QuiverDM
              </span>
            </div>
            <div className="animate-shimmer text-lg" style={{ fontFamily: 'var(--q-font-display)' }}>
              Arcane Intelligence
            </div>
          </div>
        </StyleCard>

      </div>

      {/* ── Colour — Accents ───────────────────────────────────────────── */}
      <SectionHeading>Colour — Semantic Accents</SectionHeading>
      <StyleCard className="mb-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACCENTS.map(({ name, token, border, trace }) => (
            <div
              key={name}
              className="rounded-[3px] overflow-hidden border"
              style={{ borderColor: `var(${border})`, background: `var(${trace})` }}
            >
              <div
                className="h-8"
                style={{ background: `var(${token})` }}
              />
              <div className="px-2 py-2">
                <div className="text-[11px] font-semibold" style={{ color: `var(${token})` }}>
                  {name}
                </div>
                <TokenLabel token={token} />
              </div>
            </div>
          ))}
        </div>
      </StyleCard>

      {/* ── Colour — Text ─────────────────────────────────────────────── */}
      <SectionHeading>Colour — Text</SectionHeading>
      <StyleCard className="mb-3">
        <div className="space-y-2">
          {TEXT_TOKENS.map(({ token, label }) => (
            <div key={token} className="flex items-center gap-3">
              <span
                className="text-sm font-medium w-36"
                style={{ color: `var(${token})` }}
              >
                {label}
              </span>
              <TokenLabel token={token} />
            </div>
          ))}
        </div>
      </StyleCard>

      {/* ── Colour — Surfaces ─────────────────────────────────────────── */}
      <SectionHeading>Colour — Surfaces</SectionHeading>
      <StyleCard className="mb-3">
        <div className="grid grid-cols-4 gap-2">
          {SURFACES.map(({ name, token }) => (
            <div key={name} className="rounded-[3px] overflow-hidden border" style={{ borderColor: 'var(--q-border-subtle)' }}>
              <div
                className="h-10"
                style={{ background: `var(${token})` }}
              />
              <div className="px-2 py-1">
                <div className="text-[10px] font-semibold" style={{ color: 'var(--q-text-dim)' }}>
                  {name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </StyleCard>

      {/* ── Colour — Borders ──────────────────────────────────────────── */}
      <SectionHeading>Colour — Borders</SectionHeading>
      <StyleCard className="mb-10">
        <div className="space-y-2">
          {BORDERS.map(({ name, token }) => (
            <div key={name} className="flex items-center gap-4">
              <div
                className="h-5 w-32 rounded-[2px] border-2"
                style={{ borderColor: `var(${token})`, background: 'transparent' }}
              />
              <TokenLabel token={token} />
            </div>
          ))}
        </div>
      </StyleCard>

    </div>
  );
}
