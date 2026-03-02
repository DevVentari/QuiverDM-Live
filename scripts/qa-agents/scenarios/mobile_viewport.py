"""Scenario: Mobile Mike checks responsive layout at 390px viewport."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Verify the app is usable at mobile viewport width (390px — iPhone 14 size).

IMPORTANT: Before starting, resize your browser window to 390px wide. Keep it that width throughout.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. On the dashboard — check:
   - Is the sidebar collapsed or hidden? Is there a hamburger/menu button?
   - Are campaign cards readable and tappable?
3. Open a campaign — verify:
   - Navigation is accessible (hamburger menu or bottom nav)
   - No content is horizontally cut off or overflowing
4. Open the NPC list — verify the list is readable, "New NPC" button is visible
5. Open a form (create NPC or new session) — verify:
   - All form fields are full-width and tappable
   - Submit button is visible without horizontal scroll
6. Open a session detail page — verify the prep wizard button is accessible
7. Check the user settings page — verify it renders correctly at mobile width
8. Note any element that is too small to tap (< 44px touch target), text that overflows, or modals that go off-screen

REPORT:
- SUCCESS: all pages usable at 390px, navigation accessible, no overflow
- PARTIAL: most pages work but some have layout issues
- FAILED: core navigation broken at mobile width

List every broken layout with URL and description of the issue.
"""
