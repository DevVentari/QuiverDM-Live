# Feature Research Gate

Rule: no feature enters implementation planning unless `research_gate=pass`.

Pass criteria:

1. Problem evidence:
- At least 3 real user pain signals (interviews, usage data, or support feedback).

2. Market evidence:
- At least 2 competitor references with links and date checked.

3. Technical feasibility:
- Integration path documented against current architecture.
- Security/privacy implications identified.

4. Unit economics:
- Estimated incremental COGS per active user.
- Expected conversion/retention impact hypothesis.

5. Acceptance definition:
- Testable success metrics and rollout guardrails.

Statuses:

- `brainstorm`
- `researching`
- `research_gate=pass`
- `research_gate=fail`
- `integration_candidate`
- `in_mvp_plan`
- `deferred`

Escalation:

- Any feature with unknown legal/compliance impact is blocked until reviewed.

