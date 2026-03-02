import json
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class AgentResult:
    persona: str
    scenario: str
    outcome: str
    friction_points: int
    feedback_ids: list[str]
    error: Optional[str]
    duration_seconds: float
    findings: str = ''
    urls_visited: list[str] = field(default_factory=list)
    screenshot_path: Optional[str] = None


def write_report(
    results: list[AgentResult],
    reports_dir: Path | None = None,
) -> Path:
    if reports_dir is None:
        reports_dir = Path(__file__).parent / 'reports'
    reports_dir.mkdir(parents=True, exist_ok=True)

    run_id = datetime.now().strftime('%Y-%m-%dT%H%M')
    total_duration = sum(r.duration_seconds for r in results)

    payload = {
        'run_id': run_id,
        'duration_seconds': round(total_duration, 1),
        'agents': [asdict(r) for r in results],
    }

    timestamped = reports_dir / f'{run_id}.json'
    timestamped.write_text(json.dumps(payload, indent=2))

    latest = reports_dir / 'latest.json'
    latest.write_text(json.dumps(payload, indent=2))

    return timestamped
