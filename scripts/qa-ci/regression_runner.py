"""
Continuous QA regression runner — runs on homelab 24/7.

Usage:
  uv run python regression_runner.py [--dry-run]

--dry-run: run one cycle, print results, skip Discord/GitHub/sleep.

Env vars (from EnvironmentFile /opt/quiverdm/.env.qa):
  BASE_URL, CI, TEST_USER_EMAIL, TEST_USER_PASSWORD
  QUIVERDM_DISCORD_BOT_TOKEN, QA_DISCORD_FORUM_CHANNEL_ID
"""
from __future__ import annotations

import argparse
import signal
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
STATE_FILE = Path(__file__).parent / 'scenario_state.json'
SLEEP_SECONDS = 180


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='QuiverDM QA Regression Runner')
    parser.add_argument('--dry-run', action='store_true',
                        help='Run one cycle, print results, skip Discord/GitHub/sleep')
    return parser.parse_args()


def git_pull() -> tuple[bool, bool, bool]:
    """
    Returns (success, packages_changed, schema_changed).
    Pull latest main, detect changed files.
    """
    proc = subprocess.run(
        ['git', 'pull', '--ff-only', 'origin', 'main'],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if proc.returncode != 0:
        print(f'[runner] git pull failed: {proc.stderr[:200]}')
        return False, False, False

    diff_proc = subprocess.run(
        ['git', 'diff', '--name-only', 'HEAD@{1}', 'HEAD'],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    changed = diff_proc.stdout if diff_proc.returncode == 0 else ''
    packages_changed = 'package-lock.json' in changed
    schema_changed = 'prisma/schema.prisma' in changed
    return True, packages_changed, schema_changed


def run_post_pull(packages_changed: bool, schema_changed: bool) -> None:
    if packages_changed:
        print('[runner] package-lock.json changed — running npm ci')
        subprocess.run(['npm', 'ci'], cwd=REPO_ROOT, capture_output=True)
    if schema_changed:
        print('[runner] schema.prisma changed — running prisma generate')
        subprocess.run(['npx', 'prisma', 'generate'], cwd=REPO_ROOT, capture_output=True)


def main() -> None:
    args = _parse_args()
    dry_run = args.dry_run

    from discord_notify import post_cycle_summary, post_error, post_state_change
    from github_issues import close_issue, create_exploratory_trigger_issue, create_failure_issue
    from playwright_runner import run_spec
    from scenario_state import StateManager

    state = StateManager(STATE_FILE)
    state.load()

    def handle_shutdown(signum: int, frame: object) -> None:
        print('[runner] Shutdown signal received — saving state')
        state.save()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_shutdown)

    print(f'[runner] Starting. target={state.target}, completions={state.total_completions}')

    while True:
        try:
            _run_cycle(state, dry_run, post_state_change, post_error, post_cycle_summary,
                       create_failure_issue, close_issue, create_exploratory_trigger_issue,
                       run_spec)
        except KeyboardInterrupt:
            print('[runner] Interrupted — saving state')
            state.save()
            break
        except Exception as e:
            print(f'[runner] Unhandled error: {e}')
            if not dry_run:
                post_error(f'Runner crash: {e}')
            state.save()

        if dry_run:
            print('[runner] Dry run complete')
            break

        time.sleep(SLEEP_SECONDS)


def _run_cycle(state, dry_run, post_state_change, post_error, post_cycle_summary,
               create_failure_issue, close_issue, create_exploratory_trigger_issue,
               run_spec):
    from scenario_state import StateManager

    if state.target_reached():
        print(f'[runner] Target reached: {state.total_completions}/{state.target} completions')
        sys.exit(0)

    # Git pull
    if not dry_run:
        success, pkgs, schema = git_pull()
        if not success:
            if not dry_run:
                post_error('git pull --ff-only failed — skipping cycle')
            return
        run_post_pull(pkgs, schema)

    cycle = state.cycle_count + 1
    print(f'[runner] Cycle {cycle} starting')

    runnable = state.runnable_scenarios()
    print(f'[runner] Running {len(runnable)} scenarios')

    completions = 0
    for scenario_id, scenario_state in runnable:
        spec_file = scenario_state.spec_file
        print(f'[runner]   {scenario_id}: running {spec_file}')
        result = run_spec(scenario_id, spec_file)
        completions += 1

        if result.passed:
            was_retrying = scenario_state.status == 'retrying'
            scenario_state.record_pass()
            print(f'[runner]   {scenario_id}: PASS')
            if was_retrying:
                issue_num = scenario_state.github_issue_number
                state.resume_from_issue(scenario_id)
                if not dry_run and issue_num:
                    close_issue(issue_num, f'{scenario_id} recovered after retry — closing.')
                    post_state_change(scenario_id, 'RECOVERED')
                print(f'[runner]   {scenario_id}: RECOVERED')
        else:
            print(f'[runner]   {scenario_id}: FAIL — {(result.error or "")[:100]}')
            newly_paused = scenario_state.record_fail(result.error or 'unknown error')
            if newly_paused:
                if not dry_run:
                    issue_num = create_failure_issue(scenario_id, spec_file, cycle, result.error)
                    state.pause_with_dependents(scenario_id, issue_num)
                    post_state_change(scenario_id, 'PAUSED', (result.error or '')[:200])
                else:
                    state.pause_with_dependents(scenario_id, None)
                print(f'[runner]   {scenario_id}: PAUSED (issue created)')

    # Tick paused scenarios
    for scenario_id, scenario_state in state.all_scenarios().items():
        if scenario_state.status == 'paused':
            switched = scenario_state.tick_pause()
            if switched:
                if not dry_run:
                    post_state_change(scenario_id, 'RETRYING')
                print(f'[runner]   {scenario_id}: -> RETRYING')

    state.increment_completions(completions)
    state.increment_cycle()
    state.save()

    active_count = sum(1 for s in state.all_scenarios().values() if s.status == 'active')
    paused_ids = [sid for sid, s in state.all_scenarios().items() if s.status == 'paused']
    total = len(state.all_scenarios())

    print(f'[runner] Cycle {cycle} done | {state.total_completions}/{state.target} completions | {active_count}/{total} active | {len(paused_ids)} paused')

    # Discord summary every 5 cycles
    if not dry_run and state.cycle_count % 5 == 0:
        post_cycle_summary(state.cycle_count, state.total_completions, state.target,
                           active_count, total, paused_ids)

    # Exploratory trigger every 10th cycle
    if not dry_run and state.cycle_count % 10 == 0:
        create_exploratory_trigger_issue(state.cycle_count)


if __name__ == '__main__':
    main()
