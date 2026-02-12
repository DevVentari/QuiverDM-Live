/**
 * Kill any process using the specified port.
 * Usage: node scripts/kill-port.js <port>
 */

const { execFileSync } = require('child_process');
const port = process.argv[2];

if (!port || !/^\d+$/.test(port)) {
  console.error('Usage: node scripts/kill-port.js <port>');
  process.exit(1);
}

try {
  if (process.platform === 'win32') {
    // Windows: find PID using netstat, then kill it
    let output;
    try {
      output = execFileSync('cmd', ['/c', `netstat -ano | findstr :${port} | findstr LISTENING`], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // No process listening — nothing to kill
      process.exit(0);
    }

    const lines = output.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'pipe' });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch {
        // Process may have already exited
      }
    }
  } else {
    // Unix/Mac: use lsof + kill
    let output;
    try {
      output = execFileSync('lsof', ['-ti', `:${port}`], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // No process listening — nothing to kill
      process.exit(0);
    }

    const pids = output.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        execFileSync('kill', ['-9', pid], { stdio: 'pipe' });
        console.log(`Killed process ${pid} on port ${port}`);
      } catch {
        // Process may have already exited
      }
    }
  }
} catch {
  // Unexpected error — exit cleanly so dev server still starts
}
