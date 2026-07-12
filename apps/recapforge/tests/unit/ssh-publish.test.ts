import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock child_process.spawn with a controllable fake process.
const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => spawnMock(...a) }));
vi.mock('node:fs/promises', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, writeFile: vi.fn().mockResolvedValue(undefined), rm: vi.fn().mockResolvedValue(undefined), mkdtemp: vi.fn().mockResolvedValue('/tmp/ssh-XXX') };
});

import { sshPublish } from '@/lib/ssh-publish';
import { rm } from 'node:fs/promises';

function fakeProc() {
  const proc = new EventEmitter() as EventEmitter & { stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }; stdout: EventEmitter; stderr: EventEmitter; kill: ReturnType<typeof vi.fn> };
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  return proc;
}

beforeEach(() => { spawnMock.mockReset(); });

// The transport does a couple of chained awaits (mkdtemp -> writeFile(s))
// before it calls spawn. Flush several microtask ticks so spawn has been
// invoked before the test drives the fake process.
async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('sshPublish', () => {
  it('spawns ssh with the pinned flags + session number, pipes html, resolves on exit 0', async () => {
    const proc = fakeProc();
    spawnMock.mockReturnValue(proc);
    const p = sshPublish({ host: 'h', user: 'u', sessionNumber: 5, html: '<html>x</html>', privateKey: 'KEY' });
    // let the async setup run, then drive the fake process
    await flushMicrotasks();
    proc.stdout.emit('data', Buffer.from('published session-5'));
    proc.emit('close', 0);
    await expect(p).resolves.toContain('published session-5');

    const [cmd, args] = spawnMock.mock.calls[0];
    expect(cmd).toBe('ssh');
    expect(args).toContain('u@h');
    expect(args).toContain('5');                        // session number is the ssh command
    expect(args.join(' ')).toContain('BatchMode=yes');
    expect(args.join(' ')).toContain('StrictHostKeyChecking=yes');
    expect(proc.stdin.write).toHaveBeenCalledWith('<html>x</html>');
    expect(proc.stdin.end).toHaveBeenCalled();
    expect(rm).toHaveBeenCalled();                       // temp key cleaned up
  });

  it('rejects on non-zero exit and still cleans up the key', async () => {
    const proc = fakeProc();
    spawnMock.mockReturnValue(proc);
    const p = sshPublish({ host: 'h', user: 'u', sessionNumber: 5, html: 'x', privateKey: 'KEY' });
    await flushMicrotasks();
    proc.stderr.emit('data', Buffer.from('bad session number'));
    proc.emit('close', 1);
    await expect(p).rejects.toThrow(/bad session number|exit 1/i);
    expect(rm).toHaveBeenCalled();
  });
});
