/**
 * Seed: Vecna: Eye of Ruin campaign data for demo@quiverdm.com
 * Real campaign data from Blake's Discord + PDF session notes (Jan 2025 - Oct 2025)
 *
 * Run: npx tsx scripts/seed-eye-of-ruin.ts
 *
 * Creates:
 *   - Campaign: "Vecna: Eye of Ruin"
 *   - Character: Blam-Bam Bigglesworth (Level 11 Giff Artificer)
 *   - NPCs: party members + key NPCs from sessions
 *   - Sessions 1–6 with summaries
 *   - Homebrew: Cosmic Enforcer subclass features
 */

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const USER_ID = 'demo-user-id';

async function main() {
  console.log('Seeding Vecna: Eye of Ruin...');

  // ── CAMPAIGN ──────────────────────────────────────────────────────────────
  const campaign = await p.campaign.upsert({
    where: { slug: 'vecna-eye-of-ruin' },
    update: {},
    create: {
      id: 'eor-campaign-id',
      name: 'Vecna: Eye of Ruin',
      slug: 'vecna-eye-of-ruin',
      description: `A cosmic race to collect the seven pieces of the Rod of Seven Parts before Vecna unmakes the multiverse. The party were hired by Lord Neverember to rescue kidnapped citizens — but that job spiralled into a universe-ending threat. Now, guided by the archmages Alustriel, Mordenkainen, and Tasha, the party travels the planes seeking the rod fragments.

Current location: The Astral Sea — aboard the wreck of the Lambent Zenith, impaled in the corpse of the dead god Havoc.`,
      status: 'active',
      userId: USER_ID,
      inviteCode: 'EOR-2025',
      isPublic: false,
    },
  });
  console.log(`✓ Campaign: ${campaign.name}`);

  // ── CAMPAIGN MEMBER (owner) ───────────────────────────────────────────────
  await p.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: USER_ID } },
    update: {},
    create: {
      campaignId: campaign.id,
      userId: USER_ID,
      role: 'OWNER',
    },
  });
  console.log('✓ Campaign member (OWNER)');

  // ── CHARACTER: BLAM-BAM BIGGLESWORTH ──────────────────────────────────────
  const character = await p.character.upsert({
    where: { id: 'blambam-character-id' },
    update: {},
    create: {
      id: 'blambam-character-id',
      userId: USER_ID,
      name: 'Blam-Bam Bigglesworth',
      race: 'Giff',
      class: 'Artificer',
      subclass: 'Cosmic Enforcer',
      background: 'Space Ranger',
      level: 11,
      abilityScores: {
        str: { score: 15, modifier: 2 },
        dex: { score: 10, modifier: 0 },
        con: { score: 15, modifier: 2 },
        int: { score: 16, modifier: 3 },
        wis: { score: 10, modifier: 0 },
        cha: { score: 11, modifier: 0 },
      },
      hitPoints: { current: 68, max: 78, temp: 0 },
      hitDice: { total: 11, remaining: 11, die: 'd8' },
      armorClass: 19,
      speed: 30,
      proficiencyBonus: 4,
      savingThrows: {
        str: { proficient: false, bonus: 2 },
        dex: { proficient: false, bonus: 0 },
        con: { proficient: true, bonus: 6 },
        int: { proficient: true, bonus: 7 },
        wis: { proficient: false, bonus: 0 },
        cha: { proficient: false, bonus: 0 },
      },
      languages: ['Common', 'Elvish'],
      senses: { passivePerception: 14, passiveInvestigation: 17, passiveInsight: 14 },
      resistances: [],
      proficiencies: {
        armor: ['Light Armor', 'Medium Armor', 'Shields'],
        weapons: ['Simple Weapons', 'Firearms'],
        tools: ['Thieves\' Tools (Expertise)', 'Tinker\'s Tools (Expertise)', 'Painter\'s Supplies (Expertise)', 'Vehicles (Space)'],
        skills: ['Investigation', 'Perception', 'Insight', 'Intimidation', 'Persuasion'],
      },
      spellcasting: {
        ability: 'INT',
        spellSaveDC: 15,
        spellAttackBonus: 7,
        slots: {
          1: { total: 4, used: 0 },
          2: { total: 3, used: 0 },
          3: { total: 2, used: 0 },
        },
        cantrips: ['Mage Hand', 'Mending', 'Message'],
        prepared: [
          'Faerie Fire', 'Command', 'Hold Person', 'Zone of Truth',
          'Counterspell', 'Dispel Magic', 'Detect Magic', 'Alarm',
          'Heat Metal', 'Aid', 'Enlarge/Reduce', 'Fly', 'Revivify',
        ],
        spells: [
          { name: 'Faerie Fire', level: 1, prepared: true, alwaysPrepared: true, castingTime: '1 action', range: '60 feet', damage: null, school: 'Evocation' },
          { name: 'Command', level: 1, prepared: true, alwaysPrepared: true, castingTime: '1 action', range: '60 feet', damage: null, school: 'Enchantment' },
          { name: 'Hold Person', level: 2, prepared: true, alwaysPrepared: true, castingTime: '1 action', range: '60 feet', damage: null, school: 'Enchantment' },
          { name: 'Zone of Truth', level: 2, prepared: true, alwaysPrepared: true, castingTime: '1 action', range: '60 feet', damage: null, school: 'Enchantment' },
          { name: 'Counterspell', level: 3, prepared: true, alwaysPrepared: true, castingTime: 'Reaction', range: '60 feet', damage: null, school: 'Abjuration' },
          { name: 'Dispel Magic', level: 3, prepared: true, alwaysPrepared: true, castingTime: '1 action', range: '120 feet', damage: null, school: 'Abjuration' },
          { name: 'Detect Magic', level: 1, prepared: true, castingTime: '1 action (ritual)', range: 'Self', damage: null, school: 'Divination' },
          { name: 'Alarm', level: 1, prepared: true, castingTime: '1 minute (ritual)', range: '30 feet', damage: null, school: 'Abjuration' },
          { name: 'Heat Metal', level: 2, prepared: true, castingTime: '1 action', range: '60 feet', damage: '2d8 fire', school: 'Transmutation' },
          { name: 'Aid', level: 2, prepared: true, castingTime: '1 action', range: '30 feet', damage: null, school: 'Abjuration' },
          { name: 'Fly', level: 3, prepared: true, castingTime: '1 action', range: 'Touch', damage: null, school: 'Transmutation' },
          { name: 'Revivify', level: 3, prepared: true, castingTime: '1 action', range: 'Touch', damage: null, school: 'Necromancy' },
        ],
      },
      inventory: [
        { name: 'Blunderbuss of Justice +2', type: 'weapon', equipped: true, quantity: 1, description: '1d10+2 force damage, 30/90 ft range. Special: Scatter Shot (15-ft cone, DC 15 DEX, 1d8 force). Artificer Enhanced Weapon infusion.' },
        { name: 'Light Crossbow +1', type: 'weapon', equipped: false, quantity: 1, description: '1d8+1 piercing, 80/320 ft range. Repeating Shot infusion — ignores loading, creates its own ammo.' },
        { name: 'Half Plate +2 (Armor of Gleaming)', type: 'armor', equipped: true, quantity: 1, description: 'AC 17+2=19. Never gets dirty or shows wear. Enhanced Defense infusion.' },
        { name: 'Cloak of Protection', type: 'magic-item', equipped: true, quantity: 1, description: '+1 AC, +1 to all saving throws. Attuned. Replicate Magic Item infusion.' },
        { name: 'Immovable Rod', type: 'magic-item', equipped: false, quantity: 1, description: 'Can be fixed in place in midair. Holds up to 8,000 lbs.' },
        { name: 'Bag of Holding', type: 'magic-item', equipped: true, quantity: 1, description: '500 lbs / 64 cubic ft capacity. Replicate Magic Item infusion.' },
        { name: 'Metal Badge (#1 Space Ranger)', type: 'misc', equipped: true, quantity: 1, description: 'His most treasured possession. Represents his growth from pretender to legitimate protector. Upgraded from plastic mid-campaign.' },
        { name: 'Manual of Cosmic Law', type: 'misc', equipped: false, quantity: 1, description: 'Heavily annotated. Blam-Bam\'s personal reference for galactic legal statutes, most of which he invented.' },
        { name: 'Chime of Exile', type: 'magic-item', equipped: false, quantity: 1, description: 'Auto-banishes any creature under 50 HP. Acquired from Alustriel.' },
        { name: 'Thieves\' Tools', type: 'tool', equipped: false, quantity: 1, description: 'Expertise. +11 to checks.' },
        { name: 'Tinker\'s Tools', type: 'tool', equipped: false, quantity: 1, description: 'Expertise. Used for infusions and gadget creation.' },
        { name: 'Crossbow Bolts', type: 'ammunition', equipped: false, quantity: 20 },
        { name: 'Rations', type: 'misc', equipped: false, quantity: 10 },
        { name: 'Rope, Hempen (50 ft)', type: 'misc', equipped: false, quantity: 1 },
      ],
      currency: { gp: 775, sp: 0, cp: 0, ep: 0, pp: 0 },
      features: [
        { name: 'Magical Tinkering', source: 'Artificer 1', description: 'Imbue Tiny objects with minor magical properties. Max 3 objects at once.' },
        { name: 'Infuse Item', source: 'Artificer 2', description: '5 infusions active. Knows 12 infusions. Active: Enhanced Defense, Enhanced Weapon, Repeating Shot, Bag of Holding, Cloak of Protection.' },
        { name: 'The Right Tool for the Job', source: 'Artificer 3', description: 'Create artisan\'s tools after 1 hour of work.' },
        { name: 'Tool Expertise', source: 'Artificer 6', description: 'Double proficiency bonus with all tool checks.' },
        { name: 'Flash of Genius', source: 'Artificer 7', description: '3/Long Rest. Reaction: add INT modifier (+3) to ability check or saving throw within 30 feet.' },
        { name: 'Magic Item Adept', source: 'Artificer 10', description: 'Attune to 4 magic items simultaneously. Craft magic items in half time/cost.' },
        { name: 'Spell-Storing Item', source: 'Artificer 11', description: '6 uses/Long Rest. Store 1st or 2nd level artificer spell in an item. Others can activate it.' },
        { name: 'Tools of the Cosmic Law', source: 'Cosmic Enforcer 3', description: 'Firearm proficiency. Use Intelligence for Intimidation and Persuasion. Grants Blunderbuss of Justice.' },
        { name: 'Authority Over Chaos', source: 'Cosmic Enforcer 5', description: 'Justice Aura (1/LR): 30-ft radius, 1 min — allies have advantage vs charmed/frightened, enemies have disadvantage on Deception. Improved Gadgetry: choose +10 speed, +1 AC, or +1 weapon damage per long rest.' },
        { name: 'Lawkeeper\'s Command', source: 'Cosmic Enforcer 9', description: 'Judgment Beam (1/LR): 60 ft ranged spell attack, 3d10+3 force, WIS DC 15 or stunned until end of next turn. Shield of Order (4/LR): Reaction when ally within 30 ft takes damage — reduce by 2d6+3.' },
        { name: 'Astral Spark', source: 'Giff Racial', description: '4/Long Rest. Add 4 force damage to one weapon attack per turn.' },
        { name: 'Firearms Mastery', source: 'Giff Racial', description: 'Proficiency with all firearms. Ignore loading property. No disadvantage at long range.' },
        { name: 'Hippo Build', source: 'Giff Racial', description: 'Advantage on STR checks and saves. Count as Large for carrying capacity (450 lbs).' },
        { name: 'Authority Mimicry', source: 'Space Ranger Background', description: '1/Long Rest. Advantage on social checks when mimicking authority figures.' },
        { name: 'Enforcer\'s Presence (Feat)', source: 'Feat', description: 'Measure of Justice (3/LR, Reaction): impose disadvantage when ally within 30 ft is attacked. Lawkeeper\'s Strike (1/LR): add 2d6 force damage to weapon attack (3d6 vs lawbreakers).' },
        { name: 'Scatter Shot', source: 'Blunderbuss of Justice', description: '1/Short Rest. 15-foot cone, DEX save DC 15, 1d8 force damage (half on save).' },
      ],
      personalityTraits: 'Self-appointed cosmic law enforcer who speaks in official jargon and practices authority poses in private. Meticulously maintains equipment and considers himself a legitimate authority figure.',
      ideals: 'Justice is absolute; order must be maintained; authority must be respected; the badge represents everything worth fighting for.',
      bonds: 'His metal Space Ranger badge represents everything he aspires to become. Seeks mentor approval from legitimate authority figures. Unwavering loyalty to space ranger ideals and the party.',
      flaws: 'Easily manipulated by apparent authority. Escalates minor infractions into major confrontations. Desperately needs approval from authority figures. Sees the world in black and white.',
      backstory: 'Once a wannabe cadet who never quite made it through the Space Ranger Academy, Blam-Bam spent years studying galactic law from manuals and mimicking the authority he desperately wanted to embody. His plastic badge became metal through adventure and genuine heroism — a symbolic transformation from pretender to legitimate protector. His "Number One Lolth Supporter" badge (a magical tinkering creation) has proven suspiciously effective at fooling cult guards.',
      notes: 'Current session status: 68/78 HP. Last session ended evading Astral Anglers in zero-gravity, landing on the hull of the Lambent Zenith. Next objective: find Rod Fragment #2 inside the dead god Havoc\'s corpse.',
      isPortable: true,
    },
  });
  console.log(`✓ Character: ${character.name} (Level ${character.level} ${character.subclass} ${character.class})`);

  // ── NPCS ──────────────────────────────────────────────────────────────────
  const npcs = [
    {
      id: 'eor-npc-abdullah',
      name: 'Abdullah Mohammed Abu Ali',
      role: 'Player Character',
      faction: 'Party',
      description: 'Human Paladin (Oath of Vengeance). Very arabic, quite relaxed. Master of longswords, gold chains, and jetskis. Known to charm vampire vendors for discounts. Carries a mysterious divine aura that unsettled McColby the hobgoblin into challenging him to a duel.',
      secrets: 'His divine aura is unexplained — even Abdullah doesn\'t know its full nature. Neverember may know something.',
      tags: ['paladin', 'pc', 'human', 'party'],
    },
    {
      id: 'eor-npc-adam',
      name: 'Adam Sandleberg',
      role: 'Player Character',
      faction: 'Party',
      description: 'Elvish Bard/Barbarian/Artificer hybrid who looks and sounds like a Hollywood funnyman. Jewish but seemingly flagrant with spending. Master of the great club and the lute. Sold a fallen party member\'s corpse for 5 healing potions. Carries a portal-locating orb from the Dolinda vault.',
      secrets: null,
      tags: ['bard', 'barbarian', 'artificer', 'pc', 'elf', 'party'],
    },
    {
      id: 'eor-npc-gwark',
      name: 'Gwark / Guac',
      role: 'Player Character',
      faction: 'Party',
      description: 'Orc Paladin/Warlock/Barbarian who has taken an Oath of Glory. Fiercely loyal, even if that means human rights violations. Loves a flail, keeps creating new weapons with magic. Divine smite specialist — once turned a gnome rainbow. Received a Drift Globe integrated into his greataxe from Melania.',
      secrets: null,
      tags: ['paladin', 'warlock', 'barbarian', 'pc', 'orc', 'party'],
    },
    {
      id: 'eor-npc-dax',
      name: 'Dax',
      role: 'Player Character',
      faction: 'Party',
      description: 'Fairy Artificer with natural flight, used for aerial recon. Discovered the phasing door in Web\'s Edge that revealed the spider dragon\'s chamber. Has access to Melania\'s research notes on Star Anglers from the Sanctum library.',
      secrets: null,
      tags: ['artificer', 'pc', 'fairy', 'party'],
    },
    {
      id: 'eor-npc-melania',
      name: 'Melania',
      role: 'Ally / Crafter',
      faction: 'Silver Hand (Alustriel\'s)',
      description: 'Artificer and arcane engineer working under Lady Alustriel in the Sanctum of the Silver Hand. Created the Planar Tether — a woven violet cord that binds the party together through planar travel. Can fabricate magical items in exchange for time and materials. Appears the morning after requests with completed work.',
      secrets: 'Full extent of her capabilities and what she knows about the rod fragments is unknown.',
      tags: ['artificer', 'ally', 'npc', 'silver-hand'],
    },
    {
      id: 'eor-npc-alustriel',
      name: 'Lady Alustriel',
      role: 'Quest Giver',
      faction: 'Silver Hand',
      description: 'One of three archmages who revealed the true scope of the quest. Reminded the party that Vecna\'s eyes are upon them still. Provided the Chime of Exile. Based in the Sanctum of the Silver Hand in Sigil.',
      secrets: 'Aware of Abdullah\'s unusual aura but hasn\'t explained it.',
      tags: ['archmage', 'quest-giver', 'npc', 'silver-hand'],
    },
    {
      id: 'eor-npc-sarcelle',
      name: 'Sarcelle Malinosh',
      role: 'Rescued Prisoner',
      faction: 'Neverwinter',
      description: 'One of the four prominent citizens kidnapped by cultists and taken to Neverdeath Graveyard. Rescued by the party in Session 1. Claims Lord Neverember is illegitimate and says she has proof.',
      secrets: 'Has evidence of Neverember\'s illegitimacy. Has not yet produced it.',
      tags: ['npc', 'neverwinter', 'quest'],
    },
    {
      id: 'eor-npc-khair-arak',
      name: 'Khair Arak',
      role: 'Unknown Threat',
      faction: 'Unknown',
      description: 'Name overheard during the Web\'s Edge cult leadership meeting. Prisoners were to be fed to "Khair Arak." Identity and nature completely unknown.',
      secrets: 'May be the spider dragon, a devil, or something far worse. The name was spoken with obvious fear by high-ranking cult members.',
      tags: ['npc', 'mystery', 'threat', 'lolth-cult'],
    },
    {
      id: 'eor-npc-trevor',
      name: 'Trevor',
      role: 'NPC Companion (Temporary)',
      faction: 'Lambent Zenith Crew',
      description: 'Blink dog whose teleportation is broken due to planar instability in the Astral Sea. Encountered on the hull of the Lambent Zenith after the party evaded the Astral Anglers. Offered to vouch for the party with the Foreman.',
      secrets: null,
      tags: ['npc', 'blink-dog', 'astral-sea'],
    },
  ];

  for (const npc of npcs) {
    await p.nPC.upsert({
      where: { id: npc.id },
      update: {},
      create: {
        ...npc,
        campaignId: campaign.id,
        stats: {},
        playerVisible: false,
      },
    });
  }
  console.log(`✓ NPCs: ${npcs.map(n => n.name).join(', ')}`);

  // ── SESSIONS ──────────────────────────────────────────────────────────────
  const sessions = [
    {
      id: 'eor-session-1',
      sessionNumber: 1,
      title: 'Neverdeath Graveyard',
      date: new Date('2025-03-13T11:00:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `Lord Neverember hired a ragtag group of adventurers to rescue four prominent citizens of Neverwinter who had been kidnapped and taken to Neverdeath Graveyard.

The party entered a crypt and dispatched a group of wights in the first chamber. Exploration led them to a small tunnel connecting to a larger catacomb system. Deep inside they heard a woman calling for help.

They found Sarcelle Malinosh in a chamber alongside an empty coffin. Joining late was Blam-Bam Bigglesworth — a failed but enthusiastic former police recruit who followed the group after seeing them leave the castle with purpose.

Three of four prisoners located. Sarcelle, once rescued, made a startling claim: Lord Neverember is illegitimate, and she has proof.`,
      recap: `Session 1 recap from Discord: Met characters. Lord Neverember put together a group of adventurers to rescue 4 prominent members of Neverwinter from Neverdeath Graveyard. Party entered the graveyard, fucked up some wights, found Sarcelle Malinosh and an empty coffin. Blam-Bam Bigglesworth joined.`,
    },
    {
      id: 'eor-session-2',
      sessionNumber: 2,
      title: 'The Ol\' Donkey Trick',
      date: new Date('2025-03-15T12:00:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `The party pushed deeper into the catacombs. Gwark was turned invisible without knowing — which led to an inspired improvisation: Rev. D'Marcus Williams assumed the shape of a bipedal donkey, voiced entirely by the invisible Gwark beside him.

Using this ruse, the party intimidated a group of cultists without fighting — a rare diplomatic success. The victory was immediately underpinned when someone fireballed a contained room full of cultists who had already surrendered. War crimes logged.

Gwark used magic to turn a gnome rainbow for reasons that remain unclear.

The party encountered a Marid — a powerful water genie — and chose diplomacy over combat, earning a useful ally. Rescued "Poo Poo girl" Indrina, the fourth prisoner. Indrina corroborated Sarcelle's claim: Neverember is illegitimate.`,
      recap: `Explored the catacombs. Gwark went invisible, Rev became bipedal donkey voiced by invisible Gwark. Intimidated cultists instead of fighting. Committed atrocity by fireballing a surrendered room. Gwark turned a gnome rainbow. Met a Marid — didn't fight, befriended. Rescued Indrina. 3/4 prisoners rescued.`,
    },
    {
      id: 'eor-session-3',
      sessionNumber: 3,
      title: 'Vampire Market & Dolinda Tomb',
      date: new Date('2025-07-29T06:53:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `RIP Brixton Barnsley. The halfling companion went out screaming "Make it stop!" while violently scratching through his own skull with his dagger. Adam sold his corpse to vampire merchants for five healing potions. Business is business.

Abdullah charmed vampire vendors for discounts and free potions — the undead economy is surprisingly negotiable.

At the Dolinda Tomb, four vampires attacked seeking "real blood." Gwark's divine smite flail attacks reduced them to nothing. The party recovered rings engraved "Dolly" and "Dar."

Inside the tomb, they discovered Newmy — a Jamaican-accented ghost caretaker hired by the living Dolinda family, who were banished to this undead realm. She told them of a vault with treasures and "nasty noises" deeper inside.

The vault required only one person at a time — anyone else triggered lethal traps. Adhul and Blam-Bam cracked the puzzle door: spell ALONE using letters from DOLINDA and NO WORLD TO RETURN.

Epic loot secured: golden helmet (Adhul), Neverwinter snow globe (Blam-Bam), portal-locating orb (Adam), 2,200 gold (Gwark), planar escape book (Eldon).

Party split to clear two tomb chambers: Gwark demolished Sorrow Sworn — creatures of pure loneliness with spike hands. Session ended with Adhul and Blam-Bam facing a nightmare creature with impossibly long arms in a blade-covered chamber.`,
      recap: `RIP Brixton — scratched through own skull. Adam sold corpse for potions. Adhul charmed vampires for discounts. Vampire fight at Dolinda Tomb — Gwark smited them apart. Found rings "Dolly" and "Dar." Met ghost Newmy. Solved ALONE puzzle. Epic loot: golden helmet, portal orb, 2200gp. Split combat — Gwark vs Sorrow Sworn, Adhul+Blam vs nightmare creature.`,
    },
    {
      id: 'eor-session-4',
      sessionNumber: 4,
      title: 'The Real Quest Revealed',
      date: new Date('2025-08-03T15:00:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `The true scope of the threat was revealed. Three of the most powerful archmages in the multiverse — Mordenkainen, Tasha, and Lady Alustriel — summoned the party to Sigil, the City of Doors. Vecna, the Undead God, was moving to unmake the fabric of reality itself. The only weapon capable of stopping him: the Rod of Seven Parts, currently scattered across the planes.

Mordenkainen, Tasha, and Alustriel deployed the party as their field agents: find all seven fragments before Vecna does. Each fragment is guarded and in a different plane. The first was identified in Web's Edge — a Lolth cult stronghold somewhere in the Underdark.

The party received briefing materials, plane-walking assistance, and the Chime of Exile (auto-banishes anything under 50 HP). Blam-Bam immediately began annotating his Manual of Cosmic Law with the legal statutes of Sigil.`,
      recap: `The real quest revealed: collect the Rod of Seven Parts to stop Vecna. Wizards in Sigil (Alustriel, Mordenkainen, Tasha) gave the brief. First fragment: Web's Edge, a Lolth cult stronghold. Received Chime of Exile.`,
    },
    {
      id: 'eor-session-5',
      sessionNumber: 5,
      title: 'Web\'s Edge Infiltration',
      date: new Date('2025-08-03T16:00:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `Mordenkainen, Tasha, and Alustriel dropped the party directly into a Lolth cult stronghold — Web's Edge — with a single objective: retrieve the first Rod fragment before Vecna's forces secured it.

The operation started violently. McColby the hobgoblin shrine guardian felt something strange in Abdullah's divine aura and immediately challenged him to a duel. The 1v1 devolved into full party chaos when Torkner the deep gnome mage panicked and fireballed his own teammate — and most of the party. Both enemies dead; everyone barely standing.

Blam's magical tinkering saved the mission: he produced a "Number One Lolth Supporter" badge that fooled every guard in the complex. The party dragged Mark around as their "prisoner" and walked straight past security.

Intelligence gathered: a high-ranking planning meeting revealed a conspiracy involving devil-backed leadership. Key figures — Joleira (elf), Bromtok (orc mage), and Fernita (actual devil from Avernus) — were coordinating an assault on deep gnome miners to feed prisoners to something called "Khair Arak."

Dax found a phasing door that materialized and dematerialized as you approached. Beyond it: a chamber full of webs and screaming. Flying above the webs, Dax saw the guardian of the rod fragment — a massive spider dragon.

Session ended with the spider dragon aware of them, and screaming prisoners caught in the webs between the party and the first fragment of the rod.`,
      recap: null,
    },
    {
      id: 'eor-session-6',
      sessionNumber: 6,
      title: 'Into the Astral Sea',
      date: new Date('2025-10-13T03:04:00Z'),
      status: 'completed' as const,
      aiSummaryStatus: 'done' as const,
      aiSummary: `Following their victory over the Spider Dragon and escape from Web's Edge, the party returned to the Sanctum of the Silver Hand in Sigil. Melania, artificer and arcane engineer under Alustriel's direction, offered her services.

The party reached level 12. Melania fabricated the Planar Tether — a woven violet cord that binds the party together through planar travel. "Should one of you fall into a rift, all will follow." She also integrated a Drift Globe into Gwark's greataxe.

The party spent the day studying under the archmages: Tasha briefed them on the Astral Sea and its dead gods, Mordenkainen warned that only tethered travelers survive its gravity wells, Alustriel reminded them that Vecna's eyes were still upon them. They pored over Abominations of the Astral Sea and God Is Dead, Now What?

The next morning the Rod Fragment pulsed, pulled toward the Sanctum's eastern wing, and tore the party through a portal before anyone could prepare.

They materialized in the Astral Sea — silver mist, zero gravity, movement powered by mental focus (Intelligence × 5 ft). Ahead drifted the Lambent Zenith, a shattered spelljammer impaled in the petrified body of the dead god Havoc.

Two enormous Astral Anglers closed in — lures glowing, 120-foot blindsight active. The party coordinated through the Planar Tether: kicking off asteroids like a cosmic pinball machine, using the tether as a sling, staying below the Anglers' charm threshold. Blam took a debris graze. The party arrived on the Zenith's hull intact.

Current situation: aboard a dead spelljammer embedded in a dead god. 32 travelers entered the bow section this week — none returned. The foreman is locked in his quarters. Trevor the blink dog offered to vouch for them. Rod Fragment #2 is somewhere inside Havoc's heart.`,
      recap: `Level 12. Melania made the Planar Tether. Studied dead gods with the archmages. Rod Fragment yanked them into the Astral Sea. Zero gravity — movement = INT × 5. Two Astral Anglers ambushed them. Party slingshot off asteroids through their range. Landed on the Lambent Zenith hull. Dead god Havoc's corpse. Trevor the blink dog. 32 travelers entered the bow — none returned. Rod Fragment #2 inside.`,
    },
  ];

  for (const s of sessions) {
    await p.gameSession.upsert({
      where: { id: s.id },
      update: {},
      create: {
        ...s,
        campaignId: campaign.id,
        playerVisibility: 'dm_only',
        prepStatus: 'none',
      },
    });
  }
  console.log(`✓ Sessions: ${sessions.map(s => `#${s.sessionNumber} "${s.title}"`).join(', ')}`);

  // ── HOMEBREW: COSMIC ENFORCER SUBCLASS ────────────────────────────────────
  const homebrewItems = [
    {
      id: 'eor-homebrew-cosmic-enforcer',
      type: 'subclass',
      name: 'Cosmic Enforcer (Artificer)',
      sourceType: 'manual',
      tags: ['artificer', 'subclass', 'homebrew', 'eye-of-ruin'],
      data: {
        description: 'An Artificer subclass themed around galactic law enforcement. The Cosmic Enforcer channels the authority of interplanar justice through technology, gadgetry, and the sheer force of their conviction that order must prevail. Blam-Bam Bigglesworth is the only known practitioner.',
        parentClass: 'Artificer',
        features: [
          {
            level: 3,
            name: 'Tools of the Cosmic Law',
            description: 'You gain proficiency with firearms. You may use your Intelligence modifier instead of Charisma for Intimidation and Persuasion checks. You also gain the Blunderbuss of Justice, a custom firearm that deals force damage and channels your galactic authority.',
          },
          {
            level: 5,
            name: 'Authority Over Chaos',
            description: 'Justice Aura (1/Long Rest): As an action, you activate a 30-foot radius aura for 1 minute. Allies have advantage on saving throws against being charmed or frightened; enemies have disadvantage on Deception checks. Improved Gadgetry: Choose one enhancement per long rest — +10 ft speed, +1 AC, or +1 weapon damage.',
          },
          {
            level: 9,
            name: 'Lawkeeper\'s Command',
            description: 'Judgment Beam (1/Long Rest): Make a ranged spell attack against a creature within 60 feet. On a hit, deal 3d10+3 force damage and the target must succeed on a Wisdom save (DC 15) or be stunned until the end of its next turn. Shield of Order (4/Long Rest): As a reaction when an ally within 30 feet takes damage, reduce that damage by 2d6+3.',
          },
        ],
      },
      searchText: 'Cosmic Enforcer Artificer subclass galactic law enforcement firearms force damage justice aura judgment beam',
    },
    {
      id: 'eor-homebrew-blunderbuss',
      type: 'item',
      name: 'Blunderbuss of Justice +2',
      sourceType: 'manual',
      tags: ['weapon', 'firearm', 'magic-item', 'eye-of-ruin'],
      data: {
        description: 'A custom firearm that channels force damage through Artificer infusion. The signature weapon of Blam-Bam Bigglesworth, representing his absolute conviction that order must prevail over chaos. Its force damage cannot be redirected to evil purposes.',
        rarity: 'Very Rare',
        requiresAttunement: true,
        attunedBy: 'Artificer only',
        properties: ['Loading', 'Two-Handed', 'Special'],
        damage: '1d10+2 force',
        range: '30/90 ft',
        attackBonus: '+9 (DEX +0, prof +4, enhanced weapon +2, INT via class)',
        specialAbilities: [
          {
            name: 'Scatter Shot',
            recharge: 'Short Rest',
            action: 'Action',
            description: '15-foot cone. Each creature in the area makes a DEX saving throw (DC 15). On a failed save, a creature takes 1d8 force damage; half on a success.',
          },
          {
            name: 'Judgment Beam',
            recharge: 'Long Rest',
            action: 'Action',
            description: '60-foot line. Make a ranged spell attack (+7). On a hit, deal 3d10+3 force damage. The target must make a WIS save (DC 15) or be stunned until the end of its next turn.',
          },
        ],
      },
      searchText: 'Blunderbuss of Justice weapon firearm force damage scatter shot judgment beam artificer',
    },
    {
      id: 'eor-homebrew-planar-tether',
      type: 'item',
      name: 'Planar Tether',
      sourceType: 'manual',
      tags: ['magic-item', 'wondrous', 'eye-of-ruin', 'astral-sea'],
      data: {
        description: 'A woven violet cord that shimmers like starlight. Crafted by Melania, artificer of the Silver Hand, for traversal of weightless planes. When activated, one end is pressed into each party member\'s skin, vanishing into warmth beneath the surface.',
        rarity: 'Rare',
        requiresAttunement: false,
        properties: ['Wondrous Item'],
        specialAbilities: [
          {
            name: 'Tether',
            description: 'When one bound party member falls into a rift or is transported against their will, all other tethered members are transported with them. This effect cannot be resisted by the tethered members.',
          },
          {
            name: 'Proximity Bond',
            description: 'In zero-gravity or weightless environments, tethered members can use the tether as an anchor point, performing coordinated movement as a group action (no individual athletics checks required).',
          },
        ],
      },
      searchText: 'Planar Tether wondrous item astral sea zero gravity party tether rift planar travel',
    },
  ];

  for (const item of homebrewItems) {
    await p.homebrewContent.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        userId: USER_ID,
        images: [],
      },
    });
    // Link to campaign
    await p.campaignHomebrewContent.upsert({
      where: { campaignId_homebrewId: { campaignId: campaign.id, homebrewId: item.id } },
      update: {},
      create: { campaignId: campaign.id, homebrewId: item.id },
    });
  }
  console.log(`✓ Homebrew: ${homebrewItems.map(i => i.name).join(', ')}`);

  console.log('\n✅ Done! Vecna: Eye of Ruin fully seeded.');
  console.log(`   Campaign: /campaigns/vecna-eye-of-ruin`);
  console.log(`   Character: /characters/blambam-character-id`);
  console.log(`   Sessions: 6 completed sessions with summaries`);
  console.log(`   NPCs: ${npcs.length} characters`);
  console.log(`   Homebrew: ${homebrewItems.length} items`);
  console.log('\n   Next steps:');
  console.log('   - Import Session 5 PDF via /homebrew → Import from Any Format');
  console.log('   - Upload the MP4 recording via /sessions/eor-session-6 → Add Recording');
  console.log('   - Run brain seeding from /campaigns/vecna-eye-of-ruin/brain');
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
