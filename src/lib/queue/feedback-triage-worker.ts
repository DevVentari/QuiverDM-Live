/**
 * Feedback Triage Worker
 * Picks up feedback-triage jobs, runs `claude -p` for analysis,
 * posts a color-coded embed to the Discord thread.
 *
 * Run locally: npm run worker:feedback-triage
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });

import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import type { FeedbackTriageJobData } from './feedback-triage-queue';

function getRedisConnection(): Record<string, unknown> {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const useTls = url.protocol === 'rediss:';
    return {
      host: url.hostname,
      port: parseInt(url.port || (useTls ? '6380' : '6379')),
      password: url.password || undefined,
      username: url.username !== 'default' ? url.username : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      ...(useTls ? { tls: {} } : {}),
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6380'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
    lazyConnect: true,
  };
}

async function runClaudeTriage(data: FeedbackTriageJobData): Promise<{
  severity: string;
  likely_cause: string;
  affected_files: string[];
  suggested_fix: string;
  reproduction_steps?: string;
} | null> {
  const logSummary = data.consoleLogs
    .slice(-20)
    .map((l) => `${l.level.toUpperCase()}: ${l.msg}`)
    .join('\n');

  const prompt = `You are a bug triage agent for QuiverDM, an AI-powered D&D session management web app (Next.js 15, tRPC, Prisma, PostgreSQL).

Type: ${data.type}
Page: ${data.pageUrl}
Description: ${data.description}

Console logs (last 20):
${logSummary || 'None'}

Respond with JSON ONLY — no markdown, no explanation:
{
  "severity": "low" | "medium" | "high" | "critical",
  "likely_cause": "1-2 sentence explanation",
  "affected_files": ["array of likely source file paths"],
  "suggested_fix": "concrete action to fix this",
  "reproduction_steps": "optional steps to reproduce"
}`;

  return new Promise((resolve) => {
    // Use minimal env so claude uses stored credentials rather than inheriting
    // the parent session's tokens — avoids "nested session" detection and hangs
    const childEnv: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV, CI: 'true' };
    for (const key of ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'SystemRoot', 'COMSPEC']) {
      if (process.env[key]) childEnv[key] = process.env[key]!;
    }

    const child = spawn('claude', ['-p', prompt, '--output-format', 'json'], {
      timeout: 60000,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'], // stdin closed — claude -p hangs without this
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[feedback-triage] claude exited ${code}: ${stderr.slice(0, 200)}`);
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { result?: string };
        const text = parsed.result ?? stdout;
        resolve(JSON.parse(text));
      } catch {
        console.error('[feedback-triage] Failed to parse claude output:', stdout.slice(0, 200));
        resolve(null);
      }
    });

    child.on('error', (err) => {
      console.error('[feedback-triage] Failed to spawn claude:', err.message);
      resolve(null);
    });
  });
}

async function findRelatedIssues(
  token: string,
  affectedFiles: string[]
): Promise<Array<{ number: number; title: string; url: string }>> {
  if (!affectedFiles.length) return [];
  const repo = process.env.GITHUB_FEEDBACK_REPO ?? 'DevVentari/QuiverDM-Live';
  const filename = affectedFiles[0].split('/').pop() ?? '';
  if (!filename) return [];

  try {
    const q = encodeURIComponent(`repo:${repo} is:issue is:open ${filename}`);
    const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) return [];
    const data = await res.json() as { items: Array<{ number: number; title: string; html_url: string }> };
    return data.items.map((i) => ({ number: i.number, title: i.title, url: i.html_url }));
  } catch {
    return [];
  }
}

async function addCrossReferenceComment(token: string, issueUrl: string, related: Array<{ number: number; url: string }>) {
  const match = issueUrl.match(/issues\/(\d+)$/);
  if (!match) return;
  const repo = process.env.GITHUB_FEEDBACK_REPO ?? 'DevVentari/QuiverDM-Live';
  const seeAlso = related.map((i) => `[#${i.number}](${i.url})`).join(', ');
  const body = `**See also:** ${seeAlso}\n\n_Cross-referenced by triage — same files affected._`;

  try {
    await fetch(`https://api.github.com/repos/${repo}/issues/${match[1]}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  } catch (err) {
    console.error('[feedback-triage] Cross-reference comment failed:', err);
  }
}

async function postTriageEmbed(
  threadId: string,
  triage: NonNullable<Awaited<ReturnType<typeof runClaudeTriage>>>,
  issueUrl?: string
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;

  const severityColors: Record<string, number> = {
    critical: 0xff0000,
    high: 0xff8c00,
    medium: 0xffd700,
    low: 0x00c853,
  };

  await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [
        {
          title: `Claude Triage — ${(triage.severity ?? 'UNKNOWN').toUpperCase()} severity`,
          color: severityColors[triage.severity ?? 'medium'] ?? 0xffd700,
          fields: [
            { name: 'Likely cause', value: triage.likely_cause ?? 'Unknown', inline: false },
            { name: 'Affected files', value: (triage.affected_files ?? []).join('\n') || 'Unknown', inline: true },
            { name: 'Suggested fix', value: triage.suggested_fix ?? 'See description', inline: false },
            ...(triage.reproduction_steps
              ? [{ name: 'Reproduction', value: triage.reproduction_steps, inline: false }]
              : []),
            ...(issueUrl
              ? [{ name: 'GitHub Issue', value: `[View Issue](${issueUrl})`, inline: true }]
              : []),
          ],
          footer: { text: 'Powered by Claude Code' },
        },
      ],
    }),
  });
}

const worker = new Worker<FeedbackTriageJobData>(
  'feedback-triage',
  async (job) => {
    console.log(`[feedback-triage] Processing job ${job.id} for feedback ${job.data.feedbackId}`);

    const triage = await runClaudeTriage(job.data);
    if (!triage) {
      console.warn(`[feedback-triage] Triage returned null for ${job.data.feedbackId}`);
      return;
    }

    await postTriageEmbed(job.data.threadId, triage, job.data.issueUrl);
    console.log(`[feedback-triage] Posted triage embed for thread ${job.data.threadId}`);

    const token = process.env.GITHUB_TOKEN;
    if (token && job.data.issueUrl && triage.affected_files.length > 0) {
      const currentNumber = job.data.issueUrl.match(/issues\/(\d+)$/)?.[1];
      const related = await findRelatedIssues(token, triage.affected_files);
      const filtered = related.filter((i) => String(i.number) !== currentNumber);
      if (filtered.length > 0) {
        await addCrossReferenceComment(token, job.data.issueUrl, filtered);
        console.log(`[feedback-triage] Cross-referenced ${filtered.length} related issue(s)`);
      }
    }
  },
  {
    connection: getRedisConnection() as any,
    concurrency: 1,
  }
);

worker.on('completed', (job) => {
  console.log(`[feedback-triage] Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[feedback-triage] Job ${job?.id} failed:`, err.message);
});

console.log('[feedback-triage] Worker started — waiting for jobs');
