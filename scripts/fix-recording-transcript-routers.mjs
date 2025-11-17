import { readFileSync, writeFileSync } from 'fs';

const routers = [
  {
    file: 'src/server/routers/session-recordings.ts',
    verifyFunction: 'verifyRecordingOwnership',
  },
  {
    file: 'src/server/routers/transcript.ts',
    verifyFunction: 'verifyTranscriptOwnership',
  },
  {
    file: 'src/server/routers/session-transcription.ts',
    verifyFunctions: ['verifySessionOwnership', 'verifyRecordingOwnership'],
  },
];

for (const router of routers) {
  const { file, verifyFunction, verifyFunctions } = router;
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
  const funcsToImport = verifyFunctions || [verifyFunction];
  if (!funcsToImport.some(func => content.includes(func))) {
    const lastImportIndex = content.lastIndexOf('import ');
    const nextNewlineAfterImport = content.indexOf('\n', lastImportIndex);
    const ownershipImport = `import { ${funcsToImport.join(', ')}, verifySessionOwnership } from '../lib/ownership';\n`;
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

  // For session-recordings.ts
  if (file.includes('session-recordings.ts')) {
    // Add verification to create
    content = content.replace(
      /(create:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);'
    );

    // Add verification to getBySessionId
    content = content.replace(
      /(getBySessionId:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);'
    );

    // Add verification to getById
    content = content.replace(
      /(getById:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyRecordingOwnership(input.id, userId);'
    );

    // Add verification to updateStatus
    content = content.replace(
      /(updateStatus:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyRecordingOwnership(input.id, userId);'
    );

    // Add verification to delete
    content = content.replace(
      /(delete:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyRecordingOwnership(input.id, userId);'
    );

    // Add verification to getStorageStats
    content = content.replace(
      /(getStorageStats:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);'
    );
  }

  // For transcript.ts
  if (file.includes('transcript.ts')) {
    // Add verification to getTranscript
    content = content.replace(
      /(getTranscript:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyTranscriptOwnership(input.id, userId);'
    );

    // Add verification to getSessionTranscripts
    content = content.replace(
      /(getSessionTranscripts:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);'
    );

    // Add verification to updateCorrection
    content = content.replace(
      /(updateCorrection:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyTranscriptOwnership(input.id, userId);'
    );

    // Add verification to deleteTranscript
    content = content.replace(
      /(deleteTranscript:[\s\S]*?\.mutation\(async[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifyTranscriptOwnership(input.id, userId);'
    );
  }

  // For session-transcription.ts
  if (file.includes('session-transcription.ts')) {
    // Add verification to transcribeSession
    content = content.replace(
      /(transcribeSession:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);\n      await verifyRecordingOwnership(input.recordingId, userId);'
    );

    // Add verification to getTranscriptionProgress (if it has jobId, harder to verify - skip for now)

    // Add verification to getSessionTranscriptionJobs
    content = content.replace(
      /(getSessionTranscriptionJobs:[\s\S]*?const userId = ctx\.session\.user\.id;)/,
      '$1\n      await verifySessionOwnership(input.sessionId, userId);'
    );
  }

  writeFileSync(file, content, 'utf-8');
  console.log(`  ✅ ${file} fixed!`);
}

console.log('\n✅ All recording and transcript routers fixed!');
