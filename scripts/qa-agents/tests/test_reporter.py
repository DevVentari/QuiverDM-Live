import json
from pathlib import Path
import tempfile
from reporter import AgentResult, write_report


def _make_result(**overrides):
    defaults = dict(
        persona='Dana', scenario='upload_pdf', outcome='success',
        friction_points=0, feedback_ids=[], error=None, duration_seconds=50.0,
        findings='', urls_visited=[], screenshot_path=None,
    )
    return AgentResult(**{**defaults, **overrides})


def test_agent_result_new_fields_have_defaults():
    r = AgentResult(
        persona='Dana', scenario='upload_pdf', outcome='success',
        friction_points=0, feedback_ids=[], error=None, duration_seconds=50.0,
    )
    assert r.findings == ''
    assert r.urls_visited == []
    assert r.screenshot_path is None


def test_agent_result_accepts_new_fields():
    r = _make_result(
        findings='Button had no effect. Console showed TypeError.',
        urls_visited=['http://localhost:3847/auth/signin', 'http://localhost:3847/onboarding'],
        screenshot_path='/tmp/run-nora.png',
    )
    assert r.findings == 'Button had no effect. Console showed TypeError.'
    assert len(r.urls_visited) == 2
    assert r.screenshot_path == '/tmp/run-nora.png'


def test_write_report_includes_new_fields():
    r = _make_result(
        findings='All steps completed.',
        urls_visited=['http://localhost:3847/dashboard'],
        screenshot_path=None,
    )
    with tempfile.TemporaryDirectory() as tmpdir:
        path = write_report([r], reports_dir=Path(tmpdir))
        data = json.loads(path.read_text())
    agent = data['agents'][0]
    assert agent['findings'] == 'All steps completed.'
    assert agent['urls_visited'] == ['http://localhost:3847/dashboard']
    assert agent['screenshot_path'] is None


def test_write_report_creates_latest_json():
    r = _make_result()
    with tempfile.TemporaryDirectory() as tmpdir:
        write_report([r], reports_dir=Path(tmpdir))
        assert (Path(tmpdir) / 'latest.json').exists()


def test_write_report_total_duration():
    results = [_make_result(duration_seconds=30.0), _make_result(duration_seconds=20.5)]
    with tempfile.TemporaryDirectory() as tmpdir:
        path = write_report(results, reports_dir=Path(tmpdir))
        data = json.loads(path.read_text())
    assert data['duration_seconds'] == 50.5
