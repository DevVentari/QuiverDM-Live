import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 Adding NPCs from Tales from The Bonfire Keep...\n');

  // Find or create the campaign
  let campaign = await prisma.campaign.findFirst({
    where: {
      name: 'Tales from The Bonfire Keep'
    }
  });

  if (!campaign) {
    console.log('Creating campaign: Tales from The Bonfire Keep');
    // Need to create a temp user first
    let user = await prisma.user.findFirst({
      where: { email: 'temp@example.com' }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'temp@example.com',
          name: 'Temp User',
        }
      });
    }

    campaign = await prisma.campaign.create({
      data: {
        name: 'Tales from The Bonfire Keep',
        slug: 'tales-from-the-bonfire-keep',
        description: 'A D&D campaign set in Hameria Ire, featuring cosmic forces, divine anchors, and the corruption of entropy.',
        userId: user.id,
      }
    });
    console.log('✅ Created campaign\n');
  }

  const npcs = [
    {
      name: 'Ambric the Witness',
      faction: 'Tidal Covenant',
      description: `Kalashtar Descendant-Anchor of Justice, lawful good.

Born to a Kalashtar mother and Ambric the incarnate Aspect of Justice, carries divine blood combined with Kalashtar dual consciousness. Precise and thoughtful, with deliberate pauses and slight accent. Emphasizes important words carefully.

Works as a cosmic mediator between divine law and mortal justice. His sword, made of compressed paper, bears the names of all who seek justice. Can see the moral weight of all actions and their consequences across multiple timelines.

CR 13 | AC 18 | HP 142 | Truesight 120 ft.`,
      secrets: `Living Chronicle: Everything Ambric witnesses is recorded in cosmic memory. His sword names fade only when true justice is achieved.

Perfect Judgment: Can see moral weight of all actions across multiple timelines. Occasionally paralyzed by seeing all perspectives equally. Can become emotionally overwhelmed by weight of cosmic injustice.

Divine Abilities: Divine Arbitration (3/Day) compels truth. Cosmic Enforcement (1/Day) enforces judgments. Empathic Justice stuns targets with emotional consequences of their actions.`
    },
    {
      name: 'Faeren the Story-Bearer',
      faction: 'Verdant Clans',
      description: `Ageless shapeshifter Anchor of Memory, neutral good.

Originally Faeren Nightwhisper, a half-elf bard who became a living repository of all stories after witnessing the fall of seven great empires. Form shifts to match the needs of those who must hear particular tales.

Clever wordplay and philosophical asides, speaks with harmonics—other voices telling other versions of the same tales. Contains memories and experiences of thousands of individuals across centuries.

CR 11 | AC 16 | HP 135 | Truesight 120 ft.`,
      secrets: `Living Repository: Contains memories of thousands across centuries. Can access any story needed for guidance or healing. Stories told by Faeren cannot be distorted or forgotten by magic.

Sometimes overwhelmed by weight of all the sadness carried. Can become lost in memories and forget present needs. Occasionally shares painful truths people aren't ready to hear.

Memory Healing (1/Day): Helps process trauma by sharing experiences of others who overcame similar struggles. Living Story (3/Day) grants advantage through vivid shared memories.`
    },
    {
      name: 'Temmel of the Endless Vigil',
      faction: 'Neutral Territories',
      description: `Human Anchor of Redemption, lawful good. Keeper of the Bonfire Keep.

Born Temmel Ashford, former Imperial Guard captain who assassinated Emperor Cassius the Third after discovering him performing mysterious rituals. Fled as a regicide, later found the Heartflame and became keeper of the Bonfire Keep sanctuary.

Thoughtful and lyrical, speaks like a storyteller with careful word choice. Serves drinks at the Keep that taste like whatever the person most needs to heal their spirit.

CR 10 | AC 15 | HP 120`,
      secrets: `The Assassination: Killed Emperor Cassius believing his Emperor was corrupted by dark magic. Never learned Cassius was actually maintaining cosmic imprisonment of Serenitas. Carries eternal weight of possibly being wrong.

Sanctuary Keeper: His presence maintains Bonfire Keep as absolute sanctuary—no violence can occur within its walls while he tends bar. Cannot be permanently destroyed while the Keep exists.

Burden Bearer: Can sense and partially absorb spiritual weight carried by others. Redemptive Touch heals both physical and moral anguish. Cleansing Draught (3/Day) removes curses and spiritual corruption.`
    },
    {
      name: 'Emperor Aurelias Draconius',
      faction: 'Sunward Empire',
      description: `Dragonborn ruler, lawful good. Current Emperor of the Sunward Empire.

Ascended to throne fifteen years ago, inheriting both golden prosperity and darkest secret: the Empire's power comes from imprisoning Serenitas, corrupted Aspect of Entropy. Told full truth immediately due to accelerating cosmic instability.

Dignified but weary, speaks with measured authority while carrying visible weight of terrible secrets. Golden scales have lost some luster under cosmic stress.

CR 12 | AC 18 | HP 165 | Breath Weapon: 15-ft cone fire`,
      secrets: `Cosmic Burden: Knows the Empire's power comes from exploiting imprisoned divine being Serenitas. Struggles daily between revealing truth (destroying Empire) and maintaining deception (perpetuating cosmic crime).

Vulnerable to entropy effects due to knowledge of imprisonment. Only twelve people in Empire know this truth. The binding renewal occurs every seven years during Harvest Festival.`
    },
    {
      name: 'High Sage Lyria Sunweaver',
      faction: 'Sunward Empire',
      description: `Human advisor, lawful neutral. Highest magical authority in the Empire.

Rose through academic ranks based on exceptional magical talent. Inducted into cosmic secret five years ago, now maintains binding rituals she never expected to inherit. 16th-level spellcaster.

Brilliant but increasingly haunted, speaks in careful academic language while hiding devastating secrets. Shows physical signs of stress from maintaining cosmic deception.

CR 9 | AC 15 | HP 120 | Spell Save DC 20`,
      secrets: `Binding Ritual Master: Responsible for renewing Serenitas's imprisonment every seven years during Harvest Festival. Has spent years trying to find alternatives to cosmic crime.

Knows full truth about Empire's power source. Can cast any ritual spell. Paralyzed by knowledge of cosmic consequences. Sometimes withholds crucial information to protect others from unbearable truth.`
    },
    {
      name: 'Captain Helena Torres',
      faction: 'Sunward Empire',
      description: `Human military officer, lawful good. Highest-ranking military officer coordinating Imperial defense.

Promoted to Captain after Marcus Draven's corruption. Combines military precision with genuine concern for troops and civilians. Coordinates multi-faction alliance military response.

Disciplined but compassionate, emphasizes preparation and clear communication. Leading defense against supernatural corruption spreading across territories.

CR 8 | AC 18 | HP 95`,
      secrets: `Former Student of Draven: Learned military leadership from Marcus Draven before his corruption. Feels responsible for not recognizing the signs earlier.

Alliance Coordinator: Works with Grove-Speaker Theron and Current-Caller Nerida to coordinate environmental protection and military defense. Building unprecedented cooperation between traditionally separate factions.`
    },
    {
      name: 'Captain Marcus Draven',
      faction: 'Sunward Empire',
      description: `Human warrior, lawful evil (corrupted). Captain of Imperial Guard.

Twenty years of faithful service corrupted through exposure to Serenitas's imprisoned essence. Wields void-touched blade that channels entropy corruption. Hears whispers promising "beautiful endings" and peace through cessation.

Dutiful and professional facade hiding growing internal corruption. Increasingly drawn to promises of ending struggle through entropy.

CR 10 | AC 20 | HP 195 | Void-Touched Blade deals necrotic`,
      secrets: `Entropy Corruption: Hand trembles when touching void-touched blade. Corruption began gradually through proximity to cosmic prison. During festival crisis, cosmic alignment amplifies both corruption and power.

Assassination Attempt: Will attempt to assassinate Emperor Aurelias during festival, driven by tragic rather than evil motivations. Can potentially be redeemed if heroes reach the man beneath corruption.

Void-Touched Blade: Originally gift from Emperor, now conduit for entropy corruption. Ages targets and deals necrotic damage. Can potentially be purified.`
    },
    {
      name: 'Current-Caller Nerida Tidereader',
      faction: 'Tidal Covenant',
      description: `Triton leader, lawful good. Elected leader of the Tidal Covenant.

Rose to leadership through exceptional ability to analyze complex systems and predict consequences. Expertise in flow patterns extends to social, economic, and magical currents.

Systematic and analytical, approaches problems through data gathering and logical reasoning. Calm under pressure, passionate about finding practical solutions that serve everyone's needs.

CR 10 | AC 17 | HP 142 | Amphibious | 11th-level spellcaster`,
      secrets: `Flow Analysis: Can predict patterns and consequences with supernatural accuracy. First faction leader to systematically analyze corruption patterns, recognizing their artificial origin and Imperial epicenter.

Intelligence Network: Needs heroes to gather intelligence about corruption patterns across all territories. Developing alliance coordination strategies and communication networks between faction territories.

Practical Focus: Unlike other leaders, focuses on immediate survival and long-term adaptation strategies rather than cosmic secrets.`
    },
    {
      name: 'Serenitas the Twilight Shepherd',
      faction: 'Hameria Ire',
      description: `Corrupted Aspect of Entropy, imprisoned deity.

Originally cosmic force of gentle endings and natural transitions, corrupted by fourteen centuries of imprisonment beneath Aurelios the Golden (Imperial capital). Once shepherded peaceful conclusions, now seeks universal cessation.

Manifests as autumn incarnate—beautiful but terrible figure promising rest through ending rather than renewal. Whispers supernatural despair and accelerated decay spreading across continent.

Cosmic threat level | Imprisoned but influence leaking through bindings`,
      secrets: `The Imperial Crime: Empire draws magical power from Serenitas's bound essence. Binding renewal every seven years during Harvest Festival. Only twelve people know this truth.

Corruption Manifestations: Supernatural despair, accelerated entropy, void spawn emerging in areas of death, reality instability. Corruption has accelerated dramatically over past century.

Liberation Crisis: Eventually will escape imprisonment as binding weakens. Her corrupted influence will spread rapidly. Ultimate question: Can corrupted Aspect be healed rather than destroyed?

Whispered Influence: Promises beautiful endings and rest from struggle. Corrupts through supernatural despair—exhaustion with duty, sense that existence itself is suffering. Can be countered with hope and determination.`
    }
  ];

  console.log('Adding NPCs...\n');
  let count = 0;

  for (const npcData of npcs) {
    const existing = await prisma.nPC.findFirst({
      where: {
        campaignId: campaign.id,
        name: npcData.name
      }
    });

    if (!existing) {
      await prisma.nPC.create({
        data: {
          ...npcData,
          campaignId: campaign.id
        }
      });
      console.log(`✅ Added: ${npcData.name}`);
      count++;
    } else {
      console.log(`⏭️  Skipped (exists): ${npcData.name}`);
    }
  }

  console.log(`\n🎉 Added ${count} new NPCs to "${campaign.name}"!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
