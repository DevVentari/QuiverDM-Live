"""Scenario: Create homebrew entries of different types and verify library."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Create multiple homebrew entries and verify the library displays them.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Navigate to Homebrew
3. Create entry 1 — Monster:
   - Name: Thornback Beetle, Type: Monster
   - Description: A giant beetle with spines that fire as ranged attacks. AC 16, HP 52, CR 3.
   - Save and verify it appears in library
4. Navigate back to Homebrew, create entry 2 — Spell (if type available):
   - Name: Shadow Bolt, Type: Spell (or closest)
   - Description: 2nd level necromancy. Deals 3d8 necrotic damage, 60ft range.
   - Save and verify it appears
5. Open the detail page for Thornback Beetle — verify content renders, no blank panels
6. Use any search or filter feature in the library — search for "Thorn" — verify result
7. Check if there are tabs or categories in the homebrew library — list them all

REPORT:
- SUCCESS: both entries created, library shows them, detail pages render, search works
- PARTIAL: created but library/search had issues
- FAILED: could not create entries

Note any missing type options, broken detail rendering, or search failures.
"""
