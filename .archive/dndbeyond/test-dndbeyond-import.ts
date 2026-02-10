/**
 * Test script for D&D Beyond character import
 *
 * Usage: npx tsx scripts/test-dndbeyond-import.ts <character-url>
 */

import { importFromDndBeyond } from '../src/lib/dndbeyond-importer';

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('❌ Please provide a D&D Beyond character URL');
    console.log('Usage: npx tsx scripts/test-dndbeyond-import.ts <url>');
    console.log('\nExample:');
    console.log('  npx tsx scripts/test-dndbeyond-import.ts https://www.dndbeyond.com/characters/12345678');
    process.exit(1);
  }

  console.log('🎲 Testing D&D Beyond Import\n');
  console.log(`URL: ${url}\n`);

  try {
    console.log('📥 Fetching character data...');
    const characterData = await importFromDndBeyond(url);

    console.log('\n✅ Successfully imported character!\n');
    console.log('📋 Character Data:');
    console.log('━'.repeat(60));
    console.log(`Name:         ${characterData.characterName}`);
    console.log(`Player:       ${characterData.playerName || 'N/A'}`);
    console.log(`Race:         ${characterData.race}`);
    console.log(`Class:        ${characterData.class}`);
    console.log(`Level:        ${characterData.level}`);
    console.log(`AC:           ${characterData.armorClass}`);
    console.log(`HP:           ${characterData.hitPoints.current}/${characterData.hitPoints.max}`);
    console.log(`Speed:        ${characterData.speed}`);
    console.log(`Prof Bonus:   +${characterData.proficiencyBonus}`);
    console.log('\n📊 Ability Scores:');
    console.log(`  STR: ${characterData.abilityScores.str} | DEX: ${characterData.abilityScores.dex} | CON: ${characterData.abilityScores.con}`);
    console.log(`  INT: ${characterData.abilityScores.int} | WIS: ${characterData.abilityScores.wis} | CHA: ${characterData.abilityScores.cha}`);

    if (characterData.backstory) {
      console.log('\n📖 Backstory:');
      console.log(characterData.backstory.substring(0, 200) + (characterData.backstory.length > 200 ? '...' : ''));
    }

    if (characterData.features.length > 0) {
      console.log(`\n✨ Features: ${characterData.features.length} total`);
      characterData.features.slice(0, 3).forEach((feature) => {
        console.log(`  - ${feature.name}`);
      });
      if (characterData.features.length > 3) {
        console.log(`  ... and ${characterData.features.length - 3} more`);
      }
    }

    if (characterData.equipment.length > 0) {
      console.log(`\n🎒 Equipment: ${characterData.equipment.length} items`);
      characterData.equipment.slice(0, 5).forEach((item) => {
        console.log(`  - ${item}`);
      });
      if (characterData.equipment.length > 5) {
        console.log(`  ... and ${characterData.equipment.length - 5} more`);
      }
    }

    if (characterData.imageUrl) {
      console.log(`\n🖼️  Image: ${characterData.imageUrl}`);
    }

    console.log('\n━'.repeat(60));
    console.log('✅ Import test completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Import failed:');
    console.error(error.message);
    if (error.message.includes('not public')) {
      console.log('\n💡 Tip: Make sure the character is set to public on D&D Beyond:');
      console.log('   1. Go to your character page');
      console.log('   2. Click the "⚙️ Configure" button');
      console.log('   3. Toggle "Public" to ON');
    }
    process.exit(1);
  }
}

main();
