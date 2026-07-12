import { spawn } from 'node:child_process';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type SshPublishOpts = {
  host: string;
  user: string;
  sessionNumber: number;
  html: string;
  privateKey: string;
  knownHosts?: string;
};

/**
 * Publish one recap by piping its HTML over ssh to the CT-204 forced-command
 * receiver. The receiver's authorized_keys pins the command to writing
 * /srv/valdrath/session-<n>.html, so the only argument we pass is the numeric
 * session number. Returns ssh stdout on success; throws on non-zero/timeout.
 */
export async function sshPublish(opts: SshPublishOpts): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'recap-ssh-'));
  const keyPath = join(dir, 'id');
  const khPath = join(dir, 'known_hosts');
  try {
    await writeFile(keyPath, opts.privateKey.endsWith('\n') ? opts.privateKey : opts.privateKey + '\n', { mode: 0o600 });
    if (opts.knownHosts) await writeFile(khPath, opts.knownHosts, { mode: 0o600 });

    const args = [
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes',
      '-o', 'ConnectTimeout=5',
      ...(opts.knownHosts ? ['-o', `UserKnownHostsFile=${khPath}`] : []),
      '-i', keyPath,
      `${opts.user}@${opts.host}`,
      String(opts.sessionNumber),
    ];

    return await new Promise<string>((resolve, reject) => {
      const proc = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('ssh publish timed out'));
      }, 15_000);
      proc.stdout.on('data', (d) => { out += d.toString(); });
      proc.stderr.on('data', (d) => { err += d.toString(); });
      proc.on('error', (e) => { clearTimeout(timer); reject(e); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out.trim());
        else reject(new Error(err.trim() || `ssh exited ${code}`));
      });
      proc.stdin.write(opts.html);
      proc.stdin.end();
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
