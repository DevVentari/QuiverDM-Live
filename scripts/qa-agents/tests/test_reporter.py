import json
from pathlib import Path
import pytest
from reporter import write_report, AgentResult


def test_write_report_creates_file(tmp_path):
    results = [
        AgentResult(persona='Nora', scenario='create_campaign', outcome='success',
                    friction_points=1, feedback_ids=['fb_abc'], error=None, duration_seconds=42),
    ]
    path = write_report(results, reports_dir=tmp_path)
    assert path.exists()
    data = json.loads(path.read_text())
    assert data['agents'][0]['persona'] == 'Nora'
    assert data['agents'][0]['outcome'] == 'success'
    assert data['agents'][0]['friction_points'] == 1


def test_write_report_updates_latest(tmp_path):
    results = [
        AgentResult(persona='Dana', scenario='upload_pdf', outcome='failed',
                    friction_points=0, feedback_ids=[], error='TimeoutError', duration_seconds=10),
    ]
    write_report(results, reports_dir=tmp_path)
    latest = tmp_path / 'latest.json'
    assert latest.exists()
    data = json.loads(latest.read_text())
    assert data['agents'][0]['error'] == 'TimeoutError'


def test_report_has_run_id(tmp_path):
    results = []
    write_report(results, reports_dir=tmp_path)
    latest = tmp_path / 'latest.json'
    data = json.loads(latest.read_text())
    assert 'run_id' in data
    assert 'duration_seconds' in data
