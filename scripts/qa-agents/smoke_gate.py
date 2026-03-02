import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent


@dataclass
class SmokeResult:
    passed: int
    failed: int
    failures: list[dict] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.failed == 0


def _collect_failures(suites: list) -> list[dict]:
    """Recursively walk Playwright JSON suite tree to collect failed specs."""
    failures = []
    for suite in suites:
        for spec in suite.get('specs', []):
            if not spec.get('ok', True):
                error_msg = ''
                for test in spec.get('tests', []):
                    for r in test.get('results', []):
                        if r.get('status') == 'failed':
                            error_msg = (r.get('error') or {}).get('message', '')[:300]
                failures.append({'title': spec.get('title', ''), 'error': error_msg})
        failures.extend(_collect_failures(suite.get('suites', [])))
    return failures


def run_smoke_gate(env_override: dict | None = None) -> SmokeResult:
    """Run tests/smoke.spec.ts via npx playwright. Returns structured result."""
    env = {**os.environ, **(env_override or {})}
    result = subprocess.run(
        ['npx', 'playwright', 'test', 'tests/smoke.spec.ts', '--reporter=json'],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
        env=env,
    )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return SmokeResult(
            passed=0,
            failed=1,
            failures=[{'title': 'playwright-crash', 'error': result.stderr[:500]}],
        )

    stats = data.get('stats', {})
    passed = stats.get('expected', 0) - stats.get('unexpected', 0)
    failed = stats.get('unexpected', 0)

    failures = _collect_failures(data.get('suites', []))

    return SmokeResult(passed=max(passed, 0), failed=failed, failures=failures)
