/**
 * Seed Year of Rogue Dragons sessions + characters for DM Brain testing.
 * Run against prod: DATABASE_URL="<neon-url>" ANTHROPIC_API_KEY="..." npx tsx scripts/seed-yord-sessions.ts
 */
import dotenv from 'dotenv';
// Only load .env if DATABASE_URL not already set (allows prod override via env var)
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

import { PrismaClient, CharacterStatus } from '@prisma/client';
import { processBrainIngestionJob } from '../src/lib/queue/brain-ingestion-worker';

const prisma = new PrismaClient();
const CAMPAIGN_ID = 'cmn1pdv3l000143ynkhvtw197';

const CHARACTERS = [
  {
    name: 'Lyra Swiftarrow',
    race: 'Wood Elf',
    class: 'Ranger',
    subclass: 'Drakewarden',
    level: 9,
    background: 'Outlander',
  },
  {
    name: 'Theron Ironveil',
    race: 'Mountain Dwarf',
    class: 'Paladin',
    subclass: 'Oath of the Ancients',
    level: 9,
    background: 'Soldier',
  },
  {
    name: 'Sasha Dawnwhisper',
    race: 'Human',
    class: 'Cleric',
    subclass: 'Arcana Domain',
    level: 9,
    background: 'Sage',
  },
  {
    name: 'Vandrak Grimscale',
    race: 'Half-Dragon (Black)',
    class: 'Fighter',
    subclass: 'Champion',
    level: 9,
    background: 'Criminal',
  },
];

