/**
 * Test script to verify environment variable passing
 */

const pdfId = process.env.HOMEBREW_PDF_ID;
const userId = process.env.HOMEBREW_USER_ID;
const useAI = process.env.HOMEBREW_USE_AI;

console.log('Environment variables received:');
console.log('  HOMEBREW_PDF_ID:', pdfId);
console.log('  HOMEBREW_USER_ID:', userId);
console.log('  HOMEBREW_USE_AI:', useAI);

if (pdfId && userId && useAI) {
  console.log('✅ All environment variables present');
  process.exit(0);
} else {
  console.error('❌ Missing environment variables');
  process.exit(1);
}
