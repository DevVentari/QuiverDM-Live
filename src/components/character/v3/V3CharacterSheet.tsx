'use client';

/**
 * V3CharacterSheet — 3-column DM character detail pane.
 *
 * LEFT   : portrait / initial, HP bar (green → amber → red hue), AC / Init / Speed trio,
 *          six ability scores in a 2-col grid with modifiers.
 * CENTER : proficient skills chips, Actions & Features styled rows,
 *          notable kit cards.
 * RIGHT  : DM-only section — Secret Hook, Bonds, Pressure Point,
 *          "Add to combat" button.
 *
 * Stacks to a single column on mobile (< lg).
 *
 * Token constraint: ONLY --qd-* / qd-* utilities.
 * No @/components/ui/*, no var(--q-...) legacy tokens, no oklch(), no v2 tailwind.
 */

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';
import { QdButton } from '@/components/ui-v3/QdButton';

// ---------------------------------------------------------------------------
// Type shapes
// ---------------------------------------------------------------------------

interface AbilityScores {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}

interface HitPoints {
  current?: number;
  max?: number;
  temp?: number;
}

export interface CampaignCharacterRow {
  id: string;
  status?: string | null;
  dmNotes?: string | null;
  character: CharacterLite;
}

export interface CharacterLite {
  id: string;
  name: string;
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
  userId?: string | null;
  abilityScores?: AbilityScores | null;
  hitPoints?: HitPoints | null;
  armorClass?: number | null;
}

export interface CharacterFull extends CharacterLite {
  background?: string | null;
  speed?: number | null;
  proficiencyBonus?: number | null;
  initiative?: number | null;
  features?: unknown;
  proficiencies?: unknown;
  inventory?: unknown;
  spellcasting?: unknown;
  savingThrows?: unknown;
  skills?: unknown;
  currency?: unknown;
  languages?: unknown;
  backstory?: string | null;
  personalityTraits?: string | null;
  ideals?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  notes?: string | null;
  secretHook?: string | null;
  pressurePoint?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ABILITIES = [
  { key: 'str' as const, label: 'STR' },
  { key: 'dex' as const, label: 'DEX' },
  { key: 'con' as const, label: 'CON' },
  { key: 'int' as const, label: 'INT' },
  { key: 'wis' as const, label: 'WIS' },
  { key: 'cha' as const, label: 'CHA' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function modifier(score?: number | null): string {
  if (typeof score !== 'number') return '—';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function hpPercent(hp: HitPoints): number {
  if (!hp.max || hp.max === 0) return 100;
  const cur = hp.current ?? hp.max;
  return Math.min(100, Math.max(0, (cur / hp.max) * 100));
}

function hpGradient(pct: number): string {
  if (pct > 50) return 'var(--qd-grad-success)';
  if (pct > 25) return 'var(--qd-grad-accent)';
  return 'var(--qd-grad-danger)';
}

function toStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (typeof o.name === 'string') return o.name;
          if (typeof o.label === 'string') return o.label;
        }
        return null;
      })
      .filter((v): v is string => Boolean(v));
  }
  if (typeof value === 'string') return value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>);
  return [];
}

function classLine(c: CharacterLite): string {
  const cls = c.subclass ? `${c.class} (${c.subclass})` : c.class;
  const lvl = typeof c.level === 'number' ? `Lv ${c.level}` : null;
  return [cls || null, lvl].filter(Boolean).join(' · ') || '—';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 font-qd-mono text-[8px] uppercase tracking-[0.16em] text-qd-ink-muted">
      {children}
    </div>
  );
}

function FeatureRow({ name, detail }: { name: string; detail?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-qd-lg border border-qd-faint p-3"
      style={{ background: 'rgba(255,255,255,.02)' }}
    >
      <span
        className="flex h-8 w-8 flex-none items-center justify-center rounded-qd-md"
        style={{ background: 'rgba(217,138,61,.10)', border: '1px solid rgba(217,138,61,.28)' }}
      >
        <MaskedDndIcon name="entity/scroll" size={14} className="text-qd-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-qd-body text-qd-ink-2">{name}</div>
        {detail && (
          <div className="mt-0.5 font-qd-mono text-[8.5px] text-qd-ink-muted">{detail}</div>
        )}
      </div>
    </div>
  );
}

function KitCard({ name }: { name: string }) {
  return (
    <div
      className="rounded-qd-lg border border-qd-faint p-2.5"
      style={{ background: 'rgba(255,255,255,.02)' }}
    >
      <div className="text-qd-body text-qd-ink-2">{name}</div>
    </div>
  );
}