const SESSIONS = [
  {
    sessionNumber: 1,
    title: 'Shadows Over the Vast',
    summary: `The adventurers arrived in the frontier town of Glister in the Vast, summoned by a desperate plea from the merchant consortium. Three separate dragon attacks had razed trading posts within a fortnight — unprecedented behavior that smelled of the ancient curse known as the Dracorage. The party met Kramdren Stoneflagon, a grizzled dwarf factor who survived the first attack and described the attacking black dragon, Iyrauroth, as frothing and erratic — not hunting for food or treasure, but destroying for destruction's sake.

Sasha identified signs of the Dracorage in old Harper texts: a Year of Rogue Dragons prophecy tied to the draconic god Sammaster's mad legacy. The Cult of the Dragon had been active in the region, and their zealots — Wearers of Purple — were seen near each attack site days before the dragon struck.

The party investigated the ruins of a collapsed trade post and found a survivor: Fraopris Gertybald, a gnome tinker who had hidden under a wagon. He described seeing a robed cultist pointing toward the next village before Iyrauroth struck. The party also encountered a half-dragon ogre scouting party — Black Half-Dragon Ogre Bolt Launchers in service to someone, retreating toward the Earthfast Mountains when confronted.

The session ended at the edge of the Earthfast foothills, where smoke on the horizon suggested another attack had already begun.`,
    highlights: [
      { type: 'npc', text: 'Kramdren Stoneflagon — dwarf factor, survivor of first Iyrauroth attack, possible Harper informant' },
      { type: 'threat', text: 'Iyrauroth, the Wyrm of the Peaks — black dragon showing Dracorage symptoms, erratic and destructive' },
      { type: 'faction', text: 'Cult of the Dragon — Wearers of Purple spotted coordinating dragon attacks, unknown motives' },
      { type: 'npc', text: 'Fraopris Gertybald — gnome tinker survivor, witnessed cultist directing Iyrauroth' },
      { type: 'location', text: 'Glister — frontier trade town in the Vast, base of operations' },
      { type: 'location', text: 'Earthfast Mountains — direction of retreat for half-dragon ogre scouts' },
    ],
  },
  {
    sessionNumber: 2,
    title: 'The Cult\'s Hidden Hand',
    summary: `Racing toward the smoke, the party arrived to find the village of Felsenmark already in ruins. Iyrauroth had departed, leaving behind ash and a deliberate trail of destruction that pointed toward a mountain pass rather than a lair. Among the ruins, Sasha found a survivor clutching a purple-edged scroll: initiate cult wizard Xazro the Limp, badly burned and willing to talk in exchange for healing.

Xazro revealed that the Cult of the Dragon, led locally by a half-elf woman named Delphaeryn Leiyraghon, had located fragments of Sammaster's research — specifically a ritual that could amplify the Dracorage across the entire Vast. Delphaeryn believed weaponizing the Dracorage would trigger a Second Rising of uncontrolled dragons that would humble the nations of Faerûn and give the Cult leverage to install themselves as the only power capable of "calming" the dragon tide — for a price.

The party also discovered that Iyrauroth had a blood heir: Dalgar, a half-dragon human warrior who served as the dragon's enforcer and messenger to the Cult. Dalgar was described as ruthless and devoted, bearing a distinctive black scale birthmark across his left arm.

Vandrak grew troubled — his own half-dragon heritage mirrored Dalgar's origins too closely for comfort. Theron noted Vandrak's distraction and privately warned Sasha.

The party extracted Xazro's cult cell location: an abandoned watchtower called Stump, north of the Earthfast pass. They rode through the night to intercept Delphaeryn before she could complete the ritual.`,
    highlights: [
      { type: 'npc', text: 'Xazro the Limp — injured cult initiate, source of critical intelligence, exchanged information for healing' },
      { type: 'npc', text: 'Delphaeryn Leiyraghon — half-elf cult leader in the Vast, mastermind of Dracorage amplification ritual' },
      { type: 'npc', text: 'Dalgar — half-dragon human enforcer, Iyrauroth\'s blood heir, serves as messenger to the Cult' },
      { type: 'location', text: 'Stump — abandoned watchtower north of Earthfast pass, cult cell headquarters' },
      { type: 'arc', text: 'Dracorage Amplification Ritual — Cult plan to weaponize the Dracorage across the Vast' },
      { type: 'secret', text: 'Vandrak\'s connection to Dalgar — both half-dragon warriors, Vandrak disturbed by the parallel' },
    ],
  },
  {
    sessionNumber: 3,
    title: 'The Watchtower at Stump',
    summary: `The party struck at Stump before dawn. The watchtower was fortified — Wearer of Purple guards, an Initiate Cult Wizard on watch, and a Zhentarim Skymage employed as hired muscle. The fight was brutal. Lyra's arrows took down the skymage before he could call for aid. Theron held the stairwell while Vandrak and Sasha fought through the ground floor.

Inside, they found Delphaeryn in the middle of the ritual — but she was not alone. Antazer Cabrax, a gnoll warlord described by Xazro as a mere thug, was there as a power broker, watching the ritual with the dead eyes of a man who had already sold something he couldn't get back. The ritual was incomplete — Delphaeryn lacked one component: the Heart of Embrurshaile, a phylactery-adjacent artifact drawn from a dracolich called Embrurshaile, the Devourer of the Weave.

The party stopped the ritual but Delphaeryn escaped through a dimension door, taking her research scrolls. Antazer Cabrax was captured. Under Sasha's Zone of Truth, Cabrax revealed that Embrurshaile was real — an ancient dracolich bound beneath a ruined temple called the Halls of Vorbyx in the northern Vast. The Witnesses of Vorbyx, a death cult, had been tending the dracolich for centuries.

Cabrax also warned: Mohmitath, a half-dragon gynosphinx who served as a neutral lore-keeper in the Vast, had recently been consulting with both the Cult and a Harper agent. Her loyalties were unknown — but she knew where the Heart of Embrurshaile was hidden.`,
    highlights: [
      { type: 'npc', text: 'Antazer Cabrax — gnoll warlord, Cult power broker, captured and interrogated under Zone of Truth' },
      { type: 'npc', text: 'Mohmitath — half-dragon gynosphinx, neutral lore-keeper, consulting with both Cult and Harpers' },
      { type: 'npc', text: 'Embrurshaile, the Devourer of the Weave — ancient dracolich bound beneath Halls of Vorbyx' },
      { type: 'item', text: 'Heart of Embrurshaile — dracolich phylactery-adjacent artifact, key component of Delphaeryn\'s ritual' },
      { type: 'location', text: 'Halls of Vorbyx — ruined temple in the northern Vast, Embrurshaile\'s prison' },
      { type: 'faction', text: 'Witnesses of Vorbyx — death cult tending Embrurshaile for centuries, guardians of the dracolich' },
    ],
  },
  {
    sessionNumber: 4,
    title: 'The Gynosphinx\'s Bargain',
    summary: `The party located Mohmitath at her lair in the Ankhwood — a vaulted cave filled with centuries of accumulated lore. The gynosphinx presented a riddle as toll, then dropped the pretense when Lyra named Embrurshaile correctly. Mohmitath was blunt: she had been playing the Cult and the Harpers against each other for decades, feeding each side just enough information to keep them occupied. But Delphaeryn had grown too dangerous. The ritual she was building would not just amplify the Dracorage — it would shatter Mystra's Weave in the Vast, creating a magic dead zone for a generation.

Mohmitath revealed the location of the Heart of Embrurshaile — hidden inside Embrurshaile himself, embedded in the dracolich's chest cavity. To retrieve it, the party would have to enter the Halls of Vorbyx, fight through the Witnesses, and then either destroy or subdue Embrurshaile while the heart was extracted.

She also revealed a way to stop the Dracorage entirely: the spell Abate Dracorage. The spell's formula was inscribed in a ruined Harper cache near the Vast coast, last held by a Harper agent named Innerdain Justdark — who had gone silent three months ago. Finding Innerdain would either recover the spell or explain why the Harpers had lost the thread.

Sasha, Theron, and Lyra agreed to pursue both leads. Vandrak stayed behind to speak with Mohmitath alone. When he returned, he would not say what was discussed.`,
    highlights: [
      { type: 'npc', text: 'Mohmitath — revealed true agenda: playing Cult vs Harpers, alarmed by Delphaeryn\'s Weave-shattering ritual' },
      { type: 'npc', text: 'Innerdain Justdark — Harper agent gone silent, last known to hold the Abate Dracorage cache' },
      { type: 'item', text: 'Abate Dracorage — spell formula that can end the Dracorage, formula in Harper cache near Vast coast' },
      { type: 'arc', text: 'Weave Shattering Risk — Delphaeryn\'s ritual would destroy magical connectivity across the Vast for decades' },
      { type: 'secret', text: 'Vandrak\'s private conversation with Mohmitath — contents unknown, visibly shaken afterward' },
      { type: 'location', text: 'Ankhwood — ancient forest, Mohmitath\'s lore-cave lair' },
    ],
  },
  {
    sessionNumber: 5,
    title: 'Into the Halls of Vorbyx',
    summary: `The party descended into the Halls of Vorbyx at the onset of a blood moon — Sasha called it an omen; Theron called it inconvenient. The Witnesses of Vorbyx were organized, their tactics clearly designed for intruders: pit traps, Corpse Flowers in the antechambers, and a Witness of Vorbyx honor guard who fought with fanatical discipline. The party pushed through, expending serious resources.

In the inner sanctum, they found Embrurshaile — and also found Delphaeryn, who had arrived hours before and was attempting to manually extract the Heart using a ritual knife. The dracolich was partially unbound — the Witnesses' seals were failing as Delphaeryn disrupted them. Embrurshaile was barely aware, caught between undead torpor and Dracorage fury, lashing out at everything.

Three-way fight: the party, Delphaeryn and her remaining Cult bodyguards (including Dalgar, who revealed himself as Iyrauroth's true blood heir), and the awakening Embrurshaile. Dalgar turned on Delphaeryn mid-fight — Iyrauroth had given him conflicting orders, and Dalgar chose the dragon over the cult.

Theron drove Delphaeryn back. Lyra's arrows pinned Dalgar. Sasha poured healing into keeping Vandrak upright as he fought Embrurshaile hand-to-claw in the kind of combat that left permanent marks. The Heart was recovered from Embrurshaile's chest by Sasha using a Careful Spell — and Embrurshaile, stripped of the artifact that had sustained his undeath, began to collapse.

The session ended in the rubble of the inner sanctum. Delphaeryn had escaped again. Dalgar was unconscious but alive, a prisoner. The Heart of Embrurshaile sat in Sasha's pack. Vandrak said nothing on the way out.`,
    highlights: [
      { type: 'npc', text: 'Dalgar — turned on Delphaeryn mid-fight, captured, Iyrauroth\'s orders conflicted with Cult directives' },
      { type: 'npc', text: 'Embrurshaile — partially unbound, fought the party, Heart extracted by Sasha, dracolich collapsing' },
      { type: 'item', text: 'Heart of Embrurshaile — recovered from dracolich\'s chest cavity, in party possession' },
      { type: 'threat', text: 'Delphaeryn Leiyraghon — escaped again, ritual components partially assembled, still at large' },
      { type: 'arc', text: 'Iyrauroth\'s True Plan — Dalgar\'s conflicting orders suggest Iyrauroth has independent agenda beyond the Cult' },
      { type: 'event', text: 'Vandrak vs Embrurshaile — sustained significant injury, refusing to discuss what happened at Mohmitath\'s lair' },
    ],
  },
];

