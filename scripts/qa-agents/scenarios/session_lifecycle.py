"""Scenario: Full session lifecycle — create, prep, launch cockpit, end."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Run a complete session lifecycle.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign from the dashboard
3. Go to Sessions — click "New Session"
4. Fill: Name="QA Session Live", date=today or any date — save
5. On the session detail page, find and open the Prep Wizard
6. Fill:
   - Strong Start: "The party wakes to find the inn on fire"
   - Scene 1: "Chase the arsonist through the market"
   - Secret: "The innkeeper set the fire for the insurance"
   - Save or advance through all steps
7. Back on session detail, find "Launch Session" or "Start" — click it
8. Verify the cockpit loads (new tab or full screen) — check: timer visible, notes panel visible, party panel visible
9. In the cockpit, type a note in the live notes area if available
10. End the session using the end/finish button
11. Verify redirect back to session detail or dashboard

REPORT:
- SUCCESS: full lifecycle worked, cockpit loaded all panels
- PARTIAL: most steps worked but some panel/step was broken
- FAILED: could not complete session flow

List every URL and any errors/missing panels.
"""
