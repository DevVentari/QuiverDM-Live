'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { MaskedDndIcon } from '@/components/icons/masked-dnd-icon';

// ---------------------------------------------------------------------------
// Player Character Sheet (v3 Player Portal)
// Route: /v3/play/[slug]/character
//
// Player's OWN character only — no CampaignProvider, no useCampaign, no
// DM-only secrets. Slug comes from the URL.
//
// Data flow:
//   1. play.getCampaignHub({ slug })  -> confirms membership, gives campaignId
//      and a lite character ({ name, class, level, portraitUrl }) IF bound.
//   2. characters.getMyCharacters()   -> the player's own characters, each with
//      an `id` and `campaignCharacters[].campaign.slug`. We match this campaign
//      by slug to recover the character id + full sheet.
//   3. characters.getById({ id })     -> richest owner sheet (same findById
//      shape). Layered on top when present.
//
// Every JSON blob is read defensively with '—' fallbacks.
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
interface Currency {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

// Full owner sheet (Character Prisma model). All JSON fields loosely typed.
interface CharacterFull {
  id: string;
  name: string;
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level?: number | null;
  background?: string | null;
  portraitUrl?: string | null;
  abilityScores?: AbilityScores | null;
  hitPoints?: HitPoints | null;
  armorClass?: number | null;
  speed?: number | null;
  proficiencyBonus?: number | null;
  features?: unknown;
  proficiencies?: unknown;
  inventory?: unknown;
  spellcasting?: unknown;
  savingThrows?: unknown;
  languages?: unknown;
  currency?: Currency | null;
  personalityTraits?: string | null;
  backstory?: string | null;
  notes?: string | null;
}

// Lite character returned by getCampaignHub.
interface HubCharacter {
  name: string;
  class?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
}

// Row from getMyCharacters (Character + campaignCharacters[].campaign).
interface MyCharacterRow extends CharacterFull {
  campaignCharacters?: Array<{
    campaign?: { id?: string; slug?: string | null } | null;
  }> | null;
}

const ABILITIES = [
  { key: 'str', label: 'STR', icon: 'ability/strength' },
  { key: 'dex', label: 'DEX', icon: 'ability/dexterity' },
  { key: 'con', label: 'CON', icon: 'ability/constitution' },
  { key: 'int', label: 'INT', icon: 'ability/intelligence' },
  { key: 'wis', label: 'WIS', icon: 'ability/wisdom' },
  { key: 'cha', label: 'CHA', icon: 'ability/charisma' },
] as const;

const modifier = (score?: number | null): string => {
  if (typeof score !== 'number') return '—';
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const classLine = (c: { class?: string | null; subclass?: string | null; level?: number | null }): string => {
  const cls = c.subclass ? `${c.class} (${c.subclass})` : c.class;
  const lvl = typeof c.level === 'number' ? `Lv ${c.level}` : null;
  return [cls || null, lvl].filter(Boolean).join(' · ') || '—';
};

// Coerce assorted JSON blobs (features/inventory/proficiencies/spells) into a
// flat string list. Mirrors the DM character page adapter.
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
          if (typeof o.title === 'string') return o.title;
        }
        return null;
      })
      .filter((v): v is string => Boolean(v));
  }
  if (typeof value === 'string') return value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'object') {
    // For maps like savingThrows: { strength: { proficient: true } } pick keys
    // whose value looks "proficient/true", else fall back to every key.
    const obj = value as Record<string, unknown>;
    const proficient = Object.entries(obj)
      .filter(([, v]) => {
        if (v === true) return true;
        if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          return o.proficient === true || o.expertise === true;
        }
        return false;
      })
      .map(([k]) => k);
    return (proficient.length ? proficient : Object.keys(obj)).map(
      (k) => k.charAt(0).toUpperCase() + k.slice(1),
    );
  }
  return [];
}

