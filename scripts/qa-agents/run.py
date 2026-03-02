"""
QA Agent Orchestrator
Pipeline: Playwright smoke gate → Claude subagents (one per persona) → report → notify.

Usage:
  uv run python run.py [--tier basic|deep|extended|all] [--quiet]

  --tier basic     Run BASIC_PERSONAS only (default): Nora, Dana, Vic
  --tier deep      Run DEEP_PERSONAS only: Sam, Beth, Holly, Pete, Carl
  --tier extended  Run EXTENDED_PERSONAS only: Penny, Dave, Paul, Eddie, Mike
  --tier all       Run ALL_PERSONAS (13 total)
  --quiet          Skip Discord/GitHub notifications (used by overnight orchestrator)
"""
import argparse
import importlib
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / '.env.local'
load_dotenv(env_path)

from claude_agent import run_claude_agent
from notifier import post_run
from personas import ALL_PERSONAS, BASIC_PERSONAS, DEEP_PERSONAS, EXTENDED_PERSONAS, PERSONAS
from reporter import AgentResult, write_report
from smoke_gate import run_smoke_gate

_TIER_MAP = {
    'basic': BASIC_PERSONAS,
    'deep': DEEP_PERSONAS,
    'extended': EXTENDED_PERSONAS,
    'all': ALL_PERSONAS,
}


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
    parser = argparse.ArgumentParser(description='QA Agent Orchestrator')
    parser.add_argument('--tier', choices=['basic', 'deep', 'extended', 'all'], default='basic',
                        help='Persona tier to run (default: basic)')
    parser.add_argument('--quiet', action='store_true',
                        help='Skip Discord/GitHub notifications (for overnight orchestrator)')
    args = parser.parse_args()

    active_personas = _TIER_MAP[args.tier]
    run_id = datetime.now().strftime('%Y-%m-%dT%H%M')
    reports_dir = Path(__file__).parent / 'reports'
    screenshot_dir = reports_dir / 'screenshots'

    # ── Stage 1: Playwright smoke gate ──────────────────────────────────────
    print(f'[run] Stage 1: Playwright smoke gate (tier={args.tier}, {len(active_personas)} personas)')
    smoke = run_smoke_gate(env_override={
        'QA_DANA_EMAIL': os.environ.get('QA_DANA_EMAIL', 'dana@test.local'),
        'QA_VIC_EMAIL': os.environ.get('QA_VIC_EMAIL', 'vic@test.local'),
        'QA_TEST_PASSWORD': os.environ.get('QA_TEST_PASSWORD', ''),
        'QA_APP_URL': os.environ.get('QA_APP_URL', 'https://quiverdm.com'),
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
        if not args.quiet:
            _write_and_notify(smoke_report, screenshot_dir)
        return

    # ── Stage 2: Claude agents ───────────────────────────────────────────────
    print(f'[run] Stage 2: Claude persona agents ({args.tier} tier)')
    tasks = [(persona, _load_task(persona)) for persona in active_personas]

    def run_one(a):
        persona, task = a
        return run_claude_agent(persona, task, run_id, screenshot_dir)

    # Run agents in parallel — each gets an isolated HOME so ~/.claude.json won't corrupt
    _MAX_CONCURRENT = 3
    _sem = threading.Semaphore(_MAX_CONCURRENT)

    def run_one_gated(a):
        with _sem:
            return run_one(a)

    print(f'[run] Running {len(tasks)} agents (max {_MAX_CONCURRENT} concurrent)')
    with ThreadPoolExecutor(max_workers=len(tasks)) as executor:
        futures = {executor.submit(run_one_gated, t): t for t in tasks}
        results: list[AgentResult] = [f.result() for f in as_completed(futures)]

    # ── Stage 3: Report + notify ─────────────────────────────────────────────
    report_path = write_report(results, reports_dir)
    report_data = json.loads(report_path.read_text())
    report_data['smoke_passed'] = True

    print(f'[run] Report written to {report_path}')
    if not args.quiet:
        _write_and_notify(report_data, screenshot_dir)
    else:
        print('[run] Quiet mode — skipping Discord/GitHub notifications')


if __name__ == '__main__':
    main()
