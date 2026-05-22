'use client';

import { useState } from 'react';
import { User, Sword, ScrollText, Eye, Sparkles } from 'lucide-react';

import { SpellCard, type SpellCardData } from '@/components/homebrew/SpellCard';
import { MonsterStatBlock } from '@/components/homebrew/MonsterStatBlock';
import { MagicItemCard } from '@/components/homebrew/MagicItemCard';
import { CharacterCard, type CharacterCardData } from '@/components/character/CharacterCard';
import { CharacterQuickViewSheet } from '@/components/character/CharacterQuickViewSheet';
import { EntityCard } from '@/components/primitives/EntityCard';
import { NpcCard, type NpcCardData } from '@/components/npc/npc-card';
import { HomebrewContentCard } from '@/components/homebrew/homebrew-content-card';
import { MechanicCard, type MechanicCardData } from '@/components/mechanics/mechanic-card';
import { StatBlockCard } from '@/components/encounter/stat-block-card';
import { PressureCard } from '@/components/session/prep/pressure-card';
import { WorldEntryCard, type WorldEntryCardData } from '@/components/world/world-entry-card';
import { EncounterCard } from '@/components/encounters/encounter-card';
import type { BriefingCard } from '@/lib/briefing-types';

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="section-rule" />
      <h2 className="label-overline">{children}</h2>
    </div>
  );
}

function noop() {}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Character
const arannis: CharacterCardData = { id: 'f1', name: 'Captain Arannis Vaelor', race: 'Elf', class: 'Wizard', subclass: 'Divination', level: 8, portraitUrl: 'https://picsum.photos/seed/arannis/400/300', dndBeyondId: '12345678', armorClass: 15, speed: 30, proficiencyBonus: 3, hitPoints: { current: 38, max: 52, temp: 0 }, abilityScores: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 }, campaignCharacters: [{ campaign: { id: 'c1', name: 'Curse of Strahd', slug: 'curse-of-strahd' } }] };
const bruenor: CharacterCardData = { id: 'f2', name: 'Bruenor Battlehammer', race: 'Dwarf', class: 'Fighter', subclass: 'Battle Master', level: 5, portraitUrl: null, dndBeyondId: null, armorClass: 18, speed: 25, proficiencyBonus: 3, hitPoints: { current: 12, max: 52 }, abilityScores: { str: 18, dex: 10, con: 16, int: 9, wis: 11, cha: 8 }, campaignCharacters: [{ campaign: { id: 'c1', name: 'Icewind Dale', slug: 'icewind-dale' } }] };
const lyra:    CharacterCardData = { id: 'f3', name: 'Lyra Swiftwind', race: 'Half-Elf', class: 'Rogue', subclass: null, level: 3, portraitUrl: null, dndBeyondId: null, armorClass: 14, speed: 30, proficiencyBonus: 2, hitPoints: { current: 0, max: 0 }, abilityScores: null, campaignCharacters: [] };

// Spell
const fireball:     SpellCardData = { name: 'Fireball',      level: 3,        school: 'evocation',    castingTime: '1 Action', range: '150 ft', duration: 'Instantaneous',            concentration: false, components: { verbal: true, somatic: true, material: true,  materialDesc: 'a tiny ball of bat guano' },         description: 'A bright streak flashes from your finger. Each creature in a **20-foot radius** must make a DEX save or take **8d6 fire damage**.', higherLevels: '+1d6 per slot level above 3rd.', save: 'DEX · Half', classes: ['Wizard', 'Sorcerer'] };
const holdPerson:   SpellCardData = { name: 'Hold Person',   level: 2,        school: 'enchantment',  castingTime: '1 Action', range: '60 ft',  duration: 'Concentration, up to 1 minute', concentration: true,  components: { verbal: true, somatic: true, material: true,  materialDesc: 'a small, straight piece of iron' },  description: 'Choose a humanoid. The target must succeed on a **WIS saving throw** or be **paralyzed** for the duration.', save: 'WIS · Negate', classes: ['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'] };
const mageArmor:    SpellCardData = { name: 'Mage Armor',    level: 1,        school: 'abjuration',   castingTime: '1 Action', range: 'Touch',  duration: '8 hours',                  concentration: false, components: { verbal: true, somatic: true, material: true,  materialDesc: 'a piece of cured leather' },         description: "You touch a willing creature. Until the spell ends, the target's base AC becomes **13 + its Dexterity modifier**.", classes: ['Sorcerer', 'Wizard'] };
const eldritchBlast:SpellCardData = { name: 'Eldritch Blast', level: 'cantrip', school: 'evocation',   castingTime: '1 Action', range: '120 ft', duration: 'Instantaneous',            concentration: false, components: { verbal: true, somatic: true, material: false }, description: 'A beam of crackling energy streaks toward a creature. Make a ranged spell attack. On a hit, the target takes **1d10 force damage**.', classes: ['Warlock'] };

