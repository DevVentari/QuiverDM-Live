from unittest.mock import patch, MagicMock
from smoke_gate import run_smoke_gate, SmokeResult


def test_smoke_gate_all_pass():
    mock_output = '{"stats":{"expected":5,"unexpected":0,"flaky":0,"skipped":0},"suites":[],"errors":[]}'
    with patch('smoke_gate.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=mock_output, stderr='')
        result = run_smoke_gate()
    assert result.passed == 5
    assert result.failed == 0
    assert result.failures == []
    assert result.ok is True


def test_smoke_gate_one_fail():
    mock_output = '''{
      "stats":{"expected":5,"unexpected":1,"flaky":0,"skipped":0},
      "suites":[{"specs":[{"ok":false,"title":"sign-in test","tests":[{"results":[{"status":"failed","error":{"message":"Timeout"}}]}]}]}],
      "errors":[]
    }'''
    with patch('smoke_gate.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout=mock_output, stderr='')
        result = run_smoke_gate()
    assert result.passed == 4
    assert result.failed == 1
    assert result.ok is False
    assert 'sign-in test' in result.failures[0]['title']
    assert 'Timeout' in result.failures[0]['error']


def test_smoke_gate_json_crash():
    """Playwright crashes before emitting JSON — returns a sensible failure."""
    with patch('smoke_gate.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout='', stderr='FATAL: cannot find chromium')
        result = run_smoke_gate()
    assert result.failed == 1
    assert result.ok is False
    assert result.failures[0]['title'] == 'playwright-crash'
