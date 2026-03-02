"""Scenario: Navigate homebrew library, attempt PDF upload, explore all homebrew tabs."""

TASK = """
You are a QA agent testing the QuiverDM web app at {app_url}. Move fast. Do not use the feedback overlay.

GOAL: Explore the full homebrew section including PDF upload workflow.

1. Go to {app_url}/auth/signin — sign in: email={email}, password={password}
2. Navigate to Homebrew (sidebar or /homebrew)
3. Note what tabs/sections exist — list them all
4. Find PDF upload: look for "Upload PDF", "Add Source", "Import", or similar
5. Click the upload trigger — verify a file picker or upload UI appears
6. Check: are accepted file types shown? Is there a size limit shown? Does the UI explain what happens after upload?
7. Navigate to /homebrew/pdfs — verify page loads and shows any existing PDFs (or clear empty state)
8. Go back to main homebrew list — click any existing item if present, verify detail page loads
9. Check the homebrew create flow: find "New" or "Create" button, verify form opens with correct fields

REPORT at the end:
- SUCCESS: found PDF upload, all homebrew pages load, no broken routes
- PARTIAL: found it but some pages had errors
- FAILED: could not find homebrew or upload was broken

List every URL visited and any errors.
"""