// Monster (homebrew)
const ogre = { name: 'Ogre', size: 'Large' as const, type: 'Giant', alignment: 'Chaotic Evil', cr: 2, xp: 450, ac: 11, acNote: 'hide armour', hp: 59, hpDice: '7d10+21', speed: '40 ft', abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 }, senses: 'Darkvision 60 ft', passivePerception: 8, languages: 'Common, Giant', traits: [{ name: 'Aggressive', description: 'As a bonus action, the ogre can move up to its speed toward a hostile creature.' }], actions: [{ name: 'Greatclub', type: 'Melee Weapon Attack', toHit: 6, reach: '10 ft', damage: '2d8+4 bludgeoning', description: '+6 to hit, reach 10 ft, one target.' }] };
const lich  = { name: 'Lich', size: 'Medium' as const, type: 'Undead', alignment: 'Neutral Evil', cr: 21, xp: 33000, ac: 17, acNote: 'natural armour', hp: 135, hpDice: '18d8+54', speed: '30 ft', abilities: { str: 11, dex: 16, con: 16, int: 20, wis: 14, cha: 16 }, savingThrows: { con: 10, int: 12, wis: 9 }, skills: { 'Arcana': 18, 'History': 12, 'Insight': 9, 'Perception': 9 }, damageResistances: ['cold', 'lightning', 'necrotic'], damageImmunities: ['poison', 'nonmagical weapons'], conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'], senses: 'Truesight 120 ft', passivePerception: 19, languages: 'Common plus up to five other languages', traits: [{ name: 'Legendary Resistance (3/Day)', description: 'If the lich fails a saving throw, it can choose to succeed instead.' }, { name: 'Turn Resistance', description: 'The lich has advantage on saving throws against any effect that turns undead.' }], actions: [{ name: 'Paralyzing Touch', type: 'Melee Spell Attack', toHit: 12, reach: '5 ft', damage: '3d6 cold', description: 'The target must succeed on a DC 18 CON save or be paralyzed until the end of its next turn.' }], legendaryActions: { count: 3, actions: [{ name: 'Cantrip', description: 'The lich casts a cantrip.' }, { name: 'Paralyzing Touch (Costs 2)', description: 'The lich uses Paralyzing Touch.' }, { name: 'Frightening Gaze (Costs 2)', description: 'DC 18 WIS or frightened for 1 minute.' }] } };

// Magic items
const vorpalSword     = { name: 'Vorpal Sword',       rarity: 'legendary' as const, type: 'Weapon · Sword', attunement: true,  description: 'You gain a **+3 bonus** to attack and damage rolls. On a roll of **20**, you cut off one of the target\'s heads.', lore: '"One, two! The vorpal blade went snicker-snack."' };
const ringOfProtection= { name: 'Ring of Protection', rarity: 'rare'      as const, type: 'Ring',           attunement: true,  description: 'You gain a **+1 bonus to AC** and saving throws while wearing this ring.' };
const staffOfTheMagi  = { name: 'Staff of the Magi',  rarity: 'artifact'  as const, type: 'Weapon · Staff', attunement: true,  attunementNote: 'by a sorcerer, warlock, or wizard', description: 'While holding it, you gain a **+2 bonus to spell attack rolls**.', charges: { max: 50, current: 38, reset: 'dawn (4d6+2)' } };
const potionOfHealing = { name: 'Potion of Healing',  rarity: 'common'    as const, type: 'Potion',         attunement: false, description: 'You regain **2d4+2 hit points** when you drink this potion.' };

// NPC
const npcs: NpcCardData[] = [
  { id: 'n1', name: 'Strahd von Zarovich', role: 'Vampire Lord', faction: 'House Zarovich', description: 'The ancient vampire who rules Barovia with an iron will, obsessed with the reincarnation of his lost love Tatyana.', imageUrl: null, _source: 'npc', _fromSourcebook: false, _seen: false },
  { id: 'n2', name: 'Ismark Kolyanovich', role: 'Village Elder', faction: 'Village of Barovia', description: 'Son of the Burgomaster, seeking help to protect his sister Ireena from the vampire count.', imageUrl: null, _source: 'npc', _fromSourcebook: true, _seen: true },
  { id: 'n3', name: 'Madame Eva',         role: 'Vistani Seer',  faction: null,                description: 'An ancient Vistani seer who offers cryptic Tarokka readings to adventurers at Tser Pool.', imageUrl: null, _source: 'entity', _fromSourcebook: true, _seen: false },
];

// Homebrew content
const homebrewItems = [
  { id: 'h1', name: 'Fireball',           type: 'spell',   sourceType: 'manual',          sourcePdf: null,                          tags: [], images: [], imageUrl: null, data: { description: 'A bright streak of fire erupts in a 20-foot radius sphere.' } },
  { id: 'h2', name: 'Shadow Drake',        type: 'creature', sourceType: 'pdf_extraction',  sourcePdf: { filename: 'monster-manual.pdf' }, tags: [], images: [], imageUrl: null, data: { description: 'A draconic predator that hunts from the shadows, breathing necrotic darkness.' } },
  { id: 'h3', name: 'Cloak of Invisibility', type: 'item', sourceType: 'dndbeyond_import', sourcePdf: null,                          tags: [], images: [], imageUrl: null, data: { description: 'While wearing this cloak, you can pull the hood up to become invisible.' } },
];

// Mechanics
const mechanics: MechanicCardData[] = [
  { id: 'm1', kind: 'secret',  name: 'The Amber Temple Revelation', description: 'The party\'s cleric is unknowingly carrying a fragment of the Dark Powers. This secret will reshape the final act.', sourcebook: null, playerVisible: false, assignedToCharacterId: 'f1' },
  { id: 'm2', kind: 'tarot',   name: 'The Hanged Man',              description: 'The Tarokka reading has placed the Holy Symbol of Ravenkind in the belly of the beast — Castle Ravenloft itself.', sourcebook: 'COS', playerVisible: true,  assignedToCharacterId: null },
  { id: 'm3', kind: 'custom',  name: 'Lycanthropy Curse',           description: 'Bruenor was bitten during the ambush at the crossroads. The full moon is in three days.', sourcebook: null, playerVisible: false, assignedToCharacterId: 'f2' },
];

// StatBlockCard (uses SRD structure)
const goblin = {
  name: 'Goblin',
  size: 'Small', type: 'humanoid (goblinoid)', alignment: 'neutral evil',
  challengeRating: '1/4', xp: 50,
  armorClass: 15, armorDesc: 'leather armor, shield',
  hitPoints: 7, hitDice: '2d6',
  speed: { walk: 30 },
  abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
  skills: { Stealth: 6 },
  senses: 'Darkvision 60 ft., Passive Perception 9',
  languages: 'Common, Goblin',
  traits: [{ name: 'Nimble Escape', desc: 'The goblin can take the Disengage or Hide action as a bonus action on each of its turns.' }],
  actions: [
    { name: 'Scimitar', desc: 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6+2) slashing damage.' },
    { name: 'Shortbow', desc: 'Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6+2) piercing damage.' },
  ],
};

// WorldEntryCard fixtures
const worldEntries: WorldEntryCardData[] = [
  { id: 'w1', name: 'Barovia Village',         type: 'LOCATION', summary: 'A fog-shrouded village under the shadow of Castle Ravenloft. The villagers live in quiet despair.',                            imageUrl: null },
  { id: 'w2', name: 'Strahd von Zarovich',     type: 'NPC',      summary: 'The ancient vampire lord of Barovia, cursed to haunt these lands for eternity in search of his lost love.',                   imageUrl: 'https://picsum.photos/seed/strahd/400/300' },
  { id: 'w3', name: 'The Vistani',             type: 'FACTION',  summary: 'Wandering fortune-tellers who travel freely through the mists. Their allegiance to Strahd is complicated.',                   imageUrl: null },
  { id: 'w4', name: 'The Dark Powers',         type: 'THREAT',   summary: 'An inscrutable force that created the Demiplane of Dread. Their motives are unknown — their influence is everywhere.',        imageUrl: null },
  { id: 'w5', name: "Strahd's True Bargain",   type: 'SECRET',   summary: 'Strahd struck a deal with the Dark Powers at the moment of his brother\'s death. The full terms have never been revealed.',   imageUrl: null },
  { id: 'w6', name: 'The Amber Temple',        type: 'LOCATION', summary: 'An ancient temple on Mount Ghakis built to contain dark vestiges of forgotten gods.',                                         imageUrl: null },
  { id: 'w7', name: 'Rise of the Death Knight',type: 'ARC',      summary: 'The campaign\'s final arc — Strahd has begun preparations for a ritual that would transform him into something far worse.',    imageUrl: null },
  { id: 'w8', name: "Tatyana's Return",        type: 'EVENT',    summary: 'The reincarnation of Tatyana has arrived in Barovia in the form of Ireena Kolyana. Strahd knows.',                           imageUrl: null },
];

// EncounterCard fixtures
const encounterPlans = [
  { id: 'e1', name: 'Goblin Ambush at the Bridge',      difficulty: 'easy',   _count: { creatures: 2 }, partySize: 4, partyLevel: 3, adjustedXp: 100,   portraitUrl: null,                                     sceneDescription: null,                                                            createdAt: new Date('2026-05-01') },
  { id: 'e2', name: 'Werewolf Den Assault',             difficulty: 'hard',   _count: { creatures: 3 }, partySize: 4, partyLevel: 5, adjustedXp: 2600,  portraitUrl: 'https://picsum.photos/seed/werewolf/400/300', sceneDescription: 'Pack tactics — wolves go first to impose disadvantage on saves.', createdAt: new Date('2026-05-10') },
  { id: 'e3', name: 'Strahd — Final Confrontation',     difficulty: 'deadly', _count: { creatures: 1 }, partySize: 4, partyLevel: 9, adjustedXp: 50000, portraitUrl: null,                                     sceneDescription: 'Lair actions trigger on initiative count 20.',                   createdAt: new Date('2026-05-15') },
  { id: 'e4', name: 'Tavern Brawl (The Blue Water Inn)', difficulty: 'medium', _count: { creatures: 3 }, partySize: 5, partyLevel: 4, adjustedXp: 450,   portraitUrl: null,                                     sceneDescription: null,                                                            createdAt: new Date('2026-05-20') },
];

// PressureCards — all states
const INITIAL_PRESSURE: BriefingCard[] = [
  { id: 'p1', type: 'NPC',     entityName: 'Strahd von Zarovich', entityId: 'n1', urgencyLevel: 5, context: 'He has not visited Barovia Village in 3 sessions — the party is getting comfortable.', proposal: 'Have Strahd appear during the night at the inn, not as a threat but as a gracious host — unsettling the party with his civility.',     status: 'proposed', dmNote: undefined, mapCoords: undefined },
  { id: 'p2', type: 'FACTION', entityName: 'The Order of the Silver Dragon', entityId: 'f1', urgencyLevel: 3, context: 'The Order sent a raven two sessions ago. No response from the party yet.', proposal: 'A second raven arrives, this time with a torn piece of cloth — a distress signal from the Order\'s camp.', status: 'proposed', dmNote: undefined, mapCoords: undefined },
  { id: 'p3', type: 'HOOK',    entityName: 'Missing Children',    entityId: 'h1', urgencyLevel: 4, context: 'Villagers reported two missing children last session.', proposal: 'The party finds a small wooden toy — hand-carved — near the entrance to the old mill.', status: 'accepted', dmNote: undefined, mapCoords: undefined },
  { id: 'p4', type: 'REGION',  entityName: 'Svalich Woods',       entityId: 'r1', urgencyLevel: 2, context: 'The party has been avoiding the woods despite multiple hooks leading there.', proposal: 'Introduce eerie wolf howls tonight — closer than before. A Perception check reveals red eyes watching from the treeline.', status: 'dismissed', dmNote: undefined, mapCoords: undefined },
];

function PressureCardFixtures() {
  const [cards, setCards] = useState<BriefingCard[]>(INITIAL_PRESSURE);
  const update = (updated: BriefingCard) =>
    setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
  return (
    <div className="space-y-2 max-w-sm">
      {cards.map(card => <PressureCard key={card.id} card={card} onChange={update} />)}
    </div>
  );
}

function ToggleSpell({ spell }: { spell: SpellCardData }) {
  const [expanded, setExpanded] = useState(false);
  return <SpellCard spell={spell} variant={expanded ? 'expanded' : 'collapsed'} onToggle={() => setExpanded(v => !v)} />;
}

function CharacterCardFixtures() {
  const [sheetChar, setSheetChar] = useState<CharacterCardData | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        {[arannis, bruenor, lyra].map(c => (
          <CharacterCard key={c.id} character={c} onQuickView={() => setSheetChar(c)} />
        ))}
      </div>
      <CharacterQuickViewSheet character={sheetChar} open={sheetChar !== null} onOpenChange={v => { if (!v) setSheetChar(null); }} />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CardFixturePage() {
  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 900, margin: '0 auto' }}>
      <div className="mb-8">
        <div className="label-overline mb-2">Dev</div>
        <h1 className="text-fluid-2xl" style={{ fontFamily: 'var(--q-font-display)', color: 'var(--q-text)' }}>
          Cards
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--q-text-dim)' }}>
          Component fixtures — CharacterCard · SpellCard · MonsterStatBlock · MagicItemCard · EntityCard · NpcCard · HomebrewContentCard · MechanicCard · StatBlockCard · PressureCard · WorldEntryCard · EncounterCard
        </p>
      </div>

      {/* ── WorldEntryCard ───────────────────────────────────────────── */}
      <SectionHeading>World Entry Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        All entity types — Location · NPC (with portrait) · Faction · Threat · Secret · Arc · Event
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mb-10">
        {worldEntries.map(entry => (
          <WorldEntryCard key={entry.id} entry={entry} href={`#world-${entry.id}`} />
        ))}
      </div>

      {/* ── EncounterCard ────────────────────────────────────────────── */}
      <SectionHeading>Encounter Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Easy · Hard (with portrait) · Deadly · Medium — hover for delete (DM mode)
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        {encounterPlans.map(plan => (
          <EncounterCard key={plan.id} plan={plan} href={`#encounter-${plan.id}`} isDM onDelete={() => console.log('delete', plan.id)} isDeleting={false} />
        ))}
      </div>

      {/* ── EntityCard (primitive) ────────────────────────────────────── */}
      <SectionHeading>Entity Card — base primitive</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        <EntityCard
          imageUrl="https://picsum.photos/seed/entity1/400/300"
          imageFallback={<User size={32} />}
          title="Arannis Vaelor"
          badge={{ label: 'DM', icon: Sparkles, tone: 'amber' }}
          subtitle={<><span>Wizard</span><span>·</span><span>House Vaelor</span></>}
          description="A divination wizard who left the elven courts to study the arcane mysteries of Barovia."
          onClick={noop}
        />
        <EntityCard
          imageUrl={null}
          imageFallback={<Sword size={32} />}
          title="Ancient Relic"
          badge={{ label: 'Imported' }}
          subtitle={<span>Artifact · Unknown origin</span>}
          description="A fragment of obsidian carved with runes that predate recorded history."
          footer={<><ScrollText size={10} /><span>PDF · monster-manual</span></>}
          onClick={noop}
        />
        <EntityCard
          imageUrl={null}
          imageFallback={<Eye size={32} />}
          title="The Amber Temple"
          badge={null}
          subtitle={<span>Location · Mount Ghakis</span>}
          description={null}
          onClick={noop}
        />
        <EntityCard
          imageUrl="https://picsum.photos/seed/entity4/400/300"
          imageFallback={<User size={32} />}
          title="A very long NPC name that truncates cleanly"
          badge={{ label: 'Seen', tone: 'neutral' }}
          subtitle={<><span>Role that also truncates</span></>}
          description="Short description."
          onClick={noop}
        />
      </div>

      {/* ── NpcCard ──────────────────────────────────────────────────── */}
      <SectionHeading>NPC Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        DM-created · Sourcebook imported (Seen) · Entity with no faction
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        {npcs.map(npc => <NpcCard key={npc.id} npc={npc} onClick={noop} />)}
      </div>

      {/* ── HomebrewContentCard ──────────────────────────────────────── */}
      <SectionHeading>Homebrew Content Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Manual · PDF extraction · D&amp;D Beyond import
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        {homebrewItems.map(item => <HomebrewContentCard key={item.id} item={item} onClick={noop} />)}
      </div>

      {/* ── MechanicCard ─────────────────────────────────────────────── */}
      <SectionHeading>Mechanic Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Secret (hidden, assigned) · Tarot (sourcebook, player-visible) · Custom (hidden, assigned)
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        {mechanics.map(m => (
          <MechanicCard
            key={m.id}
            mechanic={m}
            assignedCharacterName={m.assignedToCharacterId === 'f1' ? 'Arannis' : m.assignedToCharacterId === 'f2' ? 'Bruenor' : null}
            onClick={noop}
          />
        ))}
      </div>

      {/* ── StatBlockCard ────────────────────────────────────────────── */}
      <SectionHeading>Stat Block Card — encounter builder (SRD)</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Compact (collapsed, with Add button) · Compact expanded · Full expanded
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-2xl mb-10">
        <StatBlockCard monster={goblin} compact onAdd={(n) => console.log('add', n, 'goblins')} />
        <StatBlockCard monster={goblin} compact={false} />
      </div>

      {/* ── PressureCard ─────────────────────────────────────────────── */}
      <SectionHeading>Pressure Card — session prep (interactive)</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Proposed (NPC / Faction) · Accepted · Dismissed — click to expand, use the action buttons
      </p>
      <div className="mb-10">
        <PressureCardFixtures />
      </div>

      {/* ── CharacterCard ────────────────────────────────────────────── */}
      <SectionHeading>Character Card</SectionHeading>
      <p className="text-xs mb-3" style={{ color: 'var(--q-text-faint)' }}>
        Portrait hero · Initials fallback · No data — hover for quick-view
      </p>
      <div className="mb-10">
        <CharacterCardFixtures />
      </div>

      {/* ── SpellCard ────────────────────────────────────────────────── */}
      <SectionHeading>Spell Card — collapsed (click to expand)</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-6">
        <ToggleSpell spell={eldritchBlast} />
        <ToggleSpell spell={holdPerson} />
        <ToggleSpell spell={fireball} />
        <ToggleSpell spell={mageArmor} />
      </div>

      <SectionHeading>Spell Card — expanded</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-10">
        <SpellCard spell={fireball} variant="expanded" />
        <SpellCard spell={holdPerson} variant="expanded" />
      </div>

      {/* ── MonsterStatBlock ─────────────────────────────────────────── */}
      <SectionHeading>Monster Stat Block — drawer</SectionHeading>
      <div className="grid grid-cols-2 gap-4 max-w-xl mb-6">
        <MonsterStatBlock monster={ogre} mode="drawer" />
        <MonsterStatBlock monster={lich} mode="drawer" />
      </div>

      <SectionHeading>Monster Stat Block — full</SectionHeading>
      <div className="grid grid-cols-2 gap-4 max-w-2xl mb-10">
        <MonsterStatBlock monster={ogre} mode="full" />
        <MonsterStatBlock monster={lich} mode="full" />
      </div>

      {/* ── MagicItemCard ────────────────────────────────────────────── */}
      <SectionHeading>Magic Item Card — all rarities</SectionHeading>
      <div className="grid grid-cols-2 gap-3 max-w-xl mb-10">
        <MagicItemCard item={potionOfHealing} />
        <MagicItemCard item={ringOfProtection} />
        <MagicItemCard item={vorpalSword} />
        <MagicItemCard item={staffOfTheMagi} />
      </div>
    </div>
  );
}
