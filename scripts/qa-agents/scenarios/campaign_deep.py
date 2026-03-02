"""Scenario: Deep campaign audit — all pages, navigation, empty states, settings."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Systematically audit every section of a campaign for broken pages, missing navigation, and bad empty states.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Navigate to the campaign overview page
3. For EACH of the following sections, navigate there and note: loads OK / error / blank:
   a. Sessions list
   b. NPCs list
   c. Characters list
   d. Encounters (if present)
   e. Homebrew / Library (campaign-level)
   f. Campaign Settings or Edit page
   g. Members / Players page
4. For each empty section, check: is there a clear empty state message and a "Create" CTA?
5. Go to dashboard — verify all campaigns listed, click between them
6. Check the user settings page (/settings or profile) — does it load? List what settings are available
7. Navigate to /dashboard, /campaigns — verify no 404s or auth loops
8. Try browser back button after navigating deep — does it work without breaking state?

REPORT:
- SUCCESS: all sections load, empty states clear, navigation works
- PARTIAL: most work but some sections blank or errored
- FAILED: major navigation breakdown

For each broken page, include the URL and error message. Include a full list of all URLs visited.
"""
