from pathlib import Path

from scenario_deps import SCENARIO_DEPS, get_transitive_dependents
from scenario_state import ScenarioState, StateManager


def test_initial_state_load_from_empty(tmp_path: Path) -> None:
    manager = StateManager(tmp_path / "scenario_state.json")
    manager.load()

    assert manager.cycle_count == 0
    assert manager.total_completions == 0
    assert manager.target == 1000
    assert set(manager.all_scenarios()) == set(SCENARIO_DEPS)
    assert all(s.status == "active" for s in manager.all_scenarios().values())


def test_record_pass_resets_consecutive_fails() -> None:
    state = ScenarioState(spec_file="tests/auth.spec.ts", status="failing", consecutive_fails=2)

    state.record_pass()

    assert state.status == "active"
    assert state.consecutive_fails == 0
    assert state.total_passes == 1


def test_record_fail_three_times_pauses_on_third() -> None:
    state = ScenarioState(spec_file="tests/auth.spec.ts")

    assert state.record_fail("e1") is False
    assert state.status == "failing"
    assert state.record_fail("e2") is False
    assert state.status == "failing"
    assert state.record_fail("e3") is True
    assert state.status == "paused"
    assert state.consecutive_fails == 3


def test_record_fail_in_retrying_pauses() -> None:
    state = ScenarioState(spec_file="tests/auth.spec.ts", status="retrying")

    newly_paused = state.record_fail("retry fail")

    assert newly_paused is False
    assert state.status == "paused"
    assert state.cycles_since_pause == 0


def test_tick_pause_20_cycles_switches_to_retrying() -> None:
    state = ScenarioState(spec_file="tests/auth.spec.ts", status="paused")

    switched = False
    for i in range(1, 21):
        switched = state.tick_pause()
        if i < 20:
            assert switched is False
    assert switched is True
    assert state.status == "retrying"


def test_pause_with_dependents_auth_pauses_transitive(tmp_path: Path) -> None:
    manager = StateManager(tmp_path / "scenario_state.json")
    manager.load()

    manager.pause_with_dependents("auth", 123)

    assert manager.get_scenario("auth").status == "paused"
    assert manager.get_scenario("auth").github_issue_number == 123
    dependents = get_transitive_dependents("auth")
    assert "campaigns" in dependents
    assert "sessions" in dependents
    assert "npcs" in dependents
    for dep in dependents:
        dep_state = manager.get_scenario(dep)
        assert dep_state.status == "paused"
        assert dep_state.paused_by == "auth"


def test_resume_from_issue_unpauses_paused_by_auth(tmp_path: Path) -> None:
    manager = StateManager(tmp_path / "scenario_state.json")
    manager.load()
    manager.pause_with_dependents("auth", 456)

    manager.resume_from_issue("auth")

    assert manager.get_scenario("auth").status == "active"
    for dep in get_transitive_dependents("auth"):
        dep_state = manager.get_scenario(dep)
        assert dep_state.status == "active"
        assert dep_state.paused_by is None


def test_target_reached() -> None:
    manager = StateManager(Path("scenario_state.json"))
    manager.total_completions = 100
    manager.target = 100
    assert manager.target_reached() is True


def test_atomic_save_and_reload_preserves_state(tmp_path: Path) -> None:
    state_path = tmp_path / "scenario_state.json"
    manager = StateManager(state_path)
    manager.load()
    manager.increment_cycle()
    manager.increment_completions(42)
    auth = manager.get_scenario("auth")
    auth.record_fail("x")
    manager.save()

    reloaded = StateManager(state_path)
    reloaded.load()
    assert reloaded.cycle_count == 1
    assert reloaded.total_completions == 42
    assert reloaded.get_scenario("auth").total_fails == 1
    assert reloaded.get_scenario("auth").last_error == "x"
    assert state_path.with_name("scenario_state.json.tmp").exists() is False


def test_get_transitive_dependents_for_campaigns() -> None:
    expected = {
        "sessions",
        "sessions-edge",
        "npcs",
        "characters",
        "homebrew",
        "encounters",
        "encounter-ui-review",
        "transcript",
        "search",
        "members",
        "webhooks",
        "pdf-viewer-tab",
    }
    assert get_transitive_dependents("campaigns") == expected
