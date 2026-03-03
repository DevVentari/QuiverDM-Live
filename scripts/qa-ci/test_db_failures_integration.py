"""Integration test for db_failures against production DB."""
import os
import db_failures

print("=== TEST: create_failure ===")
fid = db_failures.create_failure(
    "test-scenario",
    "tests/smoke/auth.smoke.spec.ts",
    99,
    "TimeoutError: locator.click timed out after 30000ms",
)
print(f"  Created id: {fid}")
assert fid is not None, "create_failure returned None"

print("=== TEST: get_open_failures ===")
failures = db_failures.get_open_failures()
match = [f for f in failures if f["id"] == fid]
assert match, "failure not found in open list"
row = match[0]
print(f"  scenarioId={row['scenarioId']}, fixAttempts={row['fixAttempts']}, createdAt={row['createdAt']}")

print("=== TEST: mark_fixing ===")
ok = db_failures.mark_fixing(fid)
print(f"  mark_fixing: {ok}")
assert ok

print("=== TEST: update_fix_attempt ===")
ok = db_failures.update_fix_attempt(fid, branch="fix/qa-test-scenario", pr_url="https://github.com/test/pr/1")
print(f"  update_fix_attempt: {ok}")
assert ok

print("=== TEST: get_failure_by_scenario ===")
row2 = db_failures.get_failure_by_scenario("test-scenario")
assert row2 is not None and row2["id"] == fid
print(f"  branch={row2.get('branch')}, prUrl={row2.get('prUrl')}, fixAttempts={row2.get('fixAttempts')}")

print("=== TEST: close_failure ===")
ok = db_failures.close_failure(fid, "Fixed by test")
print(f"  close_failure: {ok}")
assert ok

print("=== TEST: verify closed (should not appear in open list) ===")
failures2 = db_failures.get_open_failures()
still_open = [f for f in failures2 if f["id"] == fid]
print(f"  Still in open list: {len(still_open)} (expect 0)")
assert len(still_open) == 0

print("=== TEST: FAIL PATH — bad DATABASE_URL ===")
orig = os.environ.get("DATABASE_URL")
os.environ["DATABASE_URL"] = "postgresql://bad:bad@localhost:9999/nope"
import importlib
import db_failures as df2
importlib.reload(df2)
result = df2.create_failure("fail-scenario", "tests/smoke/auth.smoke.spec.ts", 1, "simulated")
print(f"  create_failure with bad URL returned: {result} (expect None)")
assert result is None, f"expected None, got {result}"
if orig:
    os.environ["DATABASE_URL"] = orig

print("\n=== ALL TESTS PASSED ===")
