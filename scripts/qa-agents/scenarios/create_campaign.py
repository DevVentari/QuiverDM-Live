"""Scenario: Create a campaign and verify overview page loads."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Create a campaign and verify it loads correctly.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. On the dashboard, click "New Campaign" (or navigate to /campaigns/new)
3. Fill: Name="QA Campaign Alpha", System="D&D 5e" (or closest option), click Create
4. Verify you land on the campaign overview page (URL contains /campaigns/)
5. Check: sidebar navigation visible, at least 3 sections (Sessions, NPCs, Characters or similar)
6. Click each sidebar item — confirm each page loads without error

REPORT at the end:
- SUCCESS: campaign created, overview loads, all sidebar items navigate correctly
- PARTIAL: created but some sections had errors or missing content
- FAILED: could not create or overview broken

List every page/URL you visited and any errors you saw (console errors, 404s, blank panels).
"""
