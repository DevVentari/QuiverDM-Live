import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
config({ path: '.env.local', override: false });

type PhaseName = 'smoke' | 'workflows';

type PlaywrightResult = {
  status?: string;
  errors?: Array<{ message?: string; stack?: string; location?: unknown }>;
  attachments?: Array<{ name?: string; contentType?: string; path?: string }>;
};

type PlaywrightTest = {
  status?: string;
  expectedStatus?: string;
  projectName?: string;
  results?: PlaywrightResult[];
};

type PlaywrightSpec = {
  title?: string;
  file?: string;
  line?: number;
  tests?: PlaywrightTest[];
};

type PlaywrightSuite = {
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
};

type PlaywrightJson = {
  suites?: PlaywrightSuite[];
  errors?: Array<{ message?: string }>;
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
};

type FailureEntry = {
  phase: PhaseName;
  specTitle: string;
  file: string;
  line: number | null;
  project: string;
  error: string;
  artifactPaths: string[];
  reproCommand: string;
};

type PhaseResult = {
  phase: PhaseName;
  command: string;
  status: 'passed' | 'failed';
  exitCode: number;
  durationMs: number;
  stats: {
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  } | null;
  failures: FailureEntry[];
  rawReportPath: string | null;
  error?: string;
};

function extractJson(stdout: string): PlaywrightJson | null {
  // Skip any prefix lines (e.g. dotenv tip output containing inline braces)
  // and find the actual JSON object that starts on its own line.
  const newlineStart = stdout.indexOf('\n{');
  const start = newlineStart !== -1 ? newlineStart + 1 : stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stdout.slice(start, end + 1)) as PlaywrightJson;
  } catch {
    return null;
  }
}

function flattenSpecs(suites: PlaywrightSuite[] | undefined, out: PlaywrightSpec[] = []): PlaywrightSpec[] {
  if (!suites) return out;
  for (const suite of suites) {
    if (suite.specs) out.push(...suite.specs);
    if (suite.suites) flattenSpecs(suite.suites, out);
  }
  return out;
}

function normalizeArtifactPath(pathValue: string): string {
  return isAbsolute(pathValue) ? pathValue : resolve(process.cwd(), pathValue);
}

function collectFailures(phase: PhaseName, testPath: string, report: PlaywrightJson | null): FailureEntry[] {
  if (!report) {
    return [
      {
        phase,
        specTitle: `${phase} report parse failure`,
        file: testPath,
        line: null,
        project: 'unknown',
        error: 'Unable to parse Playwright JSON output.',
        artifactPaths: [],
        reproCommand: `npx playwright test ${testPath} --reporter=list`,
      },
    ];
  }

  const failures: FailureEntry[] = [];
  for (const spec of flattenSpecs(report.suites)) {
    const tests = spec.tests ?? [];
    for (const test of tests) {
      const failingResults = (test.results ?? []).filter(
        (result) => !['passed', 'skipped'].includes(result.status ?? ''),
      );
      for (const result of failingResults) {
        const error =
          result.errors?.find((err) => Boolean(err?.message))?.message ??
          report.errors?.find((err) => Boolean(err?.message))?.message ??
          'Unknown Playwright failure.';
        const artifactPaths = (result.attachments ?? [])
          .map((attachment) => attachment.path)
          .filter((pathValue): pathValue is string => Boolean(pathValue))
          .map(normalizeArtifactPath);

        failures.push({
          phase,
          specTitle: spec.title ?? 'Untitled spec',
          file: spec.file ?? testPath,
          line: spec.line ?? null,
          project: test.projectName ?? 'unknown',
          error,
          artifactPaths,
          reproCommand: `npx playwright test ${spec.file ?? testPath} --project=${test.projectName ?? 'chromium'} --reporter=list`,
        });
      }
    }
  }
  return failures;
}

