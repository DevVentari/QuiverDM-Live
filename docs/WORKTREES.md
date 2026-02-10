# Git Worktrees Guide

QuiverDM uses git worktrees to enable parallel development on different features without context switching overhead.

## What Are Git Worktrees?

Git worktrees allow you to check out multiple branches simultaneously in different directories. This enables:
- **Parallel development**: Work on marketing site while keeping main branch active
- **Fast context switching**: No need to stash/commit incomplete work
- **Isolated environments**: Each worktree has its own working directory
- **Shared git history**: All worktrees share the same `.git` repository

## Current Worktrees

| Worktree | Path | Branch | Purpose |
|----------|------|--------|---------|
| Main | `.` (root) | `main` | Primary development (backend, features) |
| Marketing | `.worktrees/marketing-site` | `marketing/landing-page` | Landing page, pricing, marketing |

## Using Worktrees

### List Active Worktrees
```bash
git worktree list
```

### Switch to Marketing Worktree
```bash
cd .worktrees/marketing-site
npm run dev  # Start dev server (use different port if main is running)
```

### Switch Back to Main
```bash
cd ../..  # Back to project root
npm run dev
```

### Create New Worktree
```bash
git worktree add .worktrees/feature-name -b feature/new-feature
```

### Remove Worktree
```bash
git worktree remove .worktrees/feature-name
# Or manually: rm -rf .worktrees/feature-name && git worktree prune
```

## VSCode Multi-Root Workspace

Open `quiverdm.code-workspace` in VSCode to see both main and marketing worktrees simultaneously:

```bash
code quiverdm.code-workspace
```

This provides:
- Side-by-side development
- Independent terminals for each worktree
- Unified search across both workspaces
- Separate git status for each folder

## Context Switching Protocol

### Before Switching Worktrees:

1. **Stop dev servers** in current worktree:
   ```bash
   # Ctrl+C in terminal running npm run dev
   # Ctrl+C in terminal running npm run dev:ws
   ```

2. **Check for uncommitted changes** (optional):
   ```bash
   git status
   # Commit or stash if needed
   ```

3. **Switch directories**:
   ```bash
   cd .worktrees/marketing-site  # To marketing
   cd ../..                       # Back to main
   ```

4. **Start dev server** in new worktree:
   ```bash
   npm run dev  # API server
   # npm run dev:ws  # WebSocket (if needed)
   ```

### Shared Resources

These are shared across all worktrees:
- **Docker services**: Postgres, Redis, MeiliSearch, Ollama (keep running)
- **node_modules**: Installed per worktree (run `npm install` once per worktree)
- **Git history**: Commits from any worktree appear in all worktrees
- **Environment variables**: Copy `.env.local` to each worktree if needed

### Port Conflicts

If running dev servers in both worktrees simultaneously:
- Main: `http://localhost:3847` (default)
- Marketing: `PORT=3848 npm run dev` (custom port)

## Common Workflows

### Scenario 1: Build Marketing Site While Main Dev Continues
```bash
# Terminal 1 (Main)
cd /path/to/QuiverDM
npm run dev  # Port 3847

# Terminal 2 (Marketing)
cd .worktrees/marketing-site
npm run dev  # Port 3847 (or use PORT=3848)
```

### Scenario 2: Merge Marketing Changes to Main
```bash
# In main worktree
git merge marketing/landing-page

# Or create PR
cd .worktrees/marketing-site
git push origin marketing/landing-page
# Then create PR on GitHub
```

### Scenario 3: Experiment Without Risk
```bash
# Create experiment worktree
git worktree add .worktrees/experiment -b experiment/risky-change

# Work on experiment
cd .worktrees/experiment
# ... make changes ...

# If experiment fails, just delete worktree
cd ../..
git worktree remove .worktrees/experiment
git branch -D experiment/risky-change  # Delete branch too
```

## Best Practices

1. **One worktree per major initiative**: Don't create too many worktrees
2. **Name branches clearly**: Use prefixes like `marketing/`, `feature/`, `experiment/`
3. **Clean up unused worktrees**: Run `git worktree prune` periodically
4. **Commit regularly**: Each worktree has independent working state
5. **Share node_modules strategy**: Install dependencies in each worktree or use symlinks

## Troubleshooting

### "Branch is already checked out"
You can't check out the same branch in multiple worktrees. Use different branches:
```bash
git worktree add .worktrees/marketing-site -b marketing/landing-page
# NOT: git worktree add .worktrees/test main  # ❌ main already checked out
```

### Worktree Path Errors
Worktree paths must be relative to repository root or absolute. Use:
```bash
git worktree add .worktrees/name  # ✅ Relative
git worktree add /full/path/name  # ✅ Absolute
# NOT: ../name  # ❌ Parent directory reference
```

### Port Already in Use
If switching between worktrees with dev servers running:
```bash
# Option 1: Stop previous server (Ctrl+C)
# Option 2: Use different port
PORT=3848 npm run dev
```

## Additional Resources

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Pro Git Book - Worktrees](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging#_working_tree)
- [VSCode Multi-Root Workspaces](https://code.visualstudio.com/docs/editor/multi-root-workspaces)

**Last Updated**: 2026-02-10
