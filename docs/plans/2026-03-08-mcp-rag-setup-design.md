# MCP RAG & Knowledge Integration — Design

Date: 2026-03-08

## Goal

Wire three MCP knowledge integrations into the global Claude Code config:
1. `mcp-local-rag` — local RAG over QuiverDM codebase + D&D notes
2. `mcp-obsidian` — read/write access to Obsidian vault
3. Qdrant + `mcp-server-qdrant` — vector DB for future n8n ingestion pipeline

## Scope

Config changes only. No app code changes. n8n ingestion workflow is a follow-up task.

## Components

### 1. mcp-local-rag (two instances)

- Package: `mcp-local-rag` (shinpr, LanceDB + Transformers.js, CPU-only, no API keys)
- Install: `npx -y mcp-local-rag` via stdio in `~/.claude.json`
- Instance `local-rag`: indexes `E:\Projects\QuiverDM`
- Instance `local-rag-dnd`: indexes `G:\My Drive\Notebooks\Dungeons and Dragons`
- Scope: user-level (available in all projects)

### 2. mcp-obsidian

- Package: `@modelcontextprotocol/server-obsidian` or `bitbonsai/mcp-obsidian`
- Vault path: `G:\My Drive\Notebooks\Dungeons and Dragons`
- Scope: user-level

### 3. Qdrant + mcp-server-qdrant

- Qdrant added to `E:\Projects\QuiverDM\docker-compose.yml` on port 6333 (standard)
- Volume: `qdrant_data` (persistent)
- MCP server: `mcp-server-qdrant` (uvx, official Qdrant MCP)
- Points at `http://localhost:6333`, collection name: `quiverdm`
- Scope: user-level

## Follow-up (out of scope)

- n8n ingestion workflow: chunk + embed (Ollama nomic-embed-text) + index docs to Qdrant
- Decide which docs to ingest: `docs/plans/`, `docs/obsidian-vault/`, D&D vault

## Files Changed

- `~/.claude.json` — add 4 MCP server entries
- `E:\Projects\QuiverDM\docker-compose.yml` — add qdrant service + volume
