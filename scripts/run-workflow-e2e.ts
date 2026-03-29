/**
 * Execute one workflow E2E run and record evidence.
 *
 * Usage:
 *   npx tsx scripts/run-workflow-e2e.ts --workflow pdf-processing --run-id pdf-001 --command "npm run test:e2e"
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

type Assertion = {
  name: string;
  passed: boolean;
  detail?: string;
};

type WorkflowRunResult = {
  workflow: string;
  runId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: 'passed' | 'failed';
  command: string;
  assertions: Assertion[];
  evidencePaths: string[];
  notes?: string;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;

  const parts: string[] = [];
  for (let i = idx + 1; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (token.startsWith('--')) break;
    parts.push(token);
  }

  if (parts.length === 0) return undefined;
  return parts.join(' ');
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
}

function loadWorkflowConfig(workflow: string): { recommendedCommand: string; resultDir: string } {
  const configArg = getArg('--config');
  const configPath = configArg
    ? path.join(process.cwd(), configArg)
    : path.join(process.cwd(), 'config', 'agent-workflows.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as {
    workflows: Record<string, { recommendedCommand: string; resultDir: string }>;
  };

  const wf = parsed.workflows[workflow];
  if (!wf) {
    throw new Error(`Unknown workflow "${workflow}". Add it to config/agent-workflows.json`);
  }
  return wf;
}

function main() {
  const workflow = getArg('--workflow');
  if (!workflow) {
    console.error('Missing --workflow argument');
    process.exit(1);
  }

  const runId = getArg('--run-id') ?? `run-${Date.now()}`;
  const notes = getArg('--notes');
  const overrideCommand = getArg('--command');

  const config = loadWorkflowConfig(workflow);
  const command = overrideCommand ?? config.recommendedCommand;
  if (!command || !command.trim()) {
    console.error(
      `No command configured for workflow "${workflow}". ` +
      `Provide --command or set recommendedCommand in config/agent-workflows.json`
    );
    process.exit(1);
  }
  const resultDir = path.join(process.cwd(), config.resultDir);
  ensureDir(resultDir);

  const started = new Date();
  const baseName = `${fileStamp(started)}_${runId}`;
  const logPath = path.join(resultDir, `${baseName}.log`);
  const jsonPath = path.join(resultDir, `${baseName}.json`);
  const mdPath = path.join(resultDir, `${baseName}.md`);

  let passed = false;
  let stdout = '';
  let stderr = '';

  try {
    stdout = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    passed = true;
  } catch (error: any) {
    stdout = error?.stdout?.toString?.() ?? '';
    stderr = error?.stderr?.toString?.() ?? '';
    passed = false;
  }

  const ended = new Date();
  const status: 'passed' | 'failed' = passed ? 'passed' : 'failed';
  const assertions: Assertion[] = [
    { name: 'Command exited with code 0', passed },
  ];

  const logPayload =
    `# Command\n${command}\n\n` +
    `# STDOUT\n${stdout || '(empty)'}\n\n` +
    `# STDERR\n${stderr || '(empty)'}\n`;
  fs.writeFileSync(logPath, logPayload, 'utf8');

  const payload: WorkflowRunResult = {
    workflow,
    runId,
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationMs: ended.getTime() - started.getTime(),
    status,
    command,
    assertions,
    evidencePaths: [
      path.relative(process.cwd(), logPath),
      path.relative(process.cwd(), mdPath),
      path.relative(process.cwd(), jsonPath),
    ],
    notes,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const md = [
    `# Workflow E2E Run: ${workflow}`,
    '',
    `- Run ID: \`${runId}\``,
    `- Status: **${status.toUpperCase()}**`,
    `- Started: ${payload.startedAt}`,
    `- Ended: ${payload.endedAt}`,
    `- Duration: ${payload.durationMs} ms`,
    `- Command: \`${command}\``,
    '',
    '## Assertions',
    ...assertions.map((a) => `- [${a.passed ? 'x' : ' '}] ${a.name}`),
    '',
    '## Evidence',
    `- \`${path.relative(process.cwd(), logPath)}\``,
    `- \`${path.relative(process.cwd(), jsonPath)}\``,
  ].join('\n');
  fs.writeFileSync(mdPath, md, 'utf8');

  console.log(`[workflow-e2e] ${workflow} ${runId}: ${status}`);
  console.log(`[workflow-e2e] Results: ${path.relative(process.cwd(), jsonPath)}`);
  process.exit(passed ? 0 : 1);
}

main();
