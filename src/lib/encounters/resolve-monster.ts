/**
 * Resolve an encounter's free-text monster name (e.g. "human zombie",
 * "Werewolf (Kiril Stoyanovich)", "Vine Blight") to a stat block — preferring
 * book-unique creatures (campaign homebrew) over the SRD bestiary, falling back
 * to a plain custom label when nothing matches.
 *
 * Used to turn EVENT/encounter entities' `properties.monsters` strings into
 * EncounterPlanCreature rows linked to real stat blocks.
 */
import { getAllMonsters, formatCr, type SrdMonster } from '@/lib/srd/monsters';
import { xpForCr } from '@/lib/dnd5e/encounter-calculator';

export interface CreatureSource {
  name: string;
  id?: string;
  cr?: string | number;
  xp?: number;
  /** The creature's stored data blob (homebrew shape: hp/ac/abilities…). */
  statBlock: Record<string, unknown>;
}

export interface ResolvedCreature {
  name: string;
  cr?: string;
  xp?: number;
  sourceType: 'srd' | 'homebrew' | 'custom';
  sourceId?: string;
  /** Always carries hitPoints/armorClass so launchToTracker + UI work uniformly. */
  statBlock?: Record<string, unknown>;
}

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .replace(/['’]s$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function singular(n: string): string | null {
  if (n.endsWith('ves')) return `${n.slice(0, -3)}f`;
  if (n.endsWith('es')) return n.slice(0, -2);
  if (n.endsWith('s')) return n.slice(0, -1);
  return null;
}

/** Ordered normalized name variants to try, most specific first. */
function candidates(raw: string): string[] {
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    if (!s) return;
    const n = normalize(s);
    if (n && !out.includes(n)) out.push(n);
  };

  const paren = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  const outer = paren ? paren[1] : raw;
  const inner = paren ? paren[2] : null;

  push(raw);
  push(outer); // "Werewolf (Kiril…)" → "werewolf"; "Rahadin (dusk elf)" → "rahadin"
  push(inner); // "(Kiril Stoyanovich)" → specific named creature
  push(singular(normalize(outer)));
  push(inner ? singular(normalize(inner)) : null);
  // Qualifier strip: "human zombie" → "zombie" (last word), "young red dragon" → "dragon"
  const words = normalize(outer).split(' ');
  if (words.length > 1) {
    push(words[words.length - 1]);
    push(singular(words[words.length - 1]));
  }
  return out;
}

const SRD_BY_NAME: Map<string, SrdMonster> = new Map(getAllMonsters().map((m) => [normalize(m.name), m]));

function srdStatBlock(m: SrdMonster): Record<string, unknown> {
  // SrdMonster already uses hitPoints/armorClass — pass through with the fields
  // the tracker + compendium read.
  return { ...m, hitPoints: m.hitPoints, armorClass: m.armorClass };
}

function homebrewStatBlock(src: CreatureSource): Record<string, unknown> {
  const d = src.statBlock ?? {};
  return {
    ...d,
    // Map our homebrew blob (hp/ac) → hitPoints/armorClass for launchToTracker.
    hitPoints: typeof d.hp === 'number' ? d.hp : d.hitPoints,
    armorClass: typeof d.ac === 'number' ? d.ac : d.armorClass,
  };
}

function crString(cr: string | number | undefined): string | undefined {
  if (cr === undefined || cr === null || cr === '') return undefined;
  return typeof cr === 'number' ? formatCr(cr) : String(cr);
}

/** XP from the source, else derived from CR (the bundled SRD set omits some xp). */
function resolveXp(xp: number | undefined, cr: string | undefined): number | undefined {
  if (typeof xp === 'number' && xp > 0) return xp;
  return cr ? xpForCr(cr) : undefined;
}

/**
 * Build a resolver over a campaign's book-unique creature homebrew. Each call
 * resolves one raw monster name. Book creatures win over SRD; SRD over custom.
 */
export function makeMonsterResolver(homebrewCreatures: CreatureSource[]): (raw: string) => ResolvedCreature {
  const homebrewByName = new Map<string, CreatureSource>();
  for (const c of homebrewCreatures) homebrewByName.set(normalize(c.name), c);

  return (raw: string): ResolvedCreature => {
    const keys = candidates(raw);
    // Pass 1: book-unique creatures win across ALL name variants (so an inner
    // parenthetical "(Kiril Stoyanovich)" beats the outer generic "Werewolf").
    for (const key of keys) {
      const hb = homebrewByName.get(key);
      if (hb) {
        const sb = homebrewStatBlock(hb);
        const cr = crString(hb.cr ?? (sb.cr as number | string | undefined));
        return {
          name: hb.name,
          cr,
          xp: resolveXp(hb.xp ?? (typeof sb.xp === 'number' ? (sb.xp as number) : undefined), cr),
          sourceType: 'homebrew',
          sourceId: hb.id,
          statBlock: sb,
        };
      }
    }
    // Pass 2: SRD bestiary.
    for (const key of keys) {
      const srd = SRD_BY_NAME.get(key);
      if (srd) {
        const cr = crString(srd.cr);
        return {
          name: srd.name,
          cr,
          xp: resolveXp(srd.xp, cr),
          sourceType: 'srd',
          statBlock: srdStatBlock(srd),
        };
      }
    }
    return { name: raw.trim(), sourceType: 'custom' };
  };
}
