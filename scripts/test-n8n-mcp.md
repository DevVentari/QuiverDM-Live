# N8N MCP Connection Test

After restarting Claude Code, ask me to run these tests to verify the n8n MCP connection:

## Test 1: Check Available Tools
Ask: "What n8n tools do you have access to?"

Expected: I should list tools like:
- `mcp__n8n__*` prefixed tools
- Tools for querying node documentation
- Tools for workflow management

## Test 2: Query N8N Documentation
Ask: "Can you query the n8n documentation for the HTTP Request node?"

Expected: I should be able to fetch documentation about the HTTP Request node

## Test 3: List Workflows (if any exist)
Ask: "Can you list the n8n workflows?"

Expected: I should be able to query and list workflows from your n8n instance

## If Tests Fail

Check these:
1. N8N containers are running: `docker ps | grep n8n`
2. N8N MCP is healthy: `curl http://localhost:3000/health`
3. Config file is valid JSON: `cat "$APPDATA/Claude/claude_desktop_config.json" | python -m json.tool`
4. Claude Code was fully restarted (not just window refresh)

## Connection Details

- **N8N MCP URL**: http://localhost:3000/mcp
- **N8N UI**: http://localhost:5678
- **Auth Token**: Mm02Q/rETD3qWYbG+7DH1L+W7Fiqx7Bg
- **Container**: n8n-mcp (ghcr.io/czlonkowski/n8n-mcp/n8n-mcp:latest)
