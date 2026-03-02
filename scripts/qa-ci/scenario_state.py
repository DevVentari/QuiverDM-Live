"""Scenario state machine and JSON persistence."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

from scenario_deps import SCENARIO_BLOCKS, SCENARIO_DEPS, get_transitive_dependents

RUNNABLE_STATUSES = {"active", "failing", "retrying"}


@dataclass
class ScenarioState:
    """Holds mutable state for one test scenario."""

    spec_file: str
    status: str = "active"
    consecutive_fails: int = 0
    total_passes: int = 0
    total_fails: int = 0
    cycles_since_pause: int = 0
    github_issue_number: int | None = None
    last_error: str | None = None
    paused_by: str | None = None
    blocks: list[str] = field(default_factory=list)

    @property
    def is_runnable(self) -> bool:
        return self.status in RUNNABLE_STATUSES

    def record_pass(self) -> None:
        if self.status in RUNNABLE_STATUSES:
            self.status = "active"
            self.consecutive_fails = 0
            self.total_passes += 1

    def record_fail(self, error: str) -> bool:
        newly_paused = False
        self.consecutive_fails += 1
        self.total_fails += 1
        self.last_error = error

        if self.status == "retrying":
            self.status = "paused"
            self.cycles_since_pause = 0
            return False

        if self.status == "active" or (
            self.status == "failing" and self.consecutive_fails < 3
        ):
            self.status = "failing"

        if self.status == "failing" and self.consecutive_fails >= 3:
            self.status = "paused"
            self.cycles_since_pause = 0
            newly_paused = True

        return newly_paused

    def tick_pause(self) -> bool:
        if self.status != "paused":
            return False
        self.cycles_since_pause += 1
        if self.cycles_since_pause >= 20:
            self.status = "retrying"
            return True
        return False

    def to_dict(self) -> dict[str, object]:
        return {
            "spec_file": self.spec_file,
            "status": self.status,
            "consecutive_fails": self.consecutive_fails,
            "total_passes": self.total_passes,
            "total_fails": self.total_fails,
            "cycles_since_pause": self.cycles_since_pause,
            "github_issue_number": self.github_issue_number,
            "last_error": self.last_error,
            "paused_by": self.paused_by,
            "blocks": list(self.blocks),
        }

    @classmethod
    def from_dict(cls, scenario_id: str, data: dict[str, object]) -> ScenarioState:
        return cls(
            spec_file=str(data.get("spec_file", f"tests/{scenario_id}.spec.ts")),
            status=str(data.get("status", "active")),
            consecutive_fails=int(data.get("consecutive_fails", 0)),
            total_passes=int(data.get("total_passes", 0)),
            total_fails=int(data.get("total_fails", 0)),
            cycles_since_pause=int(data.get("cycles_since_pause", 0)),
            github_issue_number=(
                int(data["github_issue_number"])
                if data.get("github_issue_number") is not None
                else None
            ),
            last_error=(
                str(data["last_error"]) if data.get("last_error") is not None else None
            ),
            paused_by=(
                str(data["paused_by"]) if data.get("paused_by") is not None else None
            ),
            blocks=list(data.get("blocks") or list(SCENARIO_BLOCKS.get(scenario_id, []))),
        )


class StateManager:
    """Loads, mutates, and saves scenario execution state."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.cycle_count = 0
        self.total_completions = 0
        self.target = 1000
        self.scenarios: dict[str, ScenarioState] = {}

    def _default_scenario(self, scenario_id: str) -> ScenarioState:
        return ScenarioState(
            spec_file=f"tests/{scenario_id}.spec.ts",
            status="active",
            consecutive_fails=0,
            total_passes=0,
            total_fails=0,
            cycles_since_pause=0,
            github_issue_number=None,
            last_error=None,
            paused_by=None,
            blocks=list(SCENARIO_BLOCKS.get(scenario_id, [])),
        )

    def load(self) -> None:
        if not self.path.exists():
            self.cycle_count = 0
            self.total_completions = 0
            self.target = 1000
            self.scenarios = {
                scenario_id: self._default_scenario(scenario_id)
                for scenario_id in SCENARIO_DEPS
            }
            return

        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.cycle_count = int(data.get("cycle_count", 0))
        self.total_completions = int(data.get("total_completions", 0))
        self.target = int(data.get("target", 1000))

        scenarios_data = data.get("scenarios", {})
        if not isinstance(scenarios_data, dict):
            scenarios_data = {}

        scenarios: dict[str, ScenarioState] = {}
        for scenario_id in SCENARIO_DEPS:
            raw = scenarios_data.get(scenario_id)
            if isinstance(raw, dict):
                state = ScenarioState.from_dict(scenario_id, raw)
            else:
                state = self._default_scenario(scenario_id)
            state.blocks = list(SCENARIO_BLOCKS.get(scenario_id, []))
            scenarios[scenario_id] = state
        self.scenarios = scenarios

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "cycle_count": self.cycle_count,
            "total_completions": self.total_completions,
            "target": self.target,
            "scenarios": {
                scenario_id: state.to_dict()
                for scenario_id, state in sorted(self.scenarios.items())
            },
        }
        tmp_path = self.path.with_name(f"{self.path.name}.tmp")
        tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
        os.replace(tmp_path, self.path)

    def get_scenario(self, scenario_id: str) -> ScenarioState:
        return self.scenarios[scenario_id]

    def all_scenarios(self) -> dict[str, ScenarioState]:
        return self.scenarios

    def runnable_scenarios(self) -> list[tuple[str, ScenarioState]]:
        return [
            (scenario_id, state)
            for scenario_id, state in self.scenarios.items()
            if state.is_runnable
        ]

    def pause_with_dependents(self, scenario_id: str, issue_number: int | None) -> None:
        all_to_pause = {scenario_id, *get_transitive_dependents(scenario_id)}
        for sid in all_to_pause:
            state = self.get_scenario(sid)
            state.status = "paused"
            state.cycles_since_pause = 0
            if sid == scenario_id:
                state.github_issue_number = issue_number
                state.paused_by = None
            else:
                state.paused_by = scenario_id

    def resume_from_issue(self, scenario_id: str) -> None:
        root = self.get_scenario(scenario_id)
        root.status = "active"
        root.consecutive_fails = 0
        root.cycles_since_pause = 0
        root.paused_by = None
        root.github_issue_number = None

        for sid in get_transitive_dependents(scenario_id):
            dep = self.get_scenario(sid)
            if dep.paused_by == scenario_id:
                dep.status = "active"
                dep.cycles_since_pause = 0
                dep.consecutive_fails = 0
                dep.paused_by = None

    def increment_cycle(self) -> None:
        self.cycle_count += 1

    def increment_completions(self, n: int) -> None:
        self.total_completions += n

    def target_reached(self) -> bool:
        return self.total_completions >= self.target
