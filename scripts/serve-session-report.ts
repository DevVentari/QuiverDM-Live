/**
 * Serve a session-report.html (and sibling files) over HTTP so it's
 * accessible as a link on the local network.
 *
 * Run: npx tsx scripts/serve-session-report.ts [directory] [port]
 *      directory defaults to the Jordan 2nd Campaign test folder
 *      port defaults to 3848
 *
 * Opens:
 *   http://localhost:<port>/
 *   http://<LAN-IP>:<port>/        ← share this link
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const dir  = process.argv[2] ?? 'e:/Projects/QuiverDM/docs/Test/transcription/Jordans 2nd Campaign';
const port = parseInt(process.argv[3] ?? '3848', 10);
const root = path.resolve(dir);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf':  'application/pdf',
  '.md':   'text/plain; charset=utf-8',
};

function getLanIp(): string {
  for (const iface of Object.values(os.networkInterfaces())) {
    if (!iface) continue;
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url ?? '/';
  const filename = rawUrl === '/' ? 'session-report.html' : decodeURIComponent(rawUrl.slice(1));
  const filepath = path.join(root, filename);

  // Safety: prevent path traversal
  if (!filepath.startsWith(root + path.sep) && filepath !== root) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filepath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<pre>Not found: ${filename}\n\nAvailable files:\n${
      fs.readdirSync(root).join('\n')
    }</pre>`);
    return;
  }

  const ext = path.extname(filepath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  fs.createReadStream(filepath).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  const lan = getLanIp();
  console.log('\nSession report server running:');
  console.log(`  Local: http://localhost:${port}/`);
  console.log(`  LAN:   http://${lan}:${port}/`);
  console.log(`\nDirectory: ${root}`);
  console.log('\nOther files in this directory:');
  fs.readdirSync(root)
    .filter(f => ['.html', '.pdf', '.md', '.json'].includes(path.extname(f)))
    .forEach(f => console.log(`  http://${lan}:${port}/${encodeURIComponent(f)}`));
  console.log('\nPress Ctrl+C to stop.\n');
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Try a different port: npx tsx scripts/serve-session-report.ts [dir] ${port + 1}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
