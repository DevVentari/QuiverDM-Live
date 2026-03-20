# MCP RAG & Knowledge Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four MCP servers to the global Claude Code config (mcp-local-rag ×2, mcp-obsidian, mcp-server-qdrant) and add Qdrant to docker-compose.

**Architecture:** Config-only changes — no app code. Two mcp-local-rag instances (one per knowledge base), mcp-obsidian via direct vault file access, mcp-server-qdrant pointing at a Docker Qdrant container.

**Tech Stack:** mcp-local-rag (LanceDB + CPU embeddings), mcp-obsidian (calclavia, filesystem), mcp-server-qdrant (uvx), Qdrant (Docker)

---

### Task 1: Add mcp-local-rag for QuiverDM codebase

**Files:**
- Modify: `~/.claude.json` (C:/Users/mail/.claude.json)

**Step 1: Read current ~/.claude.json**

```bash
cat ~/.claude.json
```

**Step 2: Add `local-rag` entry to mcpServers**

Add this entry inside the `mcpServers` object:

```json
"local-rag": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-local-rag"],
  "env": {
    "BASE_DIR": "E:\\Projects\\QuiverDM"
  }
}
```

**Step 3: Verify JSON is valid**

```bash
python -c "import json; json.load(open('/c/Users/mail/.claude.json')); print('valid')"
```

Expected: `valid`

**Step 4: Test the server loads**

```bash
claude mcp list
```

Expected: `local-rag` appears in the list.

---

### Task 2: Add mcp-local-rag for D&D notes

**Files:**
- Modify: `~/.claude.json`

**Step 1: Add `local-rag-dnd` entry to mcpServers**

Add this entry inside the `mcpServers` object:

```json
"local-rag-dnd": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-local-rag"],
  "env": {
    "BASE_DIR": "G:\\My Drive\\Notebooks\\Dungeons and Dragons"
  }
}
```

**Step 2: Verify JSON is valid**

```bash
python -c "import json; json.load(open('/c/Users/mail/.claude.json')); print('valid')"
```

Expected: `valid`

**Step 3: Verify both local-rag entries appear**

```bash
claude mcp list
```

Expected: both `local-rag` and `local-rag-dnd` appear.

---

### Task 3: Add mcp-obsidian for Obsidian vault

**Files:**
- Modify: `~/.claude.json`

**Step 1: Add `obsidian` entry to mcpServers**

Add this entry inside the `mcpServers` object:

```json
"obsidian": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-obsidian", "G:\\My Drive\\Notebooks\\Dungeons and Dragons"]
}
```

**Step 2: Verify JSON is valid**

```bash
python -c "import json; json.load(open('/c/Users/mail/.claude.json')); print('valid')"
```

Expected: `valid`

**Step 3: Verify obsidian entry appears**

```bash
claude mcp list
```

Expected: `obsidian` appears in the list.

---

### Task 4: Add Qdrant to docker-compose.yml

**Files:**
- Modify: `E:\Projects\QuiverDM\docker-compose.yml`

**Step 1: Add qdrant service**

Add this service block after the `n8n-mcp` service and before `comfyui`:

```yaml
  qdrant:
    image: qdrant/qdrant:latest
    container_name: quiverdm-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
```

**Step 2: Add qdrant_data volume**

In the `volumes:` section at the bottom, add:

```yaml
  qdrant_data:
```

**Step 3: Start Qdrant**

```bash
cd E:/Projects/QuiverDM && docker compose up -d qdrant
```

Expected: container starts, no errors.

**Step 4: Verify Qdrant is healthy**

```bash
curl http://localhost:6333/healthz
```

Expected: `{"title":"qdrant - vector search engine","version":"...","commit":"..."}`

---

### Task 5: Add mcp-server-qdrant

**Files:**
- Modify: `~/.claude.json`

**Prerequisites:** Task 4 complete (Qdrant running on port 6333). `uvx` available (installed with uv — run `uv --version` to confirm, install from https://docs.astral.sh/uv/ if missing).

**Step 1: Verify uvx is available**

```bash
uvx --version
```

Expected: version string. If missing: `pip install uv` or install uv from docs.astral.sh/uv.

**Step 2: Add `qdrant` entry to mcpServers**

Add this entry inside the `mcpServers` object in `~/.claude.json`:

```json
"qdrant": {
  "type": "stdio",
  "command": "uvx",
  "args": ["mcp-server-qdrant"],
  "env": {
    "QDRANT_URL": "http://localhost:6333",
    "COLLECTION_NAME": "quiverdm",
    "EMBEDDING_MODEL": "sentence-transformers/all-MiniLM-L6-v2"
  }
}
```

**Step 3: Verify JSON is valid**

```bash
python -c "import json; json.load(open('/c/Users/mail/.claude.json')); print('valid')"
```

Expected: `valid`

**Step 4: Verify all 5 new entries appear**

```bash
claude mcp list
```

Expected: `local-rag`, `local-rag-dnd`, `obsidian`, `qdrant` all appear alongside existing servers (playwright, bert, figma, gmail, shadcn).

---

### Task 6: Smoke-test all servers in a new Claude session

**Step 1: Open a new Claude Code session (or `/clear` current)**

**Step 2: Check local-rag is connected**

In Claude, ask: "Use the local-rag tool to search for 'tRPC router' in the QuiverDM codebase"

Expected: returns relevant file excerpts from `E:\Projects\QuiverDM`

**Step 3: Check local-rag-dnd is connected**

Ask: "Use the local-rag-dnd tool to search for any content about D&D campaigns or sessions"

Expected: returns content from `G:\My Drive\Notebooks\Dungeons and Dragons`

**Step 4: Check obsidian is connected**

Ask: "Use the obsidian tool to list files in my vault"

Expected: returns file list from the vault.

**Step 5: Check qdrant is connected**

Ask: "Use the qdrant tool to list collections"

Expected: returns collection list (empty or `quiverdm` if previously created).

---

### Task 7: Commit docker-compose change

**Step 1: Commit the docker-compose change**

```bash
cd E:/Projects/QuiverDM
git add docker-compose.yml
git commit -m "feat: add Qdrant service to docker-compose"
```

Note: `~/.claude.json` is machine-local and not committed to git. The MCP config changes are intentionally not versioned.
