# MCP Servers Setup Guide

This guide explains how to configure and use the Model Context Protocol (MCP) servers integrated with QuiverDM for enhanced Claude Code functionality.

## What Are MCP Servers?

MCP (Model Context Protocol) servers extend Claude Code's capabilities by connecting to external tools, databases, and APIs. QuiverDM uses four MCP servers to enhance development workflows:

1. **PostgreSQL** - Direct database querying and schema inspection
2. **Filesystem** - Enhanced file operations for the project directory
3. **GitHub** - Issue tracking and PR management
4. **Playwright** - Browser automation for E2E testing

## Quick Start

The MCP servers are pre-configured in `.mcp.json` and will automatically connect when you start Claude Code, except for GitHub which requires a Personal Access Token.

### Prerequisites

- Node.js 18+ (already installed if you're running QuiverDM)
- Docker running (for PostgreSQL access)
- GitHub Personal Access Token (only for GitHub MCP)

### GitHub Personal Access Token Setup

1. **Create Token:**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Give it a descriptive name like "QuiverDM MCP Server"
   - Set expiration (recommend 90 days, then rotate)

2. **Required Scopes:**
   - ✅ `repo` - Full control of private repositories
   - ✅ `read:org` - Read org and team membership (if using org repos)

3. **Save Token:**
   - Copy the token (you won't see it again!)
   - Add to `.env.local`:
     ```env
     GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
     ```

4. **Restart Claude Code** to activate the GitHub MCP server

## MCP Server Details

### 1. PostgreSQL MCP Server

**Package:** `@modelcontextprotocol/server-postgres`
**Transport:** stdio (local process)
**Status:** Always available when Docker is running

#### Features
- Read-only SQL queries against your local database
- Schema inspection (tables, columns, data types, relationships)
- Automatic schema discovery from database metadata

#### Example Usage
- "Show me the database schema"
- "Query all campaigns in the database"
- "What's the structure of the Transcript table?"
- "Count how many NPCs are in campaign X"

#### Connection Details
- **Host:** localhost
- **Port:** 5433 (Docker mapped)
- **Database:** quiverdm
- **User:** quiverdm
- **Password:** localdev

#### Troubleshooting
```bash
# Check if PostgreSQL container is running
docker-compose ps

# Expected output:
# NAME                IMAGE          STATUS
# quiverdm-postgres   postgres:15    Up X minutes

# Test connection manually
psql postgresql://quiverdm:localdev@localhost:5433/quiverdm
```

---

### 2. Filesystem MCP Server

**Package:** `@modelcontextprotocol/server-filesystem`
**Transport:** stdio (local process)
**Status:** Always available

#### Features
- Enhanced file operations (read, write, search)
- Directory traversal and file management
- Scoped to project directory for security

#### Scope
- **Allowed Directory:** `C:\Projects\QuiverDM`
- **Subdirectories:** Full access to all project files
- **Security:** Cannot access files outside project directory

#### Example Usage
- "List all TypeScript files in src/server/routers/"
- "Find all files that import the Prisma client"
- "Create a new component in src/components/"
- "Read the contents of the schema file"

#### Security Notes
- Only project directory is accessible
- Runs with your user account permissions
- For additional directories, edit `.mcp.json` and add paths to the `args` array
- Use `:ro` suffix for read-only access (e.g., `"C:\\Projects\\QuiverDM\\docs:ro"`)

---

### 3. GitHub MCP Server

**Provider:** GitHub (official)
**Transport:** HTTP (remote)
**Status:** Requires authentication (see Quick Start above)

#### Features
- Repository management and information
- Issue tracking and creation
- Pull request operations
- User and organization access
- Code security insights

#### Available Toolsets
The server provides access to these GitHub features (configured via `GITHUB_TOOLSETS` env var):

**Default (enabled):**
- `context` - Repository context and information
- `repos` - Repository operations
- `issues` - Issue management
- `pull_requests` - PR creation and management
- `users` - User information

**Optional (can be enabled):**
- `actions` - GitHub Actions/CI/CD
- `code_security` - Security insights
- `dependabot` - Dependency management
- `discussions` - GitHub Discussions
- `gists` - Gist management
- `labels` - Label management
- `notifications` - GitHub notifications
- `projects` - Project boards

#### Example Usage
- "Create an issue for the transcription bug"
- "List all open PRs in the repository"
- "Show me the latest CI/CD run status"
- "What are the security vulnerabilities in our dependencies?"

#### Enabling Additional Toolsets

Edit `.mcp.json` to add environment variable:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      },
      "env": {
        "GITHUB_TOOLSETS": "default,actions,code_security"
      }
    }
  }
}
```

#### Troubleshooting
- **"Authentication failed"**: Check token in `.env.local` and verify it hasn't expired
- **"Insufficient permissions"**: Verify token has `repo` and `read:org` scopes
- **"Server unreachable"**: Requires VS Code 1.101+ for remote HTTP MCP support

---

### 4. Playwright MCP Server

**Package:** `@playwright/mcp@latest`
**Transport:** stdio (local process)
**Status:** Always available

#### Features
- Browser automation (Chromium, Firefox, WebKit)
- E2E test generation and debugging
- Screenshot capture
- PDF generation
- Form interaction testing
- Accessibility testing

#### Operating Mode

QuiverDM uses **Snapshot Mode** (default):
- Uses Playwright's accessibility tree for structured interactions
- Fast and lightweight (no screenshot processing)
- LLM-friendly (structured text/JSON)
- Deterministic interactions
- Better for accessibility testing

#### Available Tools
- `browser_navigate` - Navigate to URL
- `browser_snapshot` - Capture accessibility snapshot
- `browser_click` - Click element by accessibility reference
- `browser_type` - Enter text into fields
- `browser_select_option` - Select dropdown options
- `browser_take_screenshot` - Capture visual screenshot
- `browser_save_as_pdf` - Export page as PDF
- Plus navigation, keyboard input, file upload, etc.

#### Example Usage
- "Navigate to localhost:3000 and take a screenshot"
- "Test the campaign creation form"
- "Generate a PDF of the player dashboard"
- "Check the accessibility tree for the NPC form"
- "Fill out the homebrew item form and submit"

#### Integration with QuiverDM Tests

The MCP server runs **separately** from your Playwright test suite:
- Your tests: `playwright.config.ts` → `npm run test:e2e`
- MCP server: Interactive browser automation during Claude Code sessions
- No conflicts between test runs and MCP usage

#### User Profiles

Persistent browser profiles are stored at:
- **Windows:** `%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile`
- **macOS:** `~/Library/Caches/ms-playwright/mcp-{channel}-profile`
- **Linux:** `~/.cache/ms-playwright/mcp-{channel}-profile`

This allows cookies, local storage, and authentication to persist between sessions.

---

## Configuration File

All MCP servers are configured in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://quiverdm:localdev@localhost:5433/quiverdm"
      ]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Projects\\QuiverDM"
      ]
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      }
    },
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest"
      ]
    }
  }
}
```

