"""
Scenario: Homebrew Holly creates a homebrew entry in the library.

Persona: Homebrew Holly (uses Vic's account)
Flow: Sign in → homebrew → create new → fill details → save → verify in library → view detail
"""

TASK = """
You are testing the QuiverDM web app at {app_url}.

Your goal: create a new homebrew entry and verify it appears correctly in the library.

Steps:
1. Go to {app_url}/auth/signin
2. Sign in with email={email} and password={password}
3. Navigate to the Homebrew section (look in the sidebar or main navigation)
4. Click "New" or "Create" or "Add Homebrew" to create a new entry
5. Fill in:
   - Name: Shadow Drake
   - Type: Monster (or closest available category)
   - Description: A small draconic creature that lives in shadowy places. It can turn invisible for short periods and has darkvision of 120ft.
6. Save the homebrew entry
7. Verify it appears in the homebrew library list
8. Open the detail page for Shadow Drake
9. Verify the name and description render correctly on the detail page

Pay attention to:
- Is the homebrew library easy to find?
- Are there clear type/category options?
- Does the saved content display correctly on the detail page?
- Any missing fields or broken UI?

When you encounter problems:
1. Look for the feedback button in the bottom-right corner
2. Click it, select Bug or Feature, fill:
   [QA-AGENT] Persona: Holly | Scenario: homebrew_create | Step: <what you were doing> | Issue: <what went wrong>
3. Submit and continue

At the end, report: SUCCESS (homebrew created and visible), PARTIAL (created but display issues), or FAILED.
"""
