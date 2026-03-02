import json
from pathlib import Path
import tempfile
from unittest.mock import patch, MagicMock

from personas import PERSONAS
from claude_agent import run_claude_agent, build_agent_prompt


def test_build_agent_prompt_contains_key_parts():
    persona = PERSONAS[0]  # Nora
    task = 'Go to http://localhost:3847 and create a campaign'
    screenshot_path = '/tmp/run-nora.png'
    prompt = build_agent_prompt(persona, task, screenshot_path)
    assert 'browser_navigate' in prompt
    assert 'browser_snapshot' in prompt
    assert screenshot_path in prompt
    assert '"outcome"' in prompt
    assert persona.message_context in prompt


def test_run_claude_agent_success():
    inner = json.dumps({
        'outcome': 'success',
        'findings': 'Campaign created.',
        'friction_points': 0,
        'urls_visited': ['http://localhost:3847/dashboard'],
    })
    outer = json.dumps({'result': inner})
    with patch('claude_agent.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=outer, stderr='')
        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    assert result.outcome == 'success'
    assert result.findings == 'Campaign created.'
    assert result.urls_visited == ['http://localhost:3847/dashboard']
    assert result.friction_points == 0
    assert result.error is None


def test_run_claude_agent_subprocess_error():
    with patch('claude_agent.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout='', stderr='claude: command not found')
        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    assert result.outcome == 'failed'
    assert result.error is not None
    assert 'claude' in result.error.lower()


def test_run_claude_agent_invalid_json_fallback():
    outer = json.dumps({'result': 'I could not parse this as JSON, sorry.'})
    with patch('claude_agent.subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout=outer, stderr='')
        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    assert result.outcome == 'failed'
    assert result.error is None  # error is in findings, not error field


def test_run_claude_agent_strips_session_env_vars():
    """Claude Code session vars must not be passed to the subprocess."""
    inner = json.dumps({'outcome': 'success', 'findings': '', 'friction_points': 0, 'urls_visited': []})
    outer = json.dumps({'result': inner})
    import os
    fake_env = {**os.environ, 'CLAUDECODE': '1', 'CLAUDE_CODE_ENTRYPOINT': 'x', 'CLAUDE_CODE_SESSION_ACCESS_TOKEN': 'secret'}
    with patch('claude_agent.subprocess.run') as mock_run, \
         patch.dict('os.environ', fake_env):
        mock_run.return_value = MagicMock(returncode=0, stdout=outer, stderr='')
        with tempfile.TemporaryDirectory() as tmpdir:
            run_claude_agent(PERSONAS[0], 'test task', 'run123', Path(tmpdir))
    called_env = mock_run.call_args.kwargs.get('env') or mock_run.call_args[1].get('env')
    assert 'CLAUDECODE' not in called_env
    assert 'CLAUDE_CODE_SESSION_ACCESS_TOKEN' not in called_env