## Testing Your Setup

### 1. Verify MCP Servers are Connected

In Claude Code:
```
What MCP servers are available?
```

Expected response should list all four servers:
- postgres
- filesystem
- github (if token is configured)
- playwright

### 2. Test Each Server

**PostgreSQL:**
```
Show me the database schema for QuiverDM
```

**Filesystem:**
```
List all files in src/app/
```

**GitHub:**
```
List the latest issues in this repository
```

**Playwright:**
```
Navigate to localhost:3000 and take a screenshot
```

## Common Issues

### PostgreSQL: "Connection refused"
**Cause:** Docker container isn't running
**Solution:**
```bash
docker-compose up -d
docker-compose ps  # Verify postgres is running
```

### GitHub: "Authentication failed"
**Cause:** Missing or invalid Personal Access Token
**Solution:**
1. Check `.env.local` has `GITHUB_PERSONAL_ACCESS_TOKEN=...`
2. Verify token hasn't expired
3. Regenerate token with correct scopes (repo, read:org)
4. Restart Claude Code

### Filesystem: "Permission denied"
**Cause:** Trying to access files outside allowed directory
**Solution:** MCP server is scoped to `C:\Projects\QuiverDM` only - this is intentional for security

### Playwright: "Browser not found"
**Cause:** Playwright browsers not installed
**Solution:**
```bash
npx playwright install chromium
```

## Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`, keep it that way
2. **Rotate GitHub tokens every 90 days** - Set expiration when creating token
3. **Use minimum required scopes** - Don't grant admin access unless needed
4. **Limit filesystem access** - Only add directories you trust Claude to modify
5. **Review MCP tool usage** - Check what operations are being performed
6. **Keep MCP packages updated** - Run `npx` to always use latest versions

## Team Setup

When a teammate clones the repository:

1. **They get `.mcp.json` automatically** (checked into git)
2. **They need to create `.env.local`** from `.env.local.template`
3. **They need their own GitHub PAT** (personal access token)
4. **That's it!** - MCP servers will connect automatically

## Advanced Configuration

### Adding Custom Filesystem Paths

Edit `.mcp.json` to add more directories:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Projects\\QuiverDM",
        "C:\\Projects\\QuiverDM\\docs:ro",  // Read-only
        "C:\\Projects\\OtherProject"
      ]
    }
  }
}
```

### Using Local Playwright (instead of npx)

If you want to use your project's Playwright installation:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "node_modules/.bin/playwright",
      "args": ["mcp"]
    }
  }
}
```

### Changing GitHub Toolsets

Add environment variable to enable more GitHub features:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}"
      },
      "env": {
        "GITHUB_TOOLSETS": "default,actions,code_security,dependabot"
      }
    }
  }
}
```

## Useful Resources

- **MCP Documentation:** https://modelcontextprotocol.io/
- **Claude Code MCP Guide:** https://code.claude.com/docs/en/mcp.md
- **PostgreSQL MCP:** https://github.com/modelcontextprotocol/servers/tree/main/src/postgres
- **Filesystem MCP:** https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
- **GitHub MCP:** https://github.com/github/github-mcp-server
- **Playwright MCP:** https://github.com/microsoft/playwright-mcp

## Getting Help

- Check Claude Code docs: `https://code.claude.com/docs`
- Review MCP server logs in Claude Code output panel
- Test connections with manual CLI commands (shown above)
- Ask in Claude Code: "What MCP tools are available?"
