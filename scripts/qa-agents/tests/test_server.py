import pytest
from unittest.mock import patch


def test_handle_status_returns_idle():
    import server
    with patch.object(server, '_run_state', {'status': 'idle', 'run_id': None}):
        result = server.handle_status()
        assert result['status'] == 'idle'
        assert result['run_id'] is None


def test_handle_run_rejects_when_running():
    import server
    with patch.object(server, '_run_state', {'status': 'running', 'run_id': 'test-123'}):
        code, body = server.handle_run()
        assert code == 409
        assert 'error' in body


def test_handle_status_reflects_state():
    import server
    with patch.object(server, '_run_state', {'status': 'done', 'run_id': 'abc'}):
        result = server.handle_status()
        assert result['status'] == 'done'
        assert result['run_id'] == 'abc'
