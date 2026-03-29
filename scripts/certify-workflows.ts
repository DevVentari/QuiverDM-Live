/**
 * Certify workflow E2E readiness by requiring at least N successful runs.
 *
 * Usage:
 *   npx tsx scripts/certify-workflows.ts
 *   npx tsx scripts/certify-workflows.ts --workflow pdf-processing
 */

import fs from 'fs';
import path from 'path';

type WorkflowRunResult = {
  workflow: string;
  runId: string;
  status: 'passed' | 'failed';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  command: string;
  assertions: Array<{ name: string; passed: boolean; detail?: string }>;
  evidencePaths: string[];
  notes?: string;
};

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

function loadConfig() {
  const configArg = getArg('--config');
  const configPath = configArg
    ? path.join(process.cwd(), configArg)
    : path.join(process.cwd(), 'config', 'agent-workflows.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
    minimumSuccessfulRuns: number;
    workflows: Record<string, { resultDir: string; description: string; recommendedCommand: string }>;
  };
}

function readWorkflowRuns(resultDir: string): WorkflowRunResult[] {
  if (!fs.existsSync(resultDir)) return [];
  const files = fs.readdirSync(resultDir).filter((f) => f.endsWith('.json'));
  const runs: WorkflowRunResult[] = [];

  for (const file of files) {
    try {
      const fullPath = path.join(resultDir, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<WorkflowRunResult>;
      if (parsed.workflow && parsed.runId && parsed.status) {
        runs.push(parsed as WorkflowRunResult);
      }
    } catch {
      // Ignore malformed files in summary pass.
    }
  }

  return runs.sort((a, b) => {
    const aTime = new Date(a.startedAt).getTime();
    const bTime = new Date(b.startedAt).getTime();
    return aTime - bTime;
  });
}

function main() {
  const config = loadConfig();
  const onlyWorkflow = getArg('--workflow');
  const minimum = config.minimumSuccessfulRuns;

  const workflowEntries = Object.entries(config.workflows).filter(([workflowName]) => {
    if (!onlyWorkflow) return true;
    return workflowName === onlyWorkflow;
  });

  if (workflowEntries.length === 0) {
    console.error(`Unknown workflow "${onlyWorkflow}".`);
    process.exit(1);
  }

  let allPassed = true;

  for (const [workflowName, wfConfig] of workflowEntries) {
    const resultDir = path.join(process.cwd(), wfConfig.resultDir);
    fs.mkdirSync(resultDir, { recursive: true });
    const runs = readWorkflowRuns(resultDir);
    const passedRuns = runs.filter((r) => r.status === 'passed');
    const failedRuns = runs.filter((r) => r.status === 'failed');

    const certification = {
      workflow: workflowName,
      description: wfConfig.description,
      minimumSuccessfulRuns: minimum,
      successfulRuns: passedRuns.length,
      failedRuns: failedRuns.length,
      certified: passedRuns.length >= minimum,
      latestRuns: runs.slice(-10).map((r) => ({
        runId: r.runId,
        status: r.status,
        startedAt: r.startedAt,
        command: r.command,
      })),
      generatedAt: new Date().toISOString(),
    };

    const summaryPath = path.join(resultDir, 'certification-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(certification, null, 2), 'utf8');

    const mdPath = path.join(resultDir, 'certification-summary.md');
    const md = [
      `# Workflow Certification: ${workflowName}`,
      '',
      `- Certified: **${certification.certified ? 'YES' : 'NO'}**`,
      `- Required successful runs: ${minimum}`,
      `- Successful runs: ${passedRuns.length}`,
      `- Failed runs: ${failedRuns.length}`,
      `- Generated at: ${certification.generatedAt}`,
      '',
      '## Latest Runs',
      ...certification.latestRuns.map(
        (r) => `- \`${r.runId}\` - ${r.status.toUpperCase()} - ${r.startedAt} - \`${r.command}\``
      ),
    ].join('\n');
    fs.writeFileSync(mdPath, md, 'utf8');

    console.log(
      `[certify] ${workflowName}: ${certification.certified ? 'CERTIFIED' : 'NOT CERTIFIED'} ` +
      `(${passedRuns.length}/${minimum} successful runs)`
    );

    if (!certification.certified) {
      allPassed = false;
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main();
