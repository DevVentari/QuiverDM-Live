"""Run a single Playwright spec file and return structured result."""
from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent


@dataclass
class SpecResult:
    spec_id: str
    passed: bool
    error: str | None
    duration_ms: int


def run_spec(spec_id: str, spec_file: str) -> SpecResult:
    env = {**os.environ, 'CI': 'true'}
    try:
        proc = subprocess.run(
            ['npx', 'playwright', 'test', spec_file, '--reporter=json', '--workers=1'],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        return SpecResult(spec_id=spec_id, passed=False, error='Playwright timed out after 300s', duration_ms=300000)

    stdout = proc.stdout.strip()
    if not stdout:
        error = (proc.stderr or 'No output').strip()[:500]
        return SpecResult(spec_id=spec_id, passed=False, error=error, duration_ms=0)

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        error = (proc.stderr or stdout)[:500]
        return SpecResult(spec_id=spec_id, passed=False, error=error, duration_ms=0)

    stats = data.get('stats', {})
    unexpected = stats.get('unexpected', 1)
    duration_ms = int(stats.get('duration', 0))
    passed = unexpected == 0 and proc.returncode == 0

    error: str | None = None
    if not passed:
        errors = data.get('errors', [])
        if errors:
            error = str(errors[0].get('message', ''))[:500]
        else:
            for suite in data.get('suites', []):
                for test in suite.get('tests', []):
                    for result in test.get('results', []):
                        if result.get('status') in ('failed', 'timedOut'):
                            msg = result.get('error', {}).get('message', '')
                            if msg:
                                error = str(msg)[:500]
                                break
                    if error:
                        break
                if error:
                    break
        if not error:
            error = (proc.stderr or 'Test failed').strip()[:500]

    return SpecResult(spec_id=spec_id, passed=passed, error=error, duration_ms=duration_ms)
