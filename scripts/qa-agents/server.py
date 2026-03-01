"""
Tiny HTTP trigger server for n8n integration.
Listens on port 8765.

Endpoints:
  POST /run     — triggers run.py in a subprocess; returns 409 if already running
  GET  /status  — returns current run state (idle / running / done)
"""
import datetime
import json
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

_run_state: dict = {'status': 'idle', 'run_id': None}
_lock = threading.Lock()

AGENTS_DIR = Path(__file__).parent


def handle_run() -> tuple[int, dict]:
    with _lock:
        if _run_state['status'] == 'running':
            return 409, {'error': 'Run already in progress', 'run_id': _run_state['run_id']}

        run_id = datetime.datetime.now().strftime('%Y-%m-%dT%H%M')
        _run_state['status'] = 'running'
        _run_state['run_id'] = run_id

    def _spawn():
        try:
            subprocess.run(
                [sys.executable, str(AGENTS_DIR / 'run.py')],
                cwd=str(AGENTS_DIR),
                check=False,
            )
        finally:
            with _lock:
                _run_state['status'] = 'done'

    threading.Thread(target=_spawn, daemon=True).start()
    return 200, {'status': 'started', 'run_id': run_id}


def handle_status() -> dict:
    with _lock:
        return dict(_run_state)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'[server] {format % args}')

    def send_json(self, code: int, body: dict):
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        if self.path == '/run':
            code, body = handle_run()
            self.send_json(code, body)
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_GET(self):
        if self.path == '/status':
            self.send_json(200, handle_status())
        else:
            self.send_json(404, {'error': 'Not found'})


if __name__ == '__main__':
    port = 8765
    httpd = HTTPServer(('0.0.0.0', port), Handler)
    print(f'[server] Listening on port {port}')
    httpd.serve_forever()
