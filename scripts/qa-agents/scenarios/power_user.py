"""Scenario: Power User Paul stress-tests edge cases and bulk operations."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Hit edge cases, bulk actions, and stress-test the UI with unusual inputs.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign — navigate to NPCs
3. Create an NPC with edge-case inputs:
   - Name: 'Test NPC <script>alert(1)</script>' (XSS check — verify it renders as text, not executed)
   - Name with 200 characters: 'AAAA...' (paste 200 A's) — does the field truncate or show an error?
4. Navigate to Sessions — create a session with an empty name — verify validation error appears
5. Try navigating directly to a non-existent campaign: {app_url}/campaigns/does-not-exist-99999 — verify 404 or redirect
6. Try navigating to a non-existent NPC: {app_url}/campaigns/[any-slug]/npcs/99999999 — verify graceful error
7. Open any list page (NPCs, Sessions) — if there are 5+ items, check if pagination or infinite scroll works
8. Open a form, fill some fields, then navigate away without saving — verify no silent data loss (either a warning appears or it auto-saves)
9. Rapidly click a "Save" button 3 times in quick succession — verify no duplicate submissions
10. Check if any page has a keyboard shortcut (press ? or check for a shortcuts hint)

REPORT:
- SUCCESS: XSS renders safely, validation works, 404s are graceful, no duplicate submissions
- PARTIAL: most edge cases handled but some failed
- FAILED: XSS executed, crashes, or data corruption

List every URL and every edge case result explicitly.
"""