async function main() {
  // Find the user
  const user = await prisma.user.findUnique({ where: { email: 'dev@blakewales.au' } });
  if (!user) throw new Error('User mail@blakewales.au not found');
  console.log(`User: ${user.id}`);

  // Create characters
  console.log('\nCreating characters...');
  for (const char of CHARACTERS) {
    const existing = await prisma.character.findFirst({
      where: { userId: user.id, name: char.name },
    });

    let characterId: string;
    if (existing) {
      console.log(`  Skipping existing: ${char.name}`);
      characterId = existing.id;
    } else {
      const created = await prisma.character.create({
        data: { ...char, userId: user.id },
      });
      console.log(`  Created: ${char.name} (${char.race} ${char.class})`);
      characterId = created.id;
    }

    // Link to campaign
    const linked = await prisma.campaignCharacter.findFirst({
      where: { campaignId: CAMPAIGN_ID, characterId },
    });
    if (!linked) {
      await prisma.campaignCharacter.create({
        data: {
          campaignId: CAMPAIGN_ID,
          characterId,
          status: CharacterStatus.ACTIVE,
          isActive: true,
        },
      });
      console.log(`  Linked to campaign`);
    }
  }

  // Create sessions
  console.log('\nCreating sessions...');
  const sessionIds: string[] = [];
  for (const s of SESSIONS) {
    const existing = await prisma.gameSession.findFirst({
      where: { campaignId: CAMPAIGN_ID, sessionNumber: s.sessionNumber },
    });

    let sessionId: string;
    if (existing) {
      // Update summary if missing
      await prisma.gameSession.update({
        where: { id: existing.id },
        data: {
          title: s.title,
          aiSummary: s.summary,
          aiSummaryStatus: 'done',
          aiHighlights: s.highlights,
          status: 'completed',
        },
      });
      console.log(`  Updated session ${s.sessionNumber}: ${s.title}`);
      sessionId = existing.id;
    } else {
      const created = await prisma.gameSession.create({
        data: {
          campaignId: CAMPAIGN_ID,
          sessionNumber: s.sessionNumber,
          title: s.title,
          aiSummary: s.summary,
          aiSummaryStatus: 'done',
          aiHighlights: s.highlights,
          status: 'completed',
          date: new Date(Date.now() - (5 - s.sessionNumber) * 7 * 24 * 60 * 60 * 1000),
        },
      });
      console.log(`  Created session ${s.sessionNumber}: ${s.title}`);
      sessionId = created.id;
    }
    sessionIds.push(sessionId);
  }

  // Run brain ingestion for each session
  console.log('\nRunning brain ingestion...');
  for (let i = 0; i < SESSIONS.length; i++) {
    const s = SESSIONS[i];
    const sessionId = sessionIds[i];
    console.log(`  Processing session ${s.sessionNumber}: ${s.title}...`);
    try {
      const result = await processBrainIngestionJob({
        sessionId,
        campaignId: CAMPAIGN_ID,
        summary: s.summary,
        highlights: s.highlights,
        source: `session-${s.sessionNumber}`,
      });
      console.log(`    +${result.entitiesCreated} entities, ${result.entitiesUpdated} updated, ${result.relationshipsUpserted} relationships, ${result.hooksAdded} hooks`);
    } catch (err) {
      console.error(`    Error: ${err}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
