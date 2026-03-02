"""Scenario dependency and blocking relationships."""

SCENARIO_DEPS: dict[str, list[str]] = {
    "smoke": [],
    "auth": [],
    "onboarding": ["auth"],
    "campaigns": ["auth"],
    "sessions": ["campaigns"],
    "sessions-edge": ["sessions"],
    "npcs": ["campaigns"],
    "characters": ["campaigns"],
    "homebrew": ["campaigns"],
    "encounters": ["campaigns"],
    "encounter-ui-review": ["encounters"],
    "transcript": ["sessions"],
    "search": ["campaigns"],
    "rules": ["auth"],
    "billing": ["auth"],
    "members": ["campaigns"],
    "admin-invites-ui": ["auth"],
    "webhooks": ["campaigns"],
    "pdf-viewer-tab": ["homebrew"],
}


def compute_blocks() -> dict[str, list[str]]:
    """Derived reverse map of scenario -> scenarios that directly depend on it."""
    blocks: dict[str, list[str]] = {k: [] for k in SCENARIO_DEPS}
    for scenario, deps in SCENARIO_DEPS.items():
        for dep in deps:
            if dep in blocks:
                blocks[dep].append(scenario)
    return blocks


SCENARIO_BLOCKS: dict[str, list[str]] = compute_blocks()


def get_transitive_dependents(scenario_id: str) -> set[str]:
    """Return all scenarios that transitively depend on scenario_id."""
    result: set[str] = set()
    queue = list(SCENARIO_BLOCKS.get(scenario_id, []))
    while queue:
        dep = queue.pop()
        if dep not in result:
            result.add(dep)
            queue.extend(SCENARIO_BLOCKS.get(dep, []))
    return result
