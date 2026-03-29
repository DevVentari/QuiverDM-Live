---
name: codex-handoff
description: Use when creating handoff documents for Codex agents in QuiverDM. Defines the compact machine-readable format that minimizes tokens while giving agents unambiguous implementation specs.
---

# Codex Handoff Docs

## Format

```
<task-id>
REPO:<absolute-path>
MOD:<file1,file2>
CREATE:<file3>
VERIFY:<cmd>

[relative/path/to/file.ts] <terse instruction or direct code>
[relative/path/to/other.tsx] <spec>
```

## Rules

- **No prose padding.** No background, rationale, or "why". Agents don't need it.
- **File sections use `[path]` keys.** One section per file.
- **Direct code > spec** for small files or components (<80 lines). Just write the code.
- **Terse spec** for large files: list changes as numbered imperatives, reference line context not line numbers (line numbers shift).
- **VERIFY line** always included. Agent runs it last and fixes any errors before finishing.
- **NOTE line** (optional) for cross-agent coordination (e.g. "Agent A creates X, import it as shown").

## What to omit

- No section headers beyond `[file]`
- No explanations of design choices
- No markdown formatting inside specs (except code blocks for the actual code)
- No "please", "make sure", "ensure" — just imperatives
- No repeated context that's in the code itself

## Launch pattern

```bash
# Write doc with Write tool, then:
codex exec --full-auto -C "E:\Projects\QuiverDM" "Read CODEX_X.md and implement all changes." &
```

No worktrees needed when agents touch different files. Use worktrees only when ≥2 agents modify the same file.

## Size targets

| File type | Target doc size |
|-----------|----------------|
| New small component (<80 lines) | Write full code directly |
| New large file | Compact spec + key snippets |
| Modifying existing file | Numbered change list, no full rewrite |
| Total per doc | <120 lines |
