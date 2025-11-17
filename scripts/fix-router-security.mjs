import { readFileSync, writeFileSync } from 'fs';

const routerFiles = [
  'src/server/routers/campaigns.ts',
  'src/server/routers/npcs.ts',
  'src/server/routers/players.ts',
  'src/server/routers/sessions.ts',
];

for (const filePath of routerFiles) {
  console.log(`\nProcessing ${filePath}...`);
  let content = readFileSync(filePath, 'utf-8');

  // Replace publicProcedure with protectedProcedure in imports
  if (content.includes('import { router, publicProcedure }')) {
    content = content.replace(
      'import { router, publicProcedure }',
      'import { router, publicProcedure, protectedProcedure }'
    );
    console.log('  ✓ Added protectedProcedure to imports');
  }

  // Add ownership verification import if not present
  if (!content.includes('@/server/lib/ownership') && !content.includes('../lib/ownership')) {
    // Find the last import statement
    const lastImportIndex = content.lastIndexOf('import ');
    const nextNewlineAfterImport = content.indexOf('\n', lastImportIndex);

    const ownershipImport = content.includes('campaigns.ts')
      ? `import { verifyCampaignOwnership } from '../lib/ownership';\n`
      : content.includes('npcs.ts')
      ? `import { verifyNPCOwnership, verifyCampaignOwnership } from '../lib/ownership';\n`
      : content.includes('players.ts')
      ? `import { verifyPlayerOwnership, verifyCampaignOwnership } from '../lib/ownership';\n`
      : content.includes('sessions.ts')
      ? `import { verifySessionOwnership, verifyCampaignOwnership } from '../lib/ownership';\n`
      : '';

    if (ownershipImport) {
      content = content.slice(0, nextNewlineAfterImport + 1) + ownershipImport + content.slice(nextNewlineAfterImport + 1);
      console.log('  ✓ Added ownership verification imports');
    }
  }

  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ✓ Updated ${filePath}`);
}

console.log('\n✅ All routers updated with imports!');
console.log('\n⚠️  MANUAL STEPS REQUIRED:');
console.log('  1. Change specific procedures from publicProcedure to protectedProcedure');
console.log('  2. Remove userId from input schemas');
console.log('  3. Add userId = ctx.session.user.id in query/mutation handlers');
console.log('  4. Add ownership verification calls where needed');
console.log('  5. Test each endpoint thoroughly');
