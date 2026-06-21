/**
 * Seed script: "Tales from The Bonfire Keep" (Hameria Ire) as a MASTER SOURCEBOOK.
 *
 * Mirrors how Curse of Strahd / Icewind Dale / Lost Mine are stored: a canonical,
 * owner-neutral DdbSourcebook + DdbSourcebookChapter rows (bodySections markdown) +
 * SourcebookEntity rows. A DM then links it into a campaign via the UI
 * (linkSourcebookToCampaign -> seedCampaignFromSourcebook), which clones the world in.
 *
 * This script does TWO things:
 *   1. Loads the DM's Hugo `content/*.md` (committed under scripts/fixtures/bonfire-keep)
 *      into DdbSourcebookChapter.bodySections.
 *   2. Hand-authors FACTION / THREAT / SECRET SourcebookEntity rows — types the generic
 *      dual-model extractor cannot emit but which this faction-centric world needs.
 *
 * After running this, run the EXISTING extractor to populate NPC/LOCATION/ITEM/EVENT:
 *   npx tsx scripts/create-master-sourcebook.ts --slug tales-bonfire-keep --skip-crawl --skip-images
 *
 * Run: npx tsx scripts/seed-bonfire-keep-sourcebook.ts [--dry-run]
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';

// QuiverDM "library" user that owns cos / lmop / idrotf / wdh / toa / bgdia.
const OWNER_USER_ID = 'cmpl6071u0001srcmhadoz41h';
const SLUG = 'tales-bonfire-keep';
const TITLE = 'Tales from The Bonfire Keep';
const SOURCE_URL = 'https://lore.thebonfirekeep.com/';
const FIXTURES_DIR = join(__dirname, 'fixtures', 'bonfire-keep', 'content');
const SOURCE_TYPE = 'hugo_import';

const DRY_RUN = process.argv.includes('--dry-run');

type BodySection = { heading: string | null; level: number; markdown: string };

// Ordered chapter manifest. Flat (parentSlug=null) to match the published books.
// `file` is relative to FIXTURES_DIR; `slug` is the per-sourcebook chapter slug.
const CHAPTERS: Array<{ file: string; slug: string; title: string }> = [
  // ── World Lore ──────────────────────────────────────────────────────────
  { file: 'world-lore/world-timeline.md', slug: 'world-timeline', title: 'The Historical Timeline of Hameria Ire' },
  { file: 'world-lore/campaign-timeline.md', slug: 'campaign-timeline', title: 'Campaign Timeline: Tales from The Bonfire Keep' },
  { file: 'world-lore/anchors-and-heartflame.md', slug: 'anchors-and-heartflame', title: 'The Anchors & The Heartflame' },
  { file: 'world-lore/locations.md', slug: 'locations', title: 'Major Locations' },
  // ── Factions ────────────────────────────────────────────────────────────
  { file: 'factions/factions.md', slug: 'factions-overview', title: 'Major Factions of Hameria Ire' },
  { file: 'factions/solar-lie.md', slug: 'solar-lie', title: 'The Solar Lie: Theology and Magic of the Sunward Empire' },
  { file: 'factions/verdant-burden.md', slug: 'verdant-burden', title: 'The Verdant Burden: Philosophy and Sickness of the Clans' },
  { file: 'factions/tidal-adaptation.md', slug: 'tidal-adaptation', title: 'The Tidal Adaptation: Philosophy and Stagnation of the Covenant' },
  { file: 'factions/twelve-witnesses.md', slug: 'twelve-witnesses', title: 'The Twelve Witnesses of Aurelios' },
  // ── Cast ────────────────────────────────────────────────────────────────
  { file: 'npcs/npcs.md', slug: 'major-npcs', title: 'Major NPCs' },
  // ── Bestiary ────────────────────────────────────────────────────────────
  { file: 'bestiary/monsters.md', slug: 'bestiary', title: 'Bestiary of the Grand Harvest' },
  // ── Mechanics ───────────────────────────────────────────────────────────
  { file: 'mechanics/systems.md', slug: 'systems', title: 'Game Systems' },
  { file: 'mechanics/races.md', slug: 'races', title: 'Player Races' },
  { file: 'mechanics/items.md', slug: 'items', title: 'Campaign Items' },
  { file: 'mechanics/pregenitor-artifacts.md', slug: 'pregenitor-artifacts', title: 'Pregenitor Artifacts: Relics of the Grand Harvest' },
  // ── Adventures ──────────────────────────────────────────────────────────
  { file: 'adventures/01-whispered-names.md', slug: '01-whispered-names', title: 'Ch. 1: Whispered Names' },
  { file: 'adventures/01b-the-withered-root.md', slug: '01b-the-withered-root', title: 'Ch. 1b: The Withered Root' },
  { file: 'adventures/01c-the-salted-current.md', slug: '01c-the-salted-current', title: 'Ch. 1c: The Salted Current' },
  { file: 'adventures/02-the-starfall-conspiracy.md', slug: '02-the-starfall-conspiracy', title: 'Ch. 2: The Starfall Conspiracy' },
  { file: 'adventures/03-the-withering-world.md', slug: '03-the-withering-world', title: 'Ch. 3: The Withering World' },
  { file: 'adventures/04-desperate-alliance.md', slug: '04-desperate-alliance', title: 'Ch. 4: Desperate Alliance' },
  { file: 'adventures/05-the-hunt-begins.md', slug: '05-the-hunt-begins', title: 'Ch. 5: The Hunt Begins' },
  { file: 'adventures/06-the-dreaming-deep.md', slug: '06-the-dreaming-deep', title: 'Ch. 6: The Dreaming Deep' },
  { file: 'adventures/07-the-glass-sea.md', slug: '07-the-glass-sea', title: 'Ch. 7: The Glass Sea' },
  { file: 'adventures/08-the-shadowed-archive.md', slug: '08-the-shadowed-archive', title: 'Ch. 8: The Shadowed Archive' },
  { file: 'adventures/09-the-eternal-hearth.md', slug: '09-the-eternal-hearth', title: 'Ch. 9: The Eternal Hearth' },
  { file: 'adventures/mid-game-hook.md', slug: 'mid-game-hook', title: 'Interlude: The Whispering Static' },
  { file: 'adventures/mid-game-encounters.md', slug: 'mid-game-encounters', title: 'Interlude: The Road to the Emerald Reach' },
];

/** Strip YAML frontmatter and split markdown into {heading, level, markdown} sections by ATX headings. */
function parseMarkdown(raw: string): BodySection[] {
  // Remove leading YAML frontmatter (--- ... ---)
  let body = raw.replace(/^﻿/, '');
  const fm = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fm) body = body.slice(fm[0].length);

  const lines = body.split(/\r?\n/);
  const sections: BodySection[] = [];
  let heading: string | null = null;
  let level = 1;
  let buf: string[] = [];

  const flush = () => {
    const markdown = buf.join('\n').trim();
    // Skip empty sections and lone horizontal rules.
    if (markdown.replace(/^[-*_\s]+$/g, '').length > 0 || (heading && markdown.length > 0)) {
      sections.push({ heading, level, markdown });
    }
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (m) {
      flush();
      heading = m[2].trim();
      level = m[1].length;
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

// ── Hand-authored world entities the generic extractor cannot emit ──────────
type AuthoredEntity = {
  type: 'FACTION' | 'THREAT' | 'SECRET';
  name: string;
  aliases?: string[];
  description: string;
  chapterSlug: string;
  properties: Record<string, unknown>;
};

const AUTHORED_ENTITIES: AuthoredEntity[] = [
  // ── FACTIONS ──────────────────────────────────────────────────────────────
  {
    type: 'FACTION',
    name: 'The Sunward Empire',
    aliases: ['The Empire', 'The Solar Empire'],
    chapterSlug: 'solar-lie',
    description:
      'The most powerful organized force in Hameria Ire — a Dragonborn-led imperial civilization of golden cities, professional armies, and a magical tradition that outperforms every other in the world. It emerged from the ruins of the Salting with a solution to the dying world: imprison the Aspect of Entropy beneath its capital, Aurelios the Golden, pausing the Grand Harvest. That solution is also the Great Crime, and the Empire has been paying its Cosmic Debt for fourteen centuries.',
    properties: {
      type: 'faction',
      faith: 'The Solar Faith (Solara, the Eternal Light)',
      leader: 'Emperor Aurelias Draconius',
      capital: 'Aurelios the Golden',
      secret: 'Golden Magic is Filtered Entropy — the Empire bleeds the imprisoned Serenitas for mana.',
      role: 'Inheritor faction — guardians who became criminals',
    },
  },
  {
    type: 'FACTION',
    name: 'The Verdant Clans',
    aliases: ['The Verdant Burden', 'The Clans'],
    chapterSlug: 'verdant-burden',
    description:
      'The oldest continuous civilization in Hameria Ire, living in the Emerald Reach through grove-cities grown from living wood and connected by the mycelial Grove-Network. They worship Thymal, the Aspect of Growth, and have served as the world\'s unwilling Entropy Sink for fourteen centuries — absorbing the Empire\'s magical exhaust. The cost is the Silver Rot. They are split between Grove-Speakers who keep the alliance, Rootwardens who prune what cannot be saved, and the Thorns who burn Siphon-Stations.',
    properties: {
      type: 'faction',
      faith: 'Thymal, the Aspect of Growth',
      territory: 'The Emerald Reach',
      role: "The world's filter / entropy sink",
      schism: 'Grove-Speakers vs. Rootwardens vs. the Thorns',
      affliction: 'The Silver Rot',
    },
  },
  {
    type: 'FACTION',
    name: 'The Tidal Covenant',
    aliases: ['The Tidal Adaptation', 'The Covenant', 'The Anchors and Drifters'],
    chapterSlug: 'tidal-adaptation',
    description:
      'An ocean civilization of floating cities and undersea thermal gardens, organized entirely around the principle that everything changes and the only wisdom is changing with it. They follow Orym, the Aspect of Adaptation, and of all factions are closest to accepting the Grand Harvest. When the Empire stopped the Harvest, the ocean began paying the temporal debt: the Salted Stagnation. They are split between the Anchors, who want to stop and hide, and the Drifters, who seek a new path through the salt.',
    properties: {
      type: 'faction',
      faith: 'Orym, the Aspect of Adaptation',
      domain: 'The Great Bay and open ocean',
      role: "The world's slow creditor",
      schism: 'The Anchors vs. the Drifters',
      affliction: 'The Salted Stagnation',
    },
  },
  {
    type: 'FACTION',
    name: 'The Twelve Witnesses',
    aliases: ['The Twelve', 'The Witnesses of Aurelios'],
    chapterSlug: 'twelve-witnesses',
    description:
      'A secret council of twelve people — the only individuals in the Empire who carry the full truth of the Binding. Bound by a magical death-curse to keep the secret of Golden Magic and the imprisonment of Serenitas, they are "Cosmic Junkies," trapped by their own salvation. They renew the binding every seven years during the Harvest Festival.',
    properties: {
      type: 'faction',
      role: 'Secret keepers of the cosmic crime',
      binding: 'Magical death-curse enforcing secrecy',
      membership: 12,
      duty: 'Renew the Binding every seven years at the Harvest Festival',
    },
  },
  {
    type: 'FACTION',
    name: 'The Bonfire Keep',
    aliases: ['The Divine Anchors', 'The Heartflame Sanctuary'],
    chapterSlug: 'anchors-and-heartflame',
    description:
      'A cosmic sanctuary drawn together by the Heartflame, a pilot light for reality. It is absolute sanctuary — no violence can occur within its walls. It is tended by three Divine Anchors: Temmel (Redemption), who feeds the fire with the Heat of Regret; Faeren (Memory), who feeds it Shards of History; and Ambric (Justice), who feeds it Resolved Destinies. The party is drawn here by the Heartflame to become the hinge on which the world\'s fate turns.',
    properties: {
      type: 'faction',
      anchors: ['Temmel (Redemption)', 'Faeren (Memory)', 'Ambric (Justice)'],
      power: 'The Heartflame — a pilot light for reality',
      role: 'Cosmic sanctuary and the party\'s home base',
    },
  },
  // ── THREATS ─────────────────────────────────────────────────────────────
  {
    type: 'THREAT',
    name: 'The Overdue Grand Harvest',
    aliases: ['The Iremael', 'The Dimming', 'The Corrupted Entropy'],
    chapterSlug: 'world-timeline',
    description:
      'The Grand Harvest is the 10,000-year cosmic cycle of birth, growth, and ending that keeps the world alive. The Sunward Empire paused it fourteen centuries ago by imprisoning the Aspect of Entropy. Forced to watch her children suffer in stagnation, the Aspect\'s "Gentle Rest" curdled into a desperate desire to "Cease All Existence" — Corrupted Entropy. The overdue Harvest is the root crisis of the campaign: the instrument has been playing the same note for a thousand years, and now it is breaking.',
    properties: {
      type: 'threat',
      scope: 'Cosmic / world-ending',
      origin: 'The Empire pausing the cycle 1,400 years ago',
      manifestation: 'Stagnation, Corrupted Entropy, accelerating decay',
    },
  },
  {
    type: 'THREAT',
    name: 'Withered Corruption',
    aliases: ['The Withering', 'Entropy Corruption', 'Serenitas\'s Influence'],
    chapterSlug: 'systems',
    description:
      "An internal spiritual corruption born of Serenitas the Twilight Shepherd's despair — draining hope and life force from within, marked by purple-red energy and, at its end, autumn colors. It advances through milestone stages (Touched → Withering → Withered → Completely Withered), the final stage animating the dead as Withered Remnants: beings denied their natural ending. Distinct from Skreek's beneficial green Plague-Touch symbiosis.",
    properties: {
      type: 'threat',
      origin: 'Serenitas (the imprisoned Aspect of Entropy)',
      vector: 'Despair, exposure to corruption, cursed artifacts',
      stages: ['Touched', 'Withering', 'Withered', 'Completely Withered'],
      remnants: 'Withered Shades, Servitors, Harbingers, Echoes',
    },
  },
  {
    type: 'THREAT',
    name: 'The Silver Rot',
    aliases: ['The Silver Static', 'Stasis-Glass Infection'],
    chapterSlug: 'verdant-burden',
    description:
      'A stasis-glass infection advancing through the Emerald Reach for three centuries, turning living things into brittle, silver-leafed statues. It is the accumulated cost of the Verdant Clans absorbing the Empire\'s Golden Magic exhaust — stasis ash carried southwest from Aurelios the Golden. The grove-network spreads the Silver Static through every connected tree; the druids already have silver in their veins.',
    properties: {
      type: 'threat',
      faction: 'The Verdant Clans',
      cause: "Absorbed exhaust of the Empire's Golden Magic",
      effect: 'Living things petrify into brittle silver statues',
    },
  },
  {
    type: 'THREAT',
    name: 'The Salted Stagnation',
    aliases: ['The Salt-Glass', 'The Stagnant Flow'],
    chapterSlug: 'tidal-adaptation',
    description:
      'The ocean paying the temporal debt of the paused Harvest. The northern currents of the Great Bay are thickening into Salt-Glass — hyper-dense liquid where time runs slower. Ships that enter dense zones emerge a week late; creatures caught at the edge become Salt-Statues, aware and immobile, preserved at the moment of contact, their eyes still tracking years after.',
    properties: {
      type: 'threat',
      faction: 'The Tidal Covenant',
      cause: 'Temporal debt of the stopped Grand Harvest',
      effect: 'Time dilation, Salt-Glass seas, living Salt-Statues',
    },
  },
  // ── SECRETS ─────────────────────────────────────────────────────────────
  {
    type: 'SECRET',
    name: 'The Great Crime',
    aliases: ['The Binding of Serenitas', 'The Cosmic Debt'],
    chapterSlug: 'solar-lie',
    description:
      'Fourteen centuries ago, Aurelias the Founder and the nascent Sunward Empire halted the world-reset by imprisoning the Aspect of Entropy (Serenitas) beneath their capital, Aurelios the Golden. This stopped the Grand Harvest and saved the dying world — but created a Cosmic Debt now being paid by the Silver Rot, the Salted Stagnation, and spreading Withered corruption.',
    properties: {
      type: 'secret',
      knownBy: 'The Emperor and the Twelve Witnesses',
      stakes: 'Revealing it would destroy the Empire; maintaining it perpetuates the crime',
    },
  },
  {
    type: 'SECRET',
    name: 'Golden Magic is Filtered Entropy',
    aliases: ['The Secret of Golden Magic'],
    chapterSlug: 'solar-lie',
    description:
      "The Empire's famous golden magic is not the light of Solara — it is Filtered Entropy. The Empire \"bleeds\" the imprisoned Serenitas, converting her purple-red corruption into brilliant gold mana. Court mages who conjure golden fire believe they channel the sun; priests who heal with the Priesthood's light believe they are instruments of grace. None of them know the source.",
    properties: {
      type: 'secret',
      knownBy: 'The Twelve Witnesses; hidden from the Solar Priesthood and the Commonality',
      mechanism: "Serenitas's bound essence is drained and filtered into gold mana",
    },
  },
  {
    type: 'SECRET',
    name: 'The Binding Renewal',
    aliases: ['The Seven-Year Renewal', 'The Harvest Festival Ritual'],
    chapterSlug: 'twelve-witnesses',
    description:
      "The imprisonment of Serenitas is not permanent — it must be renewed every seven years during the Harvest Festival. The binding ritual is maintained by the Empire's highest magical authority (High Sage Lyria Sunweaver) and witnessed by the Twelve. The corruption has accelerated dramatically over the past century, and each renewal is harder than the last.",
    properties: {
      type: 'secret',
      cadence: 'Every seven years, during the Harvest Festival',
      keeper: 'High Sage Lyria Sunweaver',
      risk: 'Corruption accelerating; renewals increasingly unstable',
    },
  },
];

async function main() {
  console.log(`[bonfire-sourcebook] slug=${SLUG} owner=${OWNER_USER_ID} dryRun=${DRY_RUN}`);

  const owner = await prisma.user.findUnique({ where: { id: OWNER_USER_ID }, select: { id: true, email: true } });
  if (!owner) throw new Error(`Owner user ${OWNER_USER_ID} not found`);

  // 1. Entitlement + Sourcebook (mirror create-master-sourcebook's stub creation).
  let sourcebookId = 'dry-run';
  if (!DRY_RUN) {
    const entitlement = await prisma.ddbEntitlement.upsert({
      where: { userId_slug: { userId: OWNER_USER_ID, slug: SLUG } },
      create: { userId: OWNER_USER_ID, slug: SLUG, title: TITLE, accessType: 'owned', sourceUrl: SOURCE_URL },
      update: { title: TITLE, sourceUrl: SOURCE_URL },
    });
    const sourcebook = await prisma.ddbSourcebook.upsert({
      where: { userId_slug: { userId: OWNER_USER_ID, slug: SLUG } },
      create: {
        userId: OWNER_USER_ID,
        entitlementId: entitlement.id,
        slug: SLUG,
        title: TITLE,
        campaignIds: [],
        syncStatus: 'importing',
        lastSyncedAt: new Date(),
      },
      update: { title: TITLE, syncStatus: 'importing', lastSyncError: null },
    });
    sourcebookId = sourcebook.id;
  }
  console.log(`Sourcebook: ${sourcebookId}`);

  // 2. Chapters with bodySections.
  const chapterIdBySlug = new Map<string, string>();
  let totalSections = 0;
  for (let i = 0; i < CHAPTERS.length; i++) {
    const ch = CHAPTERS[i];
    const raw = readFileSync(join(FIXTURES_DIR, ch.file), 'utf8');
    const sections = parseMarkdown(raw);
    totalSections += sections.length;
    const chars = sections.reduce((n, s) => n + s.markdown.length, 0);
    console.log(`  [${String(i + 1).padStart(2, '0')}/${CHAPTERS.length}] ${ch.slug} — ${sections.length} sections, ${chars.toLocaleString()} chars`);

    if (DRY_RUN) continue;
    const row = await prisma.ddbSourcebookChapter.upsert({
      where: { sourcebookId_slug: { sourcebookId, slug: ch.slug } },
      create: {
        sourcebookId,
        slug: ch.slug,
        title: ch.title,
        chapterIndex: i,
        parentSlug: null,
        bodySections: sections as unknown as Prisma.InputJsonValue,
        bodySyncedAt: new Date(),
        syncStatus: 'idle',
      },
      update: {
        title: ch.title,
        chapterIndex: i,
        bodySections: sections as unknown as Prisma.InputJsonValue,
        bodySyncedAt: new Date(),
      },
    });
    chapterIdBySlug.set(ch.slug, row.id);
  }
  console.log(`Chapters: ${CHAPTERS.length} (${totalSections} sections total)`);

  // 3. Hand-authored FACTION / THREAT / SECRET entities.
  let authored = 0;
  for (const e of AUTHORED_ENTITIES) {
    if (DRY_RUN) {
      authored++;
      continue;
    }
    await prisma.sourcebookEntity.upsert({
      where: { sourcebookId_type_name: { sourcebookId, type: e.type, name: e.name } },
      create: {
        sourcebookId,
        chapterId: chapterIdBySlug.get(e.chapterSlug) ?? null,
        type: e.type,
        name: e.name,
        aliases: e.aliases ?? [],
        description: e.description,
        properties: e.properties as Prisma.InputJsonValue,
        sourceType: SOURCE_TYPE,
        confidence: 1,
      },
      update: {
        chapterId: chapterIdBySlug.get(e.chapterSlug) ?? null,
        aliases: e.aliases ?? [],
        description: e.description,
        properties: e.properties as Prisma.InputJsonValue,
      },
    });
    authored++;
  }
  const byType = AUTHORED_ENTITIES.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Authored entities: ${authored} (${Object.entries(byType).map(([t, n]) => `${t}=${n}`).join(', ')})`);

  console.log('\nNext: npx tsx scripts/create-master-sourcebook.ts --slug tales-bonfire-keep --skip-crawl --skip-images');
  console.log('Then link to a campaign via the UI (Sourcebooks → Tales from The Bonfire Keep → Add to campaign).');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
