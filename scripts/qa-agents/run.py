"""
QA Agent Orchestrator
Pipeline: Playwright smoke gate → Claude subagents (one per persona) → report → notify.

Usage:
  uv run python run.py
"""
import importlib
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

from claude_agent import run_claude_agent
from notifier import post_run
from personas import PERSONAS
from reporter import AgentResult, write_report
from smoke_gate import run_smoke_gate


def _load_task(persona) -> str:
    scenario_mod = importlib.import_module(f'scenarios.{persona.scenario}')
    return scenario_mod.TASK.format(
        app_url=os.environ.get('QA_APP_URL', 'http://localhost:3847'),
        email=os.environ[persona.email_env],
        password=os.environ['QA_TEST_PASSWORD'],
    )


def _write_and_notify(report: dict, screenshot_dir: Path) -> None:
    try:
        post_run(report, screenshot_dir)
    except Exception as e:
        print(f'[run] Notify failed: {e}')


def main():
    run_id = datetime.now().strftime('%Y-%m-%dT%H%M')
    reports_dir = Path(__file__).parent / 'reports'
    screenshot_dir = reports_dir / 'screenshots'

    # ── Stage 1: Playwright smoke gate ──────────────────────────────────────
    print('[run] Stage 1: Playwright smoke gate')
    smoke = run_smoke_gate(env_override={
        'QA_DANA_EMAIL': os.environ.get('QA_DANA_EMAIL', 'dana@test.local'),
        'QA_VIC_EMAIL': os.environ.get('QA_VIC_EMAIL', 'vic@test.local'),
        'QA_TEST_PASSWORD': os.environ.get('QA_TEST_PASSWORD', ''),
        'QA_APP_URL': os.environ.get('QA_APP_URL', 'http://localhost:3847'),
    })

    print(f'[run] Smoke: {smoke.passed} passed, {smoke.failed} failed')

    if not smoke.ok:
        print('[run] Smoke gate failed — skipping agents, posting alert')
        smoke_report = {
            'run_id': run_id,
            'duration_seconds': 0,
            'smoke_passed': False,
            'smoke_failures': smoke.failures,
            'agents': [],
        }
        _write_and_notify(smoke_report, screenshot_dir)
        return

    # ── Stage 2: Claude agents (parallel) ───────────────────────────────────
    print('[run] Stage 2: Claude persona agents')
    tasks = [(persona, _load_task(persona)) for persona in PERSONAS]

    def run_one(args):
        persona, task = args
        return run_claude_agent(persona, task, run_id, screenshot_dir)

    with ThreadPoolExecutor(max_workers=len(PERSONAS)) as pool:
        results: list[AgentResult] = list(pool.map(run_one, tasks))

    # ── Stage 3: Report + notify ─────────────────────────────────────────────
    report_path = write_report(results, reports_dir)
    report_data = json.loads(report_path.read_text())
    report_data['smoke_passed'] = True

    print(f'[run] Report written to {report_path}')
    _write_and_notify(report_data, screenshot_dir)


if __name__ == '__main__':
    main()
