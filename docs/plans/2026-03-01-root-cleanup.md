# Root Directory Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove accumulated junk from the project root — stale docs, committed handoff files, local temp files — and add CLAUDE.md conventions to prevent recurrence.

**Architecture:** Three-phase: (1) delete local-only junk, (2) git rm committed clutter and commit, (3) update .gitignore + CLAUDE.md with file placement conventions.

**Tech Stack:** git, bash

---

### Task 1: Delete local-only junk (not in git)

**Files:** Root directory

**Step 1:** Delete PNG screenshots and images in root
```bash
cd E:/Projects/QuiverDM
rm -f 0[0-9]-*.png [0-9][0-9]-*.png
rm -f admin-rules.png admin-rules-fixed.png bonfire-keep-castle.png bonfire-keep-option2.png
rm -f dashboard-current.png dashboard-review.png encounters.png homebrew-library.png
rm -f lost-mines-tunnel.png next-adventure-road.png npc-new.png
rm -f pdf-detail-live-processing.png pdf-list-*.png pdf-live-processing-*.png pdf-processing-*.png
rm -f pdfs-page.png pdf-upload-test-complete.png session-detail.png settings.png
rm -f strahd-castle-fog.png waterdeep-harbor.png
rm -f bonfire-keep-*.png
```

**Step 2:** Delete temp/scratch files
```bash
rm -f find-next-cache.mjs .tmp_scan_node_modules.py
rm -f package-lock.backup.json package-lock.corrupted.json
rm -f lint_check.log tsc_check.log worker-pdf.log
```

**Step 3:** Delete temp directories
```bash
rm -rf .backup/ .repair/ .playwright-mcp/
```

**Step 4:** Verify root is cleaner
```bash
ls *.png 2>/dev/null || echo "No PNGs remaining"
ls *.log 2>/dev/null || echo "No logs remaining"
```

---

### Task 2: Remove committed clutter from git

**Files:** Root-level `.md`, config, and legacy files tracked in git

**Step 1:** Remove Codex handoff docs
```bash
cd E:/Projects/QuiverDM
git rm CODEX_AGENT_A.md CODEX_AGENT_B.md CODEX_AGENT_C.md CODEX_AGENT_D.md CODEX_AGENT_E.md
git rm CODEX_AGENT_MOTION.md CODEX_CLEANUP.md CODEX_HOMEBREW_LINKING.md
git rm CODEX_LAZY_DM_WIZARD.md CODEX_PDF_UI_REDESIGN.md
git rm CODEX_PHASE2_COMFYUI_PLANNING.md CODEX_PHASE3_CLOUD_FALLBACK_PLANNING.md CODEX_PHASE4_UI_PLANNING.md
```

**Step 2:** Remove stale session/status docs
```bash
git rm WORKFLOW_TEST_LOG.md LAUNCH_PREPARATION.md UI_AUDIT.md
git rm IMAGE_SUPPORT_IMPLEMENTATION_PLAN.md PHASE2_DECISIONS.md
git rm pdf-list-snapshot.md status_update.txt output.txt 0
```

**Step 3:** Remove GPU/Python-era leftovers
```bash
git rm QUICK_START_GPU.md requirements.txt
git rm GPU_OPTIMIZATION_COMPLETE.md 2>/dev/null || true
```

**Step 4:** Remove Railway/PM2 deployment files (now on Vercel)
```bash
git rm railway.json railway.toml ecosystem.config.js
```

**Step 5:** Commit
```bash
git commit -m "chore: remove root clutter — stale docs, codex handoffs, railway config"
```

---

### Task 3: Update .gitignore

**Files:** `.gitignore`

**Step 1:** Add rules to prevent future accumulation. After the `# Misc temp files` section, add:

```
# Codex handoff docs (use docs/codex-handoffs/ instead)
CODEX_*.md
docs/codex-handoffs/

# Screenshots captured during development
*.png
# (already covered globally above — confirm rule exists)

# Backup package-lock files
package-lock.backup.json
package-lock.corrupted.json

# Playwright MCP temp dir
.playwright-mcp/
```

**Step 2:** Commit
```bash
git add .gitignore
git commit -m "chore: add .gitignore rules for codex handoffs, backups, playwright-mcp"
```

---

### Task 4: Update CLAUDE.md with file placement conventions

**Files:** `CLAUDE.md`

**Step 1:** Add a "File Placement" section to CLAUDE.md (after the Codex Delegation section):

```markdown
## File Placement

Keep the project root clean. Use these locations:

| File type | Where it goes |
|-----------|--------------|
| Codex handoff docs | `docs/codex-handoffs/` (gitignored, temp) |
| Screenshots / UI captures | `docs/screenshots/` (gitignored) |
| Design docs / plans | `docs/plans/YYYY-MM-DD-<topic>.md` |
| Brainstorm design docs | `docs/plans/YYYY-MM-DD-<topic>-design.md` |
| Temp / scratch files | Delete when done — never commit |
```

**Step 2:** Add `docs/screenshots/` and `docs/codex-handoffs/` to .gitignore if not already covered.

**Step 3:** Commit
```bash
git add CLAUDE.md
git commit -m "docs: add file placement conventions to CLAUDE.md"
```