function runPhase(phase: PhaseName, testPath: string, rawReportDir: string): Promise<PhaseResult> {
  const baseArgs = ['playwright', 'test', testPath, '--reporter=json'];
  const command = `npx ${baseArgs.join(' ')}`;
  const started = Date.now();

  return new Promise((resolvePhase) => {
    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', command], {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          })
        : spawn('npx', baseArgs, {
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - started;
      const parsed = extractJson(stdout);
      const rawReportPath = join(rawReportDir, `${phase}.json`);
      if (parsed) writeFileSync(rawReportPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

      const stats = parsed?.stats
        ? {
            expected: parsed.stats.expected ?? 0,
            unexpected: parsed.stats.unexpected ?? 0,
            flaky: parsed.stats.flaky ?? 0,
            skipped: parsed.stats.skipped ?? 0,
          }
        : null;
      const failures = collectFailures(phase, testPath, parsed);

      const status = code === 0 ? 'passed' : 'failed';
      process.stdout.write(
        `[${phase}] ${status.toUpperCase()} in ${durationMs}ms` +
          (stats ? ` (expected=${stats.expected}, unexpected=${stats.unexpected})` : '') +
          `\n`,
      );

      resolvePhase({
        phase,
        command,
        status,
        exitCode: code ?? -1,
        durationMs,
        stats,
        failures: code === 0 ? [] : failures,
        rawReportPath: parsed ? rawReportPath : null,
        error: code === 0 ? undefined : stderr.trim() || 'Playwright returned non-zero exit code.',
      });
    });
  });
}

function sanitizeFileName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function exportFailureTemplates(
  failures: FailureEntry[],
  issuesDir: string,
  artifactsDir: string,
  baseUrl: string,
): string[] {
  if (failures.length === 0) return [];

  mkdirSync(issuesDir, { recursive: true });
  mkdirSync(artifactsDir, { recursive: true });

  const issueFiles: string[] = [];
  failures.forEach((failure, index) => {
    const copiedArtifacts: string[] = [];
    failure.artifactPaths.forEach((artifactPath, artifactIndex) => {
      if (!existsSync(artifactPath)) return;
      const outName = `${String(index + 1).padStart(2, '0')}-${artifactIndex + 1}-${basename(artifactPath)}`;
      const outPath = join(artifactsDir, outName);
      copyFileSync(artifactPath, outPath);
      copiedArtifacts.push(outPath);
    });

    const fileName = `${String(index + 1).padStart(2, '0')}-${sanitizeFileName(failure.phase)}-${sanitizeFileName(
      failure.specTitle,
    )}.md`;
    const issuePath = join(issuesDir, fileName);
    const artifactLines =
      copiedArtifacts.length === 0
        ? '- None captured'
        : copiedArtifacts.map((artifact) => `- ${artifact}`).join('\n');

    const body = `# [QA][${failure.phase}] ${failure.specTitle}

## Summary
- Base URL: ${baseUrl}
- Phase: ${failure.phase}
- Project: ${failure.project}
- Spec file: ${failure.file}${failure.line ? `:${failure.line}` : ''}

## Repro
\`\`\`bash
BASE_URL=${baseUrl} ${failure.reproCommand}
\`\`\`

## Error
\`\`\`
${failure.error}
\`\`\`

## Captured Artifacts
${artifactLines}
`;
    writeFileSync(issuePath, body, 'utf8');
    issueFiles.push(issuePath);
  });

  return issueFiles;
}

async function main() {
  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
  const reportDir = join(process.cwd(), 'reports', 'playwright-cycle');
  const runDir = join(reportDir, timestamp);
  const rawReportDir = join(runDir, 'raw');
  const issuesDir = join(runDir, 'issues');
  const artifactsDir = join(runDir, 'artifacts');
  mkdirSync(rawReportDir, { recursive: true });

  const baseUrl = process.env.BASE_URL ?? process.env.QA_APP_URL ?? 'http://localhost:3847';
  const smoke = await runPhase('smoke', 'tests/smoke', rawReportDir);
  const workflows = await runPhase('workflows', 'tests/workflows', rawReportDir);
  const failures = [...smoke.failures, ...workflows.failures];
  const issueFiles = exportFailureTemplates(failures, issuesDir, artifactsDir, baseUrl);
  const finishedAt = new Date();

  const report = {
    runId: `qa-cycle-${timestamp}`,
    generatedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    baseUrl,
    overallStatus: smoke.status === 'passed' && workflows.status === 'passed' ? 'passed' : 'failed',
    phases: [smoke, workflows].map((phase) => ({
      phase: phase.phase,
      command: phase.command,
      status: phase.status,
      exitCode: phase.exitCode,
      durationMs: phase.durationMs,
      stats: phase.stats,
      rawReportPath: phase.rawReportPath,
    })),
    failureCount: failures.length,
    failures,
    issueTemplates: issueFiles,
  };

  const outPath = join(reportDir, `${timestamp}.json`);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  process.stdout.write(`QA cycle report written: ${outPath}\n`);
  if (issueFiles.length > 0) process.stdout.write(`Issue templates written: ${issuesDir}\n`);
  if (report.overallStatus === 'failed') process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`qa:cycle failed: ${message}\n`);
  process.exit(1);
});
