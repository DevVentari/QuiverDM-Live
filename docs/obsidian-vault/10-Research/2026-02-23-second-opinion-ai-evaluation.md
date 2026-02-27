# Second-Opinion AI Evaluation (2026-02-23)

## Question

Should we use Claude Code alone, or add another AI for second-pass review?

## Recommendation

Use a dual-lane setup:

1. Claude Code:
- primary implementation agent

2. Second-opinion reviewer (different model family):
- default: Gemini CLI (cost-conscious)
- escalation: Codex cloud/CLI for high-risk PR review

Reason:

- Independent model families catch different errors and assumptions.
- Single-model loops tend to miss their own blind spots.

## Tool suitability snapshot

### Claude Code

Good for:
- repo-aware edits
- command execution and CI-oriented workflows
- strong implementation velocity

Verdict:
- suitable as primary builder

### Gemini CLI

Good for:
- no/low-cost second look
- large context reasoning and terminal workflows
- MCP-based extension paths

Verdict:
- best no-budget second-opinion baseline

### OpenAI Codex (cloud + CLI)

Good for:
- background parallel tasks
- independent cloud task execution and PR drafts
- strong second-pass design/code review on critical work

Verdict:
- strong secondary reviewer for high-stakes changes

## Proposed review protocol

1. Build:
- Claude Code implements from plan spec.

2. Review:
- Gemini CLI performs adversarial review:
  - logic gaps
  - edge cases
  - perf/cost risks

3. Escalate:
- For security/billing/data migration changes, run Codex cloud review before merge.

4. Merge gate:
- require either:
  - zero critical findings
  - or documented mitigation.

## Sources

- Claude Code overview:
  - https://docs.anthropic.com/en/docs/claude-code/overview
- Gemini CLI docs:
  - https://cloud.google.com/gemini/docs/codeassist/gemini-cli
  - https://github.com/google-gemini/gemini-cli
- OpenAI Codex docs:
  - https://platform.openai.com/docs/codex
  - https://openai.com/index/codex-now-generally-available/
  - https://openai.com/codex/

