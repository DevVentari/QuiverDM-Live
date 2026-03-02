"""
Autonomous QA orchestrator — runs on host PC.

Architecture:
  - LXC 402 (192.168.1.102): regression_runner.py runs 24/7 (systemd)
  - Host PC: this script manages fix_dispatcher + QA agent runs
  - Discord: single thread with periodic update messages (not per-failure spam)

Usage:
  cd scripts/qa-ci
  python overnight.py [options]

Options:
  --dry-run               Mock all external calls (for testing)
  --duration SECS         Fixed run duration (default 21600 = 6h). Ignored if --until-clean set.
  --until-clean N         Run perpetually until N consecutive all-pass agent cycles. No time limit.
  --fix-dispatcher-pid P  PID of already-running fix_dispatcher (skip launch)

Examples:
  python overnight.py                        # 6-hour fixed run
  python overnight.py --until-clean 3        # run until 3 clean cycles in a row
  python overnight.py --dry-run --duration 60  # 60-second smoke test
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
QA_AGENTS_DIR = REPO_ROOT / 'scripts' / 'qa-agents'

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from discord_dashboard import Dashboard

# ── Constants ────────────────────────────────────────────────────────────────
TOTAL_DURATION = 6 * 3600       # 6 hours
DASHBOARD_INTERVAL = 900        # Update Discord every 15 min
AGENT_INTERVAL = 1800           # Run agents every 30 min
DEEP_THRESHOLD = 0.80           # 80% spec pass rate → unlock deep scenarios
FULL_THRESHOLD = 0.95           # 95% → run all scenarios
ESCALATION_LIMIT = 2            # 2 failed fix attempts → escalate
LXC_HOST = 'root@192.168.1.102'
LXC_STATE_PATH = '/opt/quiverdm/scripts/qa-ci/scenario_state.json'


# ── LXC helpers ──────────────────────────────────────────────────────────────

def _lxc_is_reachable(dry_run: bool, local: bool = False) -> bool:
    if dry_run:
        print('[overnight] DRY RUN: LXC reachability check skipped')
        return True
    if local:
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', 'qa-regression'],
                capture_output=True, text=True, timeout=5, stdin=subprocess.DEVNULL,
            )
            return result.stdout.strip() == 'active'
        except Exception as e:
            print(f'[overnight] Local systemctl check failed: {e}')
            return Path(LXC_STATE_PATH).exists()
    try:
        result = subprocess.run(
            ['ssh', '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes',
             LXC_HOST, 'systemctl', 'is-active', 'qa-regression'],
            capture_output=True, text=True, timeout=10, stdin=subprocess.DEVNULL,
        )
        active = result.stdout.strip() == 'active'
        if not active:
            print(f'[overnight] LXC qa-regression status: {result.stdout.strip() or "unreachable"}')
        return active
    except Exception as e:
        print(f'[overnight] LXC unreachable: {e}')
        return False


def _read_lxc_state(dry_run: bool, local: bool = False) -> dict:
    if dry_run:
        return {'_dry_run': True}
    if local:
        try:
            return json.loads(Path(LXC_STATE_PATH).read_text())
        except Exception as e:
            print(f'[overnight] Failed to read local state: {e}')
            return {}
    try:
        result = subprocess.run(
            ['ssh', '-o', 'ConnectTimeout=5', '-o', 'BatchMode=yes',
             LXC_HOST, 'cat', LXC_STATE_PATH],
            capture_output=True, text=True, timeout=15, stdin=subprocess.DEVNULL,
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        print(f'[overnight] Failed to read LXC state: {e}')
    return {}


def _calc_pass_rate(state: dict) -> tuple[int, int]:
    """Return (passing, total) from scenario_state.json."""
    if not state or '_dry_run' in state:
        return 0, 0
    scenarios = state.get('scenarios', state)
    if not isinstance(scenarios, dict):
        return 0, 0
    total = len(scenarios)
    passing = sum(
        1 for v in scenarios.values()
        if isinstance(v, dict) and v.get('status') == 'active'
    )
    return passing, total


# ── Agent run helpers ─────────────────────────────────────────────────────────

def _run_agents(tier: str, dry_run: bool) -> dict:
    """Run QA agents for given tier. Returns dict with passing/total counts."""
    if dry_run:
        print(f'[overnight] DRY RUN: would run agents --tier {tier}')
        return {'passing': 2, 'total': 3, 'results': []}

    print(f'[overnight] Running QA agents (tier={tier})')
    env = {**os.environ}
    result = subprocess.run(
        ['uv', 'run', 'python', 'run.py', '--tier', tier],
        cwd=str(QA_AGENTS_DIR),
        capture_output=False,
        text=True,
        timeout=3600,
        stdin=subprocess.DEVNULL,
        env=env,
    )
    if result.returncode != 0:
        print(f'[overnight] Agent run exited with code {result.returncode}')

    # Read latest report
    reports_dir = QA_AGENTS_DIR / 'reports'
    latest = reports_dir / 'latest.json'
    if latest.exists():
        try:
            data = json.loads(latest.read_text())
            agents = data.get('agents', [])
            passing = sum(1 for a in agents if a.get('outcome') == 'success')
            return {'passing': passing, 'total': len(agents), 'results': agents}
        except Exception as e:
            print(f'[overnight] Failed to parse agent report: {e}')
    return {'passing': 0, 'total': 0, 'results': []}


# ── Fix dispatcher helpers ────────────────────────────────────────────────────

def _start_fix_dispatcher(dry_run: bool) -> subprocess.Popen | None:
    if dry_run:
        print('[overnight] DRY RUN: fix_dispatcher not started')
        return None
    print('[overnight] Starting fix_dispatcher --no-idle-check --once-per-issue')
    try:
        proc = subprocess.Popen(
            ['uv', 'run', 'python', 'fix_dispatcher.py',
             '--no-idle-check', '--once-per-issue'],
            cwd=str(SCRIPT_DIR),
            stdin=subprocess.DEVNULL,
        )
        return proc
    except Exception as e:
        print(f'[overnight] Failed to start fix_dispatcher: {e}')
        return None


def _ensure_fix_dispatcher(proc: subprocess.Popen | None, dry_run: bool) -> subprocess.Popen | None:
    if dry_run or proc is None:
        return proc
    if proc.poll() is not None:
        print('[overnight] fix_dispatcher exited — restarting')
        return _start_fix_dispatcher(dry_run)
    return proc


# ── GitHub issue helpers ──────────────────────────────────────────────────────

def _get_open_issues(dry_run: bool) -> list[dict]:
    if dry_run:
        return []
    try:
        result = subprocess.run(
            ['gh', 'issue', 'list', '--repo', 'DevVentari/QuiverDM-Live',
             '--label', 'qa-failure', '--state', 'open',
             '--json', 'number,title,url,comments,body', '--limit', '50'],
            capture_output=True, text=True, timeout=30, stdin=subprocess.DEVNULL,
        )
        if result.returncode == 0:
            return json.loads(result.stdout) or []
    except Exception as e:
        print(f'[overnight] Failed to list GH issues: {e}')
    return []


def _count_fix_attempts(issue: dict) -> int:
    """Count how many fix PRs have been commented on an issue."""
    body = issue.get('body', '') or ''
    comments_count = issue.get('comments', 0)
    fix_mentions = body.lower().count('fix pr') + body.lower().count('fix attempt')
    return fix_mentions + max(0, comments_count - 1)


# ── Stats builder ─────────────────────────────────────────────────────────────

def _build_stats(
    specs_pass: int,
    specs_total: int,
    issues_found: int,
    issues_fixed: int,
    issues_escalated: int,
    agents_pass: int,
    agents_total: int,
) -> dict:
    return {
        'specs_passing': specs_pass,
        'specs_total': specs_total,
        'issues_found': issues_found,
        'issues_fixed': issues_fixed,
        'issues_escalated': issues_escalated,
        'agents_passing': agents_pass,
        'agents_total': agents_total,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def _loop_should_continue(
    run_start: float,
    total_duration: int,
    until_clean: int | None,
    consecutive_clean: int,
) -> bool:
    """Return True if the main loop should keep running."""
    if until_clean is not None:
        return consecutive_clean < until_clean
    return time.time() < run_start + total_duration - 1800


def main() -> None:
    parser = argparse.ArgumentParser(description='Autonomous QA orchestrator')
    parser.add_argument('--dry-run', action='store_true', help='Mock all external calls')
    parser.add_argument('--duration', type=int, default=TOTAL_DURATION, help='Fixed run duration in seconds')
    parser.add_argument('--until-clean', type=int, default=None, metavar='N',
                        help='Run until N consecutive all-pass agent cycles (no time limit)')
    parser.add_argument('--fix-dispatcher-pid', type=int, default=None,
                        help='PID of already-running fix_dispatcher (skip launch)')
    parser.add_argument('--local', action='store_true',
                        help='Read regression state locally (use when running on LXC 402)')
    args = parser.parse_args()

    run_start = time.time()
    total_duration = args.duration
    until_clean: int | None = args.until_clean
    local: bool = args.local

    if until_clean is not None:
        print(f'[overnight] Mode: until-clean (N={until_clean}) — no time limit')

    dashboard = Dashboard()

    # ── Phase 1: Setup ────────────────────────────────────────────────────────
    print('[overnight] === Phase 1: Setup ===')

    lxc_ok = _lxc_is_reachable(args.dry_run, local)
    if not lxc_ok:
        print('[overnight] WARNING: LXC 402 unreachable — will skip regression state checks')

    fix_proc: subprocess.Popen | None = None
    if args.fix_dispatcher_pid:
        print(f'[overnight] Using existing fix_dispatcher PID {args.fix_dispatcher_pid}')
    else:
        fix_proc = _start_fix_dispatcher(args.dry_run)

    run_date = datetime.now().strftime('%Y-%m-%d %H:%M AEDT')
    thread_title = f'Overnight QA — {run_date}'
    dashboard.create_thread(thread_title)
    dashboard.post_phase_change('Phase 1 complete — setup done', f'LXC: {"OK" if lxc_ok else "unreachable"} | fix_dispatcher: {"running" if (fix_proc or args.fix_dispatcher_pid) else "not started"}')

    # ── Phase 2: Baseline ─────────────────────────────────────────────────────
    print('[overnight] === Phase 2: Baseline ===')
    dashboard.post_phase_change('Phase 2 — running baseline agents')

    agent_result = _run_agents('basic', args.dry_run)
    agents_pass = agent_result['passing']
    agents_total = agent_result['total']
    print(f'[overnight] Baseline agents: {agents_pass}/{agents_total} passing')

    lxc_state = _read_lxc_state(args.dry_run, local) if lxc_ok else {}
    specs_pass, specs_total = _calc_pass_rate(lxc_state)

    issues = _get_open_issues(args.dry_run)
    issues_found = len(issues)
    issues_fixed = 0
    issues_escalated = 0
    escalated_set: set[int] = set()
    pass_rate_history: list[float] = []

    start_pass_rate = specs_pass / specs_total if specs_total else 0.0
    pass_rate_history.append(start_pass_rate)

    print(f'[overnight] Baseline: specs {specs_pass}/{specs_total} ({start_pass_rate:.0%}), '
          f'issues open: {issues_found}')

    if start_pass_rate >= FULL_THRESHOLD:
        print('[overnight] All specs already passing — will go straight to deep testing')
        dashboard.post_phase_change(
            'All specs passing at baseline!',
            f'{specs_pass}/{specs_total} ({start_pass_rate:.0%}) — skipping fix loop, running deep tests'
        )

    stats = _build_stats(specs_pass, specs_total, issues_found, 0, 0, agents_pass, agents_total)
    dashboard.post_update(stats)

    # ── Phase 3: Fix-Test Loop ────────────────────────────────────────────────
    print('[overnight] === Phase 3: Fix-Test Loop ===')
    deep_unlocked = start_pass_rate >= DEEP_THRESHOLD
    if deep_unlocked:
        dashboard.post_phase_change('DEEP TESTING UNLOCKED', f'Pass rate {start_pass_rate:.0%} >= {DEEP_THRESHOLD:.0%}')

    last_dashboard_update = time.time()
    last_agent_run = time.time()
    current_tier = 'deep' if deep_unlocked else 'basic'
    consecutive_clean = 0  # for --until-clean mode

    while _loop_should_continue(run_start, total_duration, until_clean, consecutive_clean):
        now = time.time()
        fix_proc = _ensure_fix_dispatcher(fix_proc, args.dry_run)

        # Dashboard update
        if now - last_dashboard_update >= DASHBOARD_INTERVAL:
            if lxc_ok:
                lxc_state = _read_lxc_state(args.dry_run, local)
                specs_pass, specs_total = _calc_pass_rate(lxc_state)

            issues = _get_open_issues(args.dry_run)

            # Check for escalations
            for issue in issues:
                num = issue.get('number')
                if num and num not in escalated_set:
                    attempts = _count_fix_attempts(issue)
                    if attempts >= ESCALATION_LIMIT:
                        escalated_set.add(num)
                        issues_escalated += 1
                        dashboard.post_escalation(
                            issue.get('title', 'Unknown'),
                            issue.get('url', ''),
                            f'Fix attempts: {attempts}',
                        )

            current_rate = specs_pass / specs_total if specs_total else 0.0
            pass_rate_history.append(current_rate)

            if not deep_unlocked and current_rate >= DEEP_THRESHOLD:
                deep_unlocked = True
                current_tier = 'deep'
                dashboard.post_phase_change(
                    'DEEP TESTING UNLOCKED',
                    f'Pass rate reached {current_rate:.0%}'
                )

            if current_rate >= FULL_THRESHOLD:
                current_tier = 'all'

            prev_open = issues_found
            issues_found = len(issues)
            if issues_found < prev_open:
                issues_fixed += prev_open - issues_found

            stats = _build_stats(specs_pass, specs_total, issues_found, issues_fixed,
                                  issues_escalated, agents_pass, agents_total)
            dashboard.post_update(stats)
            last_dashboard_update = now

        # Agent run
        if now - last_agent_run >= AGENT_INTERVAL:
            agent_result = _run_agents(current_tier, args.dry_run)
            agents_pass = agent_result['passing']
            agents_total = agent_result['total']
            last_agent_run = now

            # --until-clean: track consecutive all-pass cycles
            if until_clean is not None:
                cycle_issues = _get_open_issues(args.dry_run)
                is_clean = (agents_pass == agents_total and len(cycle_issues) == 0)
                if is_clean:
                    consecutive_clean += 1
                    print(f'[overnight] Clean cycle {consecutive_clean}/{until_clean}')
                    dashboard.post_phase_change(
                        f'Clean cycle {consecutive_clean}/{until_clean}',
                        f'All {agents_total} agents passing, 0 open issues'
                    )
                else:
                    if consecutive_clean > 0:
                        print(f'[overnight] Clean streak broken (was {consecutive_clean}) — resetting')
                    consecutive_clean = 0

        time.sleep(30)

    if until_clean is not None and consecutive_clean >= until_clean:
        print(f'[overnight] Until-clean target reached ({until_clean} consecutive clean cycles) — stopping')
        dashboard.post_phase_change(
            f'DONE — {until_clean} consecutive clean cycles achieved',
            'All agents passing, no open issues. Orchestrator stopping.'
        )

    # ── Phase 4: Final Assessment ─────────────────────────────────────────────
    print('[overnight] === Phase 4: Final Assessment ===')
    dashboard.post_phase_change('Phase 4 — Final assessment')

    final_agent_result = _run_agents('all', args.dry_run)
    agents_pass = final_agent_result['passing']
    agents_total = final_agent_result['total']

    if lxc_ok:
        lxc_state = _read_lxc_state(args.dry_run, local)
        specs_pass, specs_total = _calc_pass_rate(lxc_state)

    final_issues = _get_open_issues(args.dry_run)
    issues_found = len(final_issues)

    # ── Phase 5: Summary ──────────────────────────────────────────────────────
    print('[overnight] === Phase 5: Summary ===')

    end_pass_rate = specs_pass / specs_total if specs_total else 0.0
    pass_rate_history.append(end_pass_rate)

    deep_results = f'{agents_pass}/{agents_total} passing' if agents_total else 'n/a'

    final_report = {
        'start_pass_rate': start_pass_rate,
        'end_pass_rate': end_pass_rate,
        'specs_passing': specs_pass,
        'specs_total': specs_total,
        'issues_found': issues_found,
        'issues_fixed': issues_fixed,
        'issues_escalated': issues_escalated,
        'deep_results': deep_results,
        'open_issues': [i.get('title', '') for i in final_issues[:10]],
    }
    dashboard.post_final_summary(final_report)

    print(f'[overnight] Run complete. Pass rate: {start_pass_rate:.0%} -> {end_pass_rate:.0%}')
    print(f'[overnight] Fixed: {issues_fixed} | Escalated: {issues_escalated} | Open: {issues_found}')

    # Cleanup
    if fix_proc and fix_proc.poll() is None:
        print('[overnight] Stopping fix_dispatcher')
        fix_proc.terminate()


if __name__ == '__main__':
    main()