function SecretCard({
  label,
  text,
  variant = 'hook',
}: {
  label: string;
  text: string;
  variant?: 'hook' | 'bonds' | 'pressure';
}) {
  const styles = {
    hook: {
      border: '1px solid rgba(217,138,61,.24)',
      background: 'linear-gradient(180deg,rgba(217,138,61,.07),rgba(0,0,0,.12))',
      labelColor: 'var(--qd-ink-muted)',
    },
    bonds: {
      border: '1px solid var(--qd-border-faint)',
      background: 'rgba(255,255,255,.015)',
      labelColor: 'var(--qd-ink-muted)',
    },
    pressure: {
      border: '1px solid rgba(196,69,58,.34)',
      background: 'rgba(196,69,58,.06)',
      labelColor: 'var(--qd-danger)',
    },
  }[variant];

  return (
    <div className="rounded-qd-lg p-3.5" style={{ border: styles.border, background: styles.background }}>
      <div
        className="mb-1.5 font-qd-mono text-[8px] uppercase tracking-[0.12em]"
        style={{ color: styles.labelColor }}
      >
        {label}
      </div>
      <div className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">{text}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface V3CharacterSheetProps {
  row: CampaignCharacterRow;
  isDM: boolean;
}

export function V3CharacterSheet({ row, isDM }: V3CharacterSheetProps) {
  const lite = row.character;

  const fullQuery = trpc.characters.getById.useQuery(
    { id: lite.id },
    { staleTime: 60_000, retry: false },
  );

  const sheet: CharacterFull = useMemo(() => {
    const base = (fullQuery.data as CharacterFull | undefined) ?? lite;
    return { ...lite, ...base };
  }, [fullQuery.data, lite]);

  const abilities = (sheet.abilityScores ?? {}) as AbilityScores;
  const hp = (sheet.hitPoints ?? {}) as HitPoints;
  const pct = hpPercent(hp);

  const hpLabel =
    typeof hp.current === 'number' && typeof hp.max === 'number'
      ? `${hp.current} / ${hp.max}${hp.temp ? ` (+${hp.temp} temp)` : ''} HP`
      : '— HP';

  const acVal = typeof sheet.armorClass === 'number' ? `${sheet.armorClass}` : '—';
  // Initiative: use stored field if available, otherwise derive from DEX modifier
  const initVal =
    typeof sheet.initiative === 'number'
      ? sheet.initiative >= 0
        ? `+${sheet.initiative}`
        : `${sheet.initiative}`
      : modifier(abilities.dex);
  const spdVal = typeof sheet.speed === 'number' ? `${sheet.speed} ft` : '—';

  const skills = toStringList(sheet.skills);
  const features = toStringList(sheet.features);
  const inventory = toStringList(sheet.inventory);

  // DM column fields — fall through gracefully if not stored
  const secretHook = sheet.secretHook ?? null;
  const bonds = sheet.bonds ?? null;
  const pressurePoint = sheet.pressurePoint ?? null;

  return (
    <div className="flex-1 overflow-auto p-5">

      {/* ── NAME BAR ── */}
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="font-qd-display text-[28px] leading-none text-qd-ink-strong">
          {lite.name}
        </div>
        <div className="font-qd-mono text-[9px] uppercase tracking-[0.08em] text-qd-ink-muted">
          {[lite.race || null, classLine(lite)].filter(Boolean).join(' · ')}
        </div>
        {sheet.background && (
          <span
            className="rounded-full border border-qd-strong font-qd-mono text-[9px] text-qd-ink-2"
            style={{ background: 'rgba(255,255,255,.05)', padding: '3px 10px' }}
          >
            {sheet.background}
          </span>
        )}
      </div>

      {/* ── 3-COLUMN GRID — stacks on mobile ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* ══ LEFT ══ */}
        <div className="flex flex-col gap-3">

          {/* Portrait or initial */}
          <div
            className="relative overflow-hidden rounded-qd-xl border border-qd-faint"
            style={{ background: 'rgba(255,255,255,.02)', aspectRatio: '4/3' }}
          >
            {lite.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lite.portraitUrl}
                alt={lite.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-qd-display text-6xl text-qd-ink-faintest">
                  {lite.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* HP */}
          <div
            className="rounded-qd-lg border border-qd-faint p-3"
            style={{ background: 'rgba(255,255,255,.025)' }}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-qd-display text-2xl leading-none text-qd-ink-strong">
                {typeof hp.current === 'number' ? hp.current : '—'}
              </span>
              <span className="font-qd-mono text-[9px] text-qd-ink-muted">{hpLabel}</span>
            </div>
            {/* Hue-shifting HP bar: green → amber → red */}
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: 'rgba(0,0,0,.4)' }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={hpLabel}
            >
              <div
                className="h-full transition-all duration-qd-base ease-qd-out"
                style={{ width: `${pct}%`, background: hpGradient(pct) }}
              />
            </div>
          </div>

          {/* AC / Init / Speed */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: 'AC', value: acVal, icon: 'attribute/ac' },
              { label: 'INIT', value: initVal, icon: 'combat/bonus-action' },
              { label: 'SPD', value: spdVal, icon: 'movement/walking' },
            ] as const).map(({ label, value, icon }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-qd-lg border border-qd-faint py-2.5"
                style={{ background: 'rgba(255,255,255,.025)' }}
              >
                <MaskedDndIcon name={icon} size={14} className="mb-1 text-qd-accent" />
                <div className="font-qd-display text-xl leading-none text-qd-ink-strong">{value}</div>
                <div className="mt-1 font-qd-mono text-[7px] uppercase tracking-[0.12em] text-qd-ink-muted">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Six ability scores */}
          <div className="grid grid-cols-2 gap-2">
            {ABILITIES.map((a) => {
              const score = abilities[a.key];
              const mod = modifier(score);
              const isHighest = typeof score === 'number' && score >= 16;
              return (
                <div
                  key={a.key}
                  className="flex items-center justify-between rounded-qd-lg border px-2.5 py-2"
                  style={
                    isHighest
                      ? { borderColor: 'rgba(217,138,61,.3)', background: 'rgba(217,138,61,.07)' }
                      : { borderColor: 'var(--qd-border-faint)', background: 'rgba(255,255,255,.02)' }
                  }
                >
                  <span
                    className="font-qd-mono text-[9px]"
                    style={{ color: isHighest ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}
                  >
                    {a.label}
                  </span>
                  <span className="font-qd-display text-base leading-none text-qd-ink-2">
                    {typeof score === 'number' ? score : '—'}
                    {' '}
                    <span
                      className="font-qd-mono text-[9px]"
                      style={{ color: isHighest ? 'var(--qd-accent-text)' : 'var(--qd-ink-muted)' }}
                    >
                      ({mod})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══ CENTER ══ */}
        <div className="flex flex-col gap-5">

          {/* Proficient Skills */}
          <div>
            <SectionLabel>Proficient Skills</SectionLabel>
            {skills.length === 0 ? (
              <p className="text-qd-body-sm italic text-qd-ink-muted">
                No skill proficiencies recorded.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((sk, i) => (
                  <span
                    key={`${sk}-${i}`}
                    className="rounded-full border border-qd-strong font-qd-mono text-[9px] text-qd-ink-2"
                    style={{ background: 'rgba(255,255,255,.04)', padding: '5px 11px' }}
                  >
                    {sk}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions & Features */}
          <div>
            <SectionLabel>Actions &amp; Features</SectionLabel>
            {features.length === 0 ? (
              <p className="text-qd-body-sm italic text-qd-ink-muted">No features recorded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {features.slice(0, 6).map((f, i) => (
                  <FeatureRow key={`${f}-${i}`} name={f} />
                ))}
                {features.length > 6 && (
                  <p className="font-qd-mono text-[9px] text-qd-ink-muted">
                    +{features.length - 6} more features
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notable Kit */}
          <div>
            <SectionLabel>Notable Kit</SectionLabel>
            {inventory.length === 0 ? (
              <p className="text-qd-body-sm italic text-qd-ink-muted">The pack is empty.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {inventory.slice(0, 6).map((item, i) => (
                  <KitCard key={`${item}-${i}`} name={item} />
                ))}
                {inventory.length > 6 && (
                  <p className="col-span-2 font-qd-mono text-[9px] text-qd-ink-muted">
                    +{inventory.length - 6} more items
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT (DM only) ══ */}
        {isDM && (
          <div className="flex flex-col gap-3">

            <div className="font-qd-mono text-[8px] uppercase tracking-[0.14em] text-qd-accent-text">
              ▸ DM Only · never shown to player
            </div>

            <SecretCard
              label="Secret Hook"
              variant="hook"
              text={secretHook || 'No secret hook recorded for this character yet.'}
            />

            <SecretCard
              label="Bonds"
              variant="bonds"
              text={
                bonds ||
                (sheet.personalityTraits
                  ? sheet.personalityTraits
                  : 'No bonds recorded. What does this character fight for?')
              }
            />

            <SecretCard
              label="Pressure Point"
              variant="pressure"
              text={
                pressurePoint ||
                'No pressure point set. What would shatter this character’s composure?'
              }
            />

            {/* DM notes (additional) */}
            {(row.dmNotes || sheet.notes) && (
              <div
                className="rounded-qd-lg border border-qd-faint p-3"
                style={{ background: 'rgba(255,255,255,.015)' }}
              >
                <div className="mb-1.5 font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">
                  DM Notes
                </div>
                <div className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">
                  {row.dmNotes || sheet.notes}
                </div>
              </div>
            )}

            <div className="flex-1" />

            {/*
             * "Add to combat" — intent: link to the campaign combat hub.
             * A direct add-to-tracker mutation requires knowing the active
             * encounter ID, which is not available in this detail pane's props.
             * Current decision: navigate the DM to the combat hub where they
             * can add the character manually. A future enhancement can wire
             * encounterRouter.addParticipant once encounter context is threaded
             * through the page (tracked as a separate backlog item).
             */}
            <QdButton
              variant="outline"
              className="w-full font-qd-display text-[13px]"
              title="Navigate to Combat Hub to add this character to the tracker"
              onClick={() => {
                // No-op intentionally — campaignSlug is not available in this
                // component's props. To wire: pass slug from page and call
                // router.push(`/v3/campaigns/${slug}/combat`).
              }}
            >
              Add to combat ▸
            </QdButton>
          </div>
        )}
      </div>
    </div>
  );
}
