# QuiverDM Brain Bank (Obsidian Vault)

Open this folder directly in Obsidian:

- `docs/obsidian-vault`

Purpose:

- Capture brainstorming without polluting delivery plans.
- Enforce a research gate before features are integrated.
- Keep machine-readable state for agent workflows.

Core folders:

- `00-System` - operating rules and templates
- `10-Research` - sourced research notes
- `20-Brainstorm` - raw ideas and hypotheses
- `30-Integration-Candidates` - shortlisted, gated features
- `_machine` - JSON state for agents/tools

Workflow:

1. Add ideas to `20-Brainstorm`.
2. Convert promising ideas to research notes in `10-Research`.
3. Update `_machine/feature_registry.json`.
4. Move only `research_gate=pass` items into `30-Integration-Candidates`.

