/**
 * Test Ollama Configuration
 *
 * Verifies that Ollama is installed, running, and can parse D&D content
 */

import { isOllamaAvailable, listOllamaModels, chatWithOllama } from '../src/lib/ollama';
import { parseHomebrewMarkdown } from '../src/lib/homebrew-parser';

// Sample D&D homebrew markdown for testing
const SAMPLE_MARKDOWN = `
# Sword of Flames

Weapon (longsword), rare (requires attunement)

This magical longsword is wreathed in flames. You gain a +1 bonus to attack and damage rolls made with this magic weapon. When you hit with an attack using this sword, the target takes an extra 1d6 fire damage.

# Fireball

3rd-level evocation

**Casting Time:** 1 action
**Range:** 150 feet
**Components:** V, S, M (a tiny ball of bat guano and sulfur)
**Duration:** Instantaneous

A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.

# Fire Elemental

Large elemental, neutral

**Armor Class:** 13
**Hit Points:** 102 (12d10 + 36)
**Speed:** 50 ft.

**Challenge:** 5 (1,800 XP)

A creature of living flame, the fire elemental is a force of destruction.
`;

async function main() {
  console.log('=== Ollama Configuration Test ===\n');

  // Step 1: Check if Ollama is available
  console.log('Step 1: Checking if Ollama is running...');
  const available = await isOllamaAvailable();

  if (!available) {
    console.error('❌ Ollama is not running or not accessible at http://localhost:11434');
    console.log('\nPlease ensure:');
    console.log('  1. Ollama is installed (see docs/OLLAMA_SETUP.md)');
    console.log('  2. Ollama service is running');
    console.log('  3. Port 11434 is not blocked\n');
    process.exit(1);
  }

  console.log('✅ Ollama is running\n');

  // Step 2: List available models
  console.log('Step 2: Listing available models...');
  const models = await listOllamaModels();

  if (models.length === 0) {
    console.error('❌ No models found');
    console.log('\nPlease pull a model:');
    console.log('  ollama pull llama3.2\n');
    process.exit(1);
  }

  console.log(`✅ Found ${models.length} model(s):`);
  models.forEach((model) => console.log(`   - ${model}`));
  console.log();

  // Step 3: Test simple chat
  console.log('Step 3: Testing basic chat...');
  try {
    const response = await chatWithOllama(
      [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with exactly: "Hello from Ollama!"',
        },
        {
          role: 'user',
          content: 'Say hello',
        },
      ],
      { model: 'llama3.2' }
    );

    console.log(`✅ Chat response: ${response.trim()}\n`);
  } catch (error) {
    console.error('❌ Chat test failed:', error);
    process.exit(1);
  }

  // Step 4: Test D&D content parsing
  console.log('Step 4: Testing D&D homebrew parsing...');
  console.log('Parsing sample markdown with 3 items (spell, monster, magic item)...\n');

  try {
    const result = await parseHomebrewMarkdown(SAMPLE_MARKDOWN);

    console.log(`✅ Parsing completed using: ${result.parsingMethod}`);
    console.log(`✅ Found ${result.totalFound} item(s):\n`);

    result.items.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.name} (${item.type})`);
      console.log(`   Description: ${item.description.substring(0, 80)}...`);
      console.log(`   Data keys: ${Object.keys(item.data).join(', ')}`);
      console.log();
    });

    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      result.warnings.forEach((w) => console.log(`   - ${w}`));
      console.log();
    }
  } catch (error) {
    console.error('❌ Parsing test failed:', error);
    process.exit(1);
  }

  // Summary
  console.log('=== Test Summary ===');
  console.log('✅ Ollama is configured correctly');
  console.log('✅ Models are available');
  console.log('✅ Chat API is working');
  console.log('✅ D&D content parsing is functional\n');

  console.log('You can now upload D&D PDFs to QuiverDM!');
  console.log('The system will automatically use Ollama for intelligent parsing.\n');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
