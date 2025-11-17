/**
 * Test script to verify JSON command-line argument passing
 */

const argsJson = process.argv[2];
console.log('Raw argument received:', argsJson);

try {
  const parsed = JSON.parse(argsJson);
  console.log('✅ Successfully parsed JSON:', parsed);
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to parse JSON:', error);
  console.error('Argument was:', argsJson);
  process.exit(1);
}
