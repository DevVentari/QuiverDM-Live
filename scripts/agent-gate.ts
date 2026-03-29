/**
 * Agent gate runner.
 *
 * Runs objective checks for an agent task and stores a structured result artifact.
 *
 * Usage:
 *   npx tsx scripts/agent-gate.ts --task TASK-123 --agent AGENT_B
 *   npx tsx scripts/agent-gate.ts --task TASK-123 --agent AGENT_B --check "npm run test:quick"
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

type CheckResult = {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number;
  stdoutTail?: string;
  stderrTail?: string;
};

type GateResult = {
  taskId: string;
  ownerAgent: string;
  status: 'passed' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  changedFiles: string[];
  checks: CheckResult[];
  artifacts: string[];
  notes?: string;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

function getArgs(flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) {
      values.push(process.argv[i + 1]);
    }
  }
  return values;
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runCheck(name: string, command: string): CheckResult {
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      name,
      command,
      passed: true,
      exitCode: 0,
      stdoutTail: output.slice(-2000),
    };
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() ?? '';
    const stderr = error?.stderr?.toString?.() ?? '';
    const exitCode = typeof error?.status === 'number' ? error.status : 1;

    return {
      name,
      command,
      passed: false,
      exitCode,
      stdoutTail: stdout.slice(-2000),
      stderrTail: stderr.slice(-2000),
    };
  }
}

function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only', {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function stampForFile(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

function main() {
  const taskId = getArg('--task') ?? getArg('--task-id') ?? `task-${Date.now()}`;
  const ownerAgent = getArg('--agent') ?? 'AGENT_ORCHESTRATOR';
  const extraChecks = getArgs('--check');
  const note = getArg('--notes');

  const checksToRun: Array<{ name: string; command: string }> = [
    { name: 'TypeScript', command: 'npx tsc --noEmit --pretty false' },
    { name: 'Lint', command: 'npm run lint' },
    ...extraChecks.map((cmd, idx) => ({
      name: `Custom-${idx + 1}`,
      command: cmd,
    })),
  ];

  const started = new Date();
  const results = checksToRun.map((c) => runCheck(c.name, c.command));
  const ended = new Date();
  const passed = results.every((r) => r.passed);

  const outDir = path.join(process.cwd(), 'docs', 'agents', 'results');
  ensureDir(outDir);
  const filename = `${stampForFile(started)}_${taskId}_gate.json`;
  const outPath = path.join(outDir, filename);

  const payload: GateResult = {
    taskId,
    ownerAgent,
    status: passed ? 'passed' : 'failed',
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    durationMs: ended.getTime() - started.getTime(),
    changedFiles: getChangedFiles(),
    checks: results,
    artifacts: [path.relative(process.cwd(), outPath)],
    notes: note,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`[agent-gate] Task: ${taskId}`);
  console.log(`[agent-gate] Agent: ${ownerAgent}`);
  console.log(`[agent-gate] Status: ${payload.status}`);
  console.log(`[agent-gate] Artifact: ${path.relative(process.cwd(), outPath)}`);

  for (const check of results) {
    console.log(` - ${check.name}: ${check.passed ? 'PASS' : 'FAIL'} (${check.command})`);
  }

  process.exit(passed ? 0 : 1);
}

main();
