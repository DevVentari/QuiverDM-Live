"""Scenario: DM Dave invites a player and manages campaign members."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Test the DM invite and member management flow.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Open any campaign you own from the dashboard
3. Navigate to Members or Players section (sidebar or campaign settings)
4. Find the "Invite" button — click it
5. Fill the invite form with a test email: invited-player@test.local
6. Send the invite — verify a success message or confirmation appears
7. Check if the pending invite appears in the members list
8. Look for a way to copy an invite link — test if that button works
9. Try changing a member's role if any members exist (promote/demote)
10. Navigate to Campaign Settings — verify you can edit: name, description, system
11. Save a change (e.g. add " [QA]" to the description) — verify it saves
12. Revert the change

REPORT:
- SUCCESS: invite sent, pending invite visible, settings editable
- PARTIAL: some steps worked but invite flow or settings had issues
- FAILED: could not access member management

List every URL visited. Note any broken flows or missing confirmation messages.
"""