// Pull a skills list out of proficiencies if there's no dedicated field.
function extractSkills(proficiencies: unknown): string[] {
  if (proficiencies && typeof proficiencies === 'object' && !Array.isArray(proficiencies)) {
    const o = proficiencies as Record<string, unknown>;
    if (o.skills) return toStringList(o.skills);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------

function StatBlock({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-qd-lg border border-qd-faint p-3 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
      <MaskedDndIcon name={icon} size={20} className="text-qd-accent" />
      <div className="mt-1.5 font-qd-display text-2xl leading-none text-qd-ink-strong">{value}</div>
      <div className="mt-1 font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">{label}</div>
    </div>
  );
}

function Section({ icon, label, items, empty }: { icon: string; label: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-qd-lg border border-qd-faint p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="mb-2.5 flex items-center gap-2">
        <MaskedDndIcon name={icon} size={14} className="text-qd-accent" />
        <span className="font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">{label}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-qd-body-sm italic text-qd-ink-muted">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={`${it}-${i}`} className="rounded-full border border-qd-strong bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-qd-mono text-[9px] text-qd-ink-2">
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlayerCharacterSheetPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';

  const hub = trpc.play.getCampaignHub.useQuery({ slug }, { enabled: !!slug, staleTime: 60_000, retry: false });
  const mine = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 60_000 });

  const hubChar = (hub.data?.character as HubCharacter | null) ?? null;

  // Find the player's character bound to THIS campaign (by slug), recovering id.
  const myRow = useMemo<MyCharacterRow | null>(() => {
    const rows = (mine.data as MyCharacterRow[] | undefined) ?? [];
    if (!rows.length) return null;
    const bySlug = rows.find((r) =>
      (r.campaignCharacters ?? []).some((cc) => cc?.campaign?.slug === slug),
    );
    return bySlug ?? null;
  }, [mine.data, slug]);

  const characterId = myRow?.id ?? null;

  // Richest owner sheet (same shape as myRow, but explicit per task spec).
  const full = trpc.characters.getById.useQuery(
    { id: characterId ?? '' },
    { enabled: !!characterId, retry: false, staleTime: 60_000 },
  );

  // Merge: hub lite -> getMyCharacters row -> getById, last wins where present.
  const sheet = useMemo<CharacterFull | null>(() => {
    const base = (full.data as CharacterFull | undefined) ?? myRow ?? null;
    if (!base && !hubChar) return null;
    if (!base && hubChar) {
      // Hub knows a character is bound but we couldn't resolve the full row.
      return {
        id: characterId ?? 'hub',
        name: hubChar.name,
        class: hubChar.class,
        level: hubChar.level,
        portraitUrl: hubChar.portraitUrl,
      };
    }
    return base;
  }, [full.data, myRow, hubChar, characterId]);

  // --- States -------------------------------------------------------------
  const loading = hub.isLoading || mine.isLoading || (!!characterId && full.isLoading);
  if (loading) {
    return <div className="px-8 py-16 text-qd-ink-muted">Unrolling your sheet…</div>;
  }
  if (hub.error || mine.error) {
    return <div className="px-8 py-16 text-qd-ink-muted">The threads tangled. Try again.</div>;
  }
  if (!sheet) {
    return <div className="px-8 py-16 text-qd-ink-muted">No character bound to you here.</div>;
  }

  // --- Derived fields -----------------------------------------------------
  const abilities = (sheet.abilityScores ?? {}) as AbilityScores;
  const hp = (sheet.hitPoints ?? {}) as HitPoints;
  const currency = (sheet.currency ?? {}) as Currency;

  const hpCurrent = typeof hp.current === 'number' ? hp.current : null;
  const hpMax = typeof hp.max === 'number' ? hp.max : null;
  const hpPct = hpCurrent !== null && hpMax ? Math.max(0, Math.min(100, (hpCurrent / hpMax) * 100)) : 0;
  const initMod = modifier(abilities.dex);

  const coinLine = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .map((k) => (currency[k] ? `${currency[k]} ${k}` : null))
    .filter(Boolean)
    .join(' · ');

  const features = toStringList(sheet.features);
  const inventory = toStringList(sheet.inventory);
  const spells = toStringList(sheet.spellcasting);
  const savingThrows = toStringList(sheet.savingThrows);
  const skills = extractSkills(sheet.proficiencies);
  const otherProficiencies = buildOtherProficiencies(sheet.proficiencies, skills);
  const languages = toStringList(sheet.languages);

  return (
    <div className="mx-auto max-w-[760px] p-6">
      {/* HERO HEADER */}
      <div className="rounded-qd-xl border border-qd-faint p-5" style={{ background: 'linear-gradient(180deg,rgba(255,255,255,.035),rgba(0,0,0,.18))' }}>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-qd-lg border border-qd-faint bg-[rgba(255,255,255,0.02)]">
            {sheet.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sheet.portraitUrl} alt={sheet.name} className="h-full w-full object-cover" />
            ) : (
              <span className="font-qd-display text-2xl text-qd-ink-faintest">{sheet.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-qd-display text-[26px] leading-none text-qd-ink-strong">{sheet.name}</div>
            <div className="mt-1.5 font-qd-mono text-[9px] uppercase tracking-[0.07em] text-qd-ink-muted">
              {[sheet.race || null, classLine(sheet)].filter(Boolean).join(' · ') || '—'}
            </div>
            {sheet.background && (
              <div className="mt-1 font-qd-mono text-[9px] uppercase tracking-[0.06em] text-qd-ink-faint">{sheet.background}</div>
            )}
          </div>
        </div>

        {/* HP BAR */}
        <div className="mt-4 flex items-end gap-2">
          <span className="font-qd-display text-[34px] leading-[0.85] text-qd-ink-strong">{hpCurrent ?? '—'}</span>
          <span className="mb-1 text-sm text-qd-ink-muted">/ {hpMax ?? '—'} HP</span>
          <span className="flex-1" />
          {hp.temp ? <span className="font-qd-mono text-[9px] text-qd-success">+{hp.temp} temp</span> : null}
        </div>
        <div className="mt-2 h-[9px] overflow-hidden rounded-[5px] bg-[rgba(0,0,0,.5)]">
          <div className="h-full rounded-[5px]" style={{ width: `${hpPct}%`, background: 'linear-gradient(90deg,#5f8f45,#8fc466)' }} />
        </div>
      </div>

      {/* CORE STAT TRIO */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <StatBlock icon="attribute/ac" label="Armor" value={typeof sheet.armorClass === 'number' ? `${sheet.armorClass}` : '—'} />
        <StatBlock icon="attribute/saving-throw" label="Init" value={initMod} />
        <StatBlock icon="movement/walking" label="Speed" value={typeof sheet.speed === 'number' ? `${sheet.speed}` : '—'} />
      </div>

      {/* ABILITY SCORES */}
      <div className="mt-3 grid grid-cols-6 gap-2">
        {ABILITIES.map((a) => {
          const score = abilities[a.key];
          const isPrimary = a.key === 'dex'; // highlight rogue's key stat style from the design
          return (
            <div
              key={a.key}
              className="flex flex-col items-center rounded-qd-md border p-2 text-center"
              style={
                isPrimary
                  ? { borderColor: 'var(--qd-border-accent)', background: 'rgba(217,138,61,.08)' }
                  : { borderColor: 'var(--qd-border-faint)', background: 'rgba(255,255,255,.02)' }
              }
            >
              <MaskedDndIcon name={a.icon} size={16} className={isPrimary ? 'text-qd-accent' : 'text-qd-ink-muted'} />
              <div className="mt-1 font-qd-mono text-[7px] uppercase tracking-[0.1em] text-qd-ink-muted">{a.label}</div>
              <div className="font-qd-display text-base leading-none text-qd-ink-strong">{typeof score === 'number' ? score : '—'}</div>
              <div className="font-qd-mono text-[9px] text-qd-accent-text">{modifier(score)}</div>
            </div>
          );
        })}
      </div>

      {/* PROFICIENCY + SAVES + SKILLS */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Section icon="attribute/saving-throw" label="Saving Throws" items={savingThrows} empty="No proficient saves recorded." />
        <Section icon="attribute/skillcheck" label="Skills" items={skills} empty="No skill proficiencies recorded." />
      </div>

      {/* PROFICIENCY BONUS pill row */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div className="rounded-qd-lg border border-qd-faint p-3 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="font-qd-display text-lg text-qd-ink-strong">
            {typeof sheet.proficiencyBonus === 'number' ? `+${sheet.proficiencyBonus}` : '—'}
          </div>
          <div className="mt-0.5 font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">Proficiency</div>
        </div>
        <div className="rounded-qd-lg border border-qd-faint p-3 text-center" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="font-qd-mono text-qd-body-sm text-qd-ink-2">{coinLine || '—'}</div>
          <div className="mt-0.5 font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">Coin Purse</div>
        </div>
      </div>

      {/* FEATURES / SPELLS / INVENTORY / PROFICIENCIES / LANGUAGES */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <Section icon="entity/scroll" label="Features & Traits" items={features} empty="No features recorded." />
        <Section icon="entity/spellbook" label="Spells" items={spells} empty="No spells prepared." />
        <Section icon="entity/pack" label="Inventory" items={inventory} empty="The pack is empty." />
        <Section icon="proficiency/proficient" label="Proficiencies" items={otherProficiencies} empty="No proficiencies recorded." />
        <Section icon="entity/book" label="Languages" items={languages} empty="No languages recorded." />
      </div>

      {/* STORY / PERSONALITY */}
      {(sheet.personalityTraits || sheet.backstory) && (
        <div className="mt-3 rounded-qd-lg border border-qd-faint p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
          <div className="mb-2 flex items-center gap-2">
            <MaskedDndIcon name="entity/book" size={14} className="text-qd-accent" />
            <span className="font-qd-mono text-[8px] uppercase tracking-[0.12em] text-qd-ink-muted">Story</span>
          </div>
          {sheet.personalityTraits && (
            <p className="text-qd-body-sm italic leading-relaxed text-qd-ink-2">{sheet.personalityTraits}</p>
          )}
          {sheet.backstory && (
            <p className="mt-2 text-qd-body-sm leading-relaxed text-qd-ink-2">{sheet.backstory}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Build the "other proficiencies" list, dropping anything already shown as a
// skill so the two sections don't duplicate. Plain helper (not a React hook
// despite the name — keep it pure).
function buildOtherProficiencies(proficiencies: unknown, skills: string[]): string[] {
  const all = toStringList(
    proficiencies && typeof proficiencies === 'object' && !Array.isArray(proficiencies)
      ? Object.fromEntries(
          Object.entries(proficiencies as Record<string, unknown>).filter(([k]) => k.toLowerCase() !== 'skills'),
        )
      : proficiencies,
  );
  const skillSet = new Set(skills.map((s) => s.toLowerCase()));
  return all.filter((p) => !skillSet.has(p.toLowerCase()));
}
