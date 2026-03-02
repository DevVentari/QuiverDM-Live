"""Scenario: Player Penny joins a campaign via invite and views her character."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Test the player perspective — joining a campaign, viewing the player portal, managing a character.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. On the dashboard, look for any campaigns you are a member of (not owner)
3. If you find one, open it — note: does the UI differ from the DM view? (no edit buttons, read-only sections?)
4. Navigate to Characters within that campaign — can you see other players' characters?
5. If you have a character assigned, open it — verify you can view but check if edit is restricted
6. Look for a "Player Recap" or "Session Summary" section — does it exist and load?
7. Try navigating to campaign Settings — verify you get a permission error or the option is hidden
8. Go to /dashboard — verify campaign list shows your membership role (Player vs DM)
9. Check if there is a "Join Campaign" or invite acceptance flow anywhere — note the URL pattern

REPORT:
- SUCCESS: player view is clearly distinct from DM, permissions enforced, portal loads
- PARTIAL: view loaded but permission boundaries were unclear or broken
- FAILED: could not find player-specific view or got errors

List every URL visited. Note any DM-only actions that were incorrectly accessible.
"""
