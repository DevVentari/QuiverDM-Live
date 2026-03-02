import json
from unittest.mock import patch, MagicMock
from reporter import AgentResult
from notifier import build_run_summary, build_failure_detail, check_issue_exists


def _make_result(outcome, persona='Dana', findings='ok', screenshot_path=None, urls_visited=None):
    return AgentResult(
        persona=persona, scenario='upload_pdf', outcome=outcome,
        friction_points=0, feedback_ids=[], error=None, duration_seconds=55.0,
        findings=findings, urls_visited=urls_visited or [], screenshot_path=screenshot_path,
    )


def test_build_run_summary_all_pass():
    results = [_make_result('success', 'Dana'), _make_result('success', 'Vic')]
    summary = build_run_summary('2026-03-02T1038', results, smoke_passed=True)
    assert '2026-03-02T1038' in summary
    assert '🟢' in summary
    assert 'Dana' in summary
    assert 'Vic' in summary


def test_build_run_summary_with_failure():
    results = [_make_result('success', 'Dana'), _make_result('failed', 'Nora')]
    summary = build_run_summary('2026-03-02T1038', results, smoke_passed=True)
    assert '🔴' in summary
    assert 'Nora' in summary


def test_build_run_summary_smoke_failed():
    summary = build_run_summary('2026-03-02T1038', [], smoke_passed=False)
    assert 'smoke' in summary.lower() or 'Playwright' in summary


def test_build_failure_detail_includes_findings():
    result = _make_result('failed', findings='TypeError in campaign.ts:47')
    detail = build_failure_detail(result)
    assert 'TypeError in campaign.ts:47' in detail


def test_build_failure_detail_includes_urls():
    result = _make_result('failed', urls_visited=['http://localhost:3847/auth/signin'])
    detail = build_failure_detail(result)
    assert 'http://localhost:3847/auth/signin' in detail


def test_check_issue_exists_true():
    issues = json.dumps([{'title': '[QA] Nora — create_campaign failed', 'number': 1, 'state': 'OPEN'}])
    with patch('notifier.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=issues)
        assert check_issue_exists('[QA] Nora — create_campaign failed') is True


def test_check_issue_exists_false():
    with patch('notifier.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout='[]')
        assert check_issue_exists('[QA] Nora — create_campaign failed') is False


def test_check_issue_exists_gh_error():
    with patch('notifier.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout='')
        assert check_issue_exists('[QA] Nora — create_campaign failed') is False
