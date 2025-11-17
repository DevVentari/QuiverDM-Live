import { readFileSync, writeFileSync } from 'fs';

const routers = [
  {
    file: 'src/server/routers/npcs.ts',
    model: 'NPC',
    verifyFunction: 'verifyNPCOwnership',
  },
  {
    file: 'src/server/routers/players.ts',
    model: 'Player',
    verifyFunction: 'verifyPlayerOwnership',
  },
  {
    file: 'src/server/routers/sessions.ts',
    model: 'GameSession',
    verifyFunction: 'verifySessionOwnership',
  },
];

for (const { file, model, verifyFunction } of routers) {
  console.log(`\nFixing ${file}...`);
  let content = readFileSync(file, 'utf-8');

  // Add protectedProcedure to imports
  if (!content.includes('protectedProcedure')) {
    content = content.replace(
      'import { router, publicProcedure }',
      'import { router, publicProcedure, protectedProcedure }'
    );
    console.log('  ✓ Added protectedProcedure to imports');
  }

  // Add ownership verification imports
  if (!content.includes(verifyFunction)) {
    const lastImportIndex = content.lastIndexOf('import ');
    const nextNewlineAfterImport = content.indexOf('\n', lastImportIndex);
    const ownershipImport = `import { ${verifyFunction}, verifyCampaignOwnership } from '../lib/ownership';\n`;
    content = content.slice(0, nextNewlineAfterImport + 1) + ownershipImport + content.slice(nextNewlineAfterImport + 1);
    console.log('  ✓ Added ownership verification imports');
  }

  // Replace all publicProcedure with protectedProcedure
  let procedureCount = 0;
  content = content.replace(/(\w+):\s+publicProcedure/g, (match, procedureName) => {
    procedureCount++;
    return `${procedureName}: protectedProcedure`;
  });
  console.log(`  ✓ Converted ${procedureCount} procedures to protectedProcedure`);

  // Add ctx parameter and userId extraction to all queries/mutations
  content = content.replace(/\.(query|mutation)\(async \(\{ input \}\) => \{/g, (match, type) => {
    return `.${type}(async ({ input, ctx }) => {\n      const userId = ctx.session.user.id;`;
  });

  // Add campaign ownership verification to getAll
  content = content.replace(
    /(getAll:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
    '$1\n      if (input.campaignId) {\n        await verifyCampaignOwnership(input.campaignId, userId);\n      }'
  );

  // Add resource ownership verification to getById
  content = content.replace(
    /(getById:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
    `$1\n      await ${verifyFunction}(input.id, userId);`
  );

  // Add campaign ownership verification to create
  content = content.replace(
    /(create:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
    '$1\n      await verifyCampaignOwnership(input.campaignId, userId);'
  );

  // Add resource ownership verification to update
  content = content.replace(
    /(update:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
    `$1\n      await ${verifyFunction}(input.id, userId);`
  );

  // Add resource ownership verification to delete
  content = content.replace(
    /(delete:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
    `$1\n      await ${verifyFunction}(input.id, userId);`
  );

  // For sessions.ts - add verification to getActive and complete
  if (file.includes('sessions.ts')) {
    content = content.replace(
      /(getActive:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyCampaignOwnership(input.campaignId, userId);'
    );
    content = content.replace(
      /(complete:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      `$1\n      await ${verifyFunction}(input.id, userId);`
    );
  }

  // For npcs.ts - add verification to getByFaction and getFactions
  if (file.includes('npcs.ts')) {
    content = content.replace(
      /(getByFaction:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyCampaignOwnership(input.campaignId, userId);'
    );
    content = content.replace(
      /(getFactions:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyCampaignOwnership(input.campaignId, userId);'
    );
  }

  writeFileSync(file, content, 'utf-8');
  console.log(`  ✅ ${file} fixed!`);
}

console.log('\n✅ All campaign-related routers fixed!');
